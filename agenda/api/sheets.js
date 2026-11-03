// Google Sheets editable, en los dos sentidos.
// Una hoja de cálculo de Google con cuatro pestañas: Resumen, Pagos Tania,
// Pagos Edwin y Competencias. Las celdas amarillas (¿Pagó?, Forma de pago,
// Monto y, en competencias, Pagado) se pueden editar en la hoja: al
// sincronizar, lo que cambió ahí desde la última vez pasa a la agenda, y
// luego la hoja se vuelve a escribir con los datos de la agenda.
//
// Se conecta con una "cuenta de servicio" de Google (GOOGLE_SERVICE_ACCOUNT,
// el JSON de su llave) con la que la dueña comparte la hoja como editora.
// Los datos de la agenda se leen y escriben con la llave de servicio de
// Supabase. Ninguna de las dos llaves llega al navegador.
//
//   GET  /api/sheets?info=1          → correo del robot y si está configurado
//   POST /api/sheets {accion:"sync"}  → sincroniza (cualquier editor)
//   POST /api/sheets {accion:"conectar", hoja} → la dueña conecta su hoja
//   GET  /api/sheets (cron de Vercel) → sincroniza una vez al día
import crypto from "node:crypto";

const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const SHEETS = process.env.SHEETS_BASE || "https://sheets.googleapis.com/v4/spreadsheets";
const SB = () => String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const LLAVE = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const MAESTROS = { tania: "Tania", edwin: "Edwin" };
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const COLOR = { tania: "#0B6E72", edwin: "#1B2A4A", comp: "#1F6B4F", resumen: "#1B3A5F" };
const AMARILLO = "#FFF4CC";
const TABS = { resumen: "Resumen", tania: "Pagos Tania", edwin: "Pagos Edwin", comp: "Competencias" };

/* ------------------------------------------------------------ utilidades */
const hoyMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey" }).format(new Date());
const mesTxt = f => f && /^\d{4}-\d{2}/.test(f) ? `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}` : "";
const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const metodoTxt = m => m === "efectivo" ? "Efectivo" : m === "transferencia" ? "Transferencia" : "";
const metodoDe = s => { const n = norm(s); return n === "efectivo" ? "efectivo" : n === "transferencia" ? "transferencia" : null; };
const numero = v => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/[^\d.-]/g, "")); return isNaN(n) ? null : n; };
const nuevoId = () => Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
const color = h => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
const idHoja = s => { const m = String(s || "").match(/\/d\/([a-zA-Z0-9_-]{20,})/); return m ? m[1] : /^[a-zA-Z0-9_-]{20,}$/.test(String(s || "").trim()) ? String(s).trim() : ""; };

function cuentaServicio() {
  try { const j = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || ""); return j.client_email && j.private_key ? j : null; } catch (e) { return null; }
}
async function tokenGoogle(cs) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const ahora = Math.floor(Date.now() / 1000);
  const datos = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: cs.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: TOKEN_URL, iat: ahora, exp: ahora + 3000 })}`;
  const firma = crypto.createSign("RSA-SHA256").update(datos).sign(cs.private_key.replace(/\\n/g, "\n"), "base64url");
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${datos}.${firma}` }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("Google no aceptó la llave del robot. Revisa GOOGLE_SERVICE_ACCOUNT en Vercel.");
  return j.access_token;
}
async function google(token, ruta, opciones = {}) {
  const r = await fetch(`${SHEETS}${ruta}`, { ...opciones, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opciones.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 403 || r.status === 404) throw new Error("El robot no puede abrir la hoja. Compártela con su correo como Editor.");
  if (!r.ok) throw new Error(`Google Sheets respondió ${r.status}: ${(j.error && j.error.message) || ""}`.trim());
  return j;
}

/* ------------------------------------------------------------ Supabase */
const hSB = () => ({ apikey: LLAVE(), Authorization: `Bearer ${LLAVE()}`, "Content-Type": "application/json" });
async function leerColeccion(col) {
  const r = await fetch(`${SB()}/rest/v1/docs?coleccion=eq.${encodeURIComponent(col)}&select=path,data&limit=5000`, { headers: hSB() });
  if (!r.ok) throw new Error("No se pudo leer la base de datos.");
  const o = {}; (await r.json()).forEach(x => { o[x.path.slice(col.length + 1)] = x.data; }); return o;
}
async function leerDoc(path) {
  const r = await fetch(`${SB()}/rest/v1/docs?path=eq.${encodeURIComponent(path)}&select=data`, { headers: hSB() });
  const f = r.ok ? await r.json() : []; return f[0] ? f[0].data : null;
}
async function guardarDoc(path, data) {
  const r = await fetch(`${SB()}/rest/v1/docs`, { method: "POST", headers: { ...hSB(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ path, data, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error("No se pudo guardar en la base de datos.");
}
async function anotarHistorial(perfil, textos) {
  if (!textos.length) return;
  const mes = hoyMx().slice(0, 7), path = `maestros/${perfil}/historial/${mes}`;
  const doc = (await leerDoc(path)) || { entradas: [] };
  doc.entradas = [...(doc.entradas || []), ...textos.map(texto => ({ t: Date.now(), perfil, id: "google-sheets", texto }))];
  await guardarDoc(path, doc);
}

/* ------------------------------------------------------------ cuentas (igual que en la agenda) */
const sumarDias = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); };
function saldoAlumno(a, aid, semanas) {
  if (a.propietario) return "Sin límite";
  let usadas = 0;
  for (const [lunes, s] of Object.entries(semanas || {})) for (const c of Object.values((s && s.clases) || {}))
    if (c.alumnoId === aid && (c.estado === "asistio" || c.estado === "falta")) usadas++;
  const compradas = (a.paquetes || []).reduce((t, p) => t + (Number(p.clases) || 0), 0);
  return compradas - usadas;
}
function cuentaInscripcion(i, c) {
  const cs = (c && c.costos) || {}, aj = i.ajustes || {}, prs = i.pruebas || [];
  const num = (v, d) => v === "" || v == null ? Number(d) || 0 : Number(v) || 0;
  const dias = aj.dias !== "" && aj.dias != null ? Number(aj.dias) || 0 : new Set(prs.map(p => p.fecha).filter(Boolean)).size;
  const caballos = new Set(prs.map(p => p.caballoId || p.caballoTxt).filter(Boolean)).size || (prs.length ? 1 : 0);
  const total = prs.reduce((t, p) => t + num(p.costo, cs.prueba), 0) + num(aj.inscripcion, cs.inscripcion) + num(aj.transporte, cs.transporte)
    + num(aj.viaticos, cs.viaticos) + (aj.caballeriza !== "" && aj.caballeriza != null ? Number(aj.caballeriza) || 0 : (Number(cs.caballeriza) || 0) * dias * caballos) + (Number(aj.otros) || 0);
  const pagado = (i.pagos || []).reduce((t, p) => t + (Number(p.monto) || 0), 0);
  return { total, pagado };
}
const fechasTxt = c => { const f = x => { const [y, m, d] = x.split("-"); return `${Number(d)}/${Number(m)}`; }; return c.fin && c.fin !== c.inicio ? `${f(c.inicio)} al ${f(c.fin)}` : f(c.inicio); };

/* ------------------------------------------------------------ armar las filas */
function filasPagos(perfil, alumnos, semanas) {
  const filas = [];
  for (const [aid, a] of Object.entries(alumnos)) {
    if (!a || a.borrado) continue;
    const paqs = (a.paquetes || []).slice().sort((x, y) => String(y.fecha || "").localeCompare(String(x.fecha || "")));
    const saldo = saldoAlumno(a, aid, semanas);
    paqs.forEach((p, n) => filas.push({ clave: `${perfil}|${aid}|${p.id}`, valores: [mesTxt(p.fecha), p.fecha || "", a.nombre || "", Number(p.clases) || 0,
      p.monto == null ? "" : Number(p.monto), p.pagado ? "Sí" : "No", metodoTxt(p.metodo), n === 0 ? saldo : "", `${perfil}|${aid}|${p.id}`],
      exp: { m: p.monto == null ? null : Number(p.monto), p: !!p.pagado, f: p.metodo || "" } }));
  }
  return filas.sort((x, y) => String(y.valores[1]).localeCompare(String(x.valores[1])) || String(x.valores[2]).localeCompare(String(y.valores[2])));
}
function filasComp(comps, inscs, nombres) {
  const filas = [];
  for (const i of Object.values(inscs)) {
    const c = comps[i.competenciaId]; if (!c) continue;
    const k = cuentaInscripcion(i, c);
    const metodos = [...new Set((i.pagos || []).map(p => metodoTxt(p.metodo)).filter(Boolean))];
    filas.push({ clave: `comp|${i.id}`, orden: `${c.inicio}|${c.nombre}|${nombres[i.alumnoId] || ""}`,
      valores: [mesTxt(c.inicio), c.nombre || "", fechasTxt(c), nombres[i.alumnoId] || "Alumno borrado", MAESTROS[i.maestro] || "", (i.pruebas || []).length,
        k.total, k.pagado, null, null, metodos.length === 1 ? metodos[0] : metodos.join(" y "), `comp|${i.id}`],
      exp: { pagado: k.pagado, f: metodos.length === 1 ? metodos[0] : "" } });
  }
  return filas.sort((x, y) => x.orden.localeCompare(y.orden));
}

/* ------------------------------------------------------------ formato de las pestañas (solo al crearlas) */
const ENCABEZADOS = {
  tania: ["Mes", "Fecha", "Alumno", "Clases", "✎ Monto", "✎ ¿Pagó?", "✎ Forma de pago", "Le quedan", "Clave (no tocar)"],
  edwin: ["Mes", "Fecha", "Alumno", "Clases", "✎ Monto", "✎ ¿Pagó?", "✎ Forma de pago", "Le quedan", "Clave (no tocar)"],
  comp: ["Mes", "Competencia", "Fechas", "Alumno", "Maestro", "Pruebas", "Total", "✎ Pagado", "Falta", "¿Pagó?", "✎ Forma de pago", "Clave (no tocar)"],
  resumen: ["Mes", "Clases · Tania", "Clases · Edwin", "Competencias", "TOTAL COBRADO", "Por cobrar · clases", "Por cobrar · competencias"],
};
const ANCHOS = { tania: [140, 100, 210, 70, 110, 95, 140, 95, 30], edwin: [140, 100, 210, 70, 110, 95, 140, 95, 30],
  comp: [130, 200, 110, 190, 90, 75, 105, 110, 105, 90, 140, 30], resumen: [160, 135, 135, 135, 160, 160, 190] };
const EDITABLES = { tania: [4, 5, 6], edwin: [4, 5, 6], comp: [7, 10] };
const TITULOS = {
  tania: ["Pagos de Tania", "✎ Las columnas amarillas se pueden cambiar aquí (Monto, ¿Pagó?, Forma de pago) y pasan solas a la agenda. Lo demás se llena desde la agenda."],
  edwin: ["Pagos de Edwin", "✎ Las columnas amarillas se pueden cambiar aquí (Monto, ¿Pagó?, Forma de pago) y pasan solas a la agenda. Lo demás se llena desde la agenda."],
  comp: ["Pagos de competencias", "✎ En Pagado escribe el total que ya pagó cada alumno y en Forma de pago cómo pagó; la agenda registra la diferencia como un pago nuevo."],
  resumen: ["Resumen por mes", "Se calcula solo con las otras pestañas: lo cobrado de clases de Tania y de Edwin, competencias y lo que falta por cobrar."],
};
/* Renglón 3: los números clave de la pestaña (fórmulas). */
const KPIS = {
  tania: ["Cobrado", "=SUMIFS(E5:E,F5:F,\"Sí\")", "", "Por cobrar", "=SUMIFS(E5:E,F5:F,\"No\")", "", "Paquetes", "=COUNTA(I5:I)"],
  edwin: ["Cobrado", "=SUMIFS(E5:E,F5:F,\"Sí\")", "", "Por cobrar", "=SUMIFS(E5:E,F5:F,\"No\")", "", "Paquetes", "=COUNTA(I5:I)"],
  comp: ["Total a cobrar", "=SUM(G5:G)", "", "Cobrado", "=SUM(H5:H)", "", "Falta", "=SUM(I5:I)"],
  resumen: ["Cobrado (todo)", "=SUM(E5:E)", "", "Por cobrar (todo)", "=SUM(F5:F)+SUM(G5:G)"],
};
const TINTE = { tania: "#E6F4F3", edwin: "#E9EDF3", comp: "#E7F2EC", resumen: "#E8EEF5" };
const FORMATO_VERSION = 2;
const colorDe = tipo => COLOR[tipo === "tania" || tipo === "edwin" ? tipo : tipo === "comp" ? "comp" : "resumen"];
function formatoPestana(sheetId, tipo) {
  const n = ENCABEZADOS[tipo].length, fuerte = color(colorDe(tipo)), tinte = color(TINTE[tipo]);
  const rango = (r1, r2, c1, c2) => ({ sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 });
  const fmt = (r, f) => ({ repeatCell: { range: r, cell: { userEnteredFormat: f }, fields: "userEnteredFormat" } });
  const alto = (a, b, px) => ({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: a, endIndex: b }, properties: { pixelSize: px }, fields: "pixelSize" } });
  const linea = { style: "SOLID", color: color("#D5DBE3") };
  const reqs = [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 4, hideGridlines: true }, tabColor: fuerte }, fields: "gridProperties.frozenRowCount,gridProperties.hideGridlines,tabColor" } },
    // Base de toda la pestaña
    fmt(rango(0, 3000, 0, n), { textFormat: { fontFamily: "Roboto", fontSize: 11, foregroundColor: color("#1F2A37") }, verticalAlignment: "MIDDLE" }),
    // 1: título
    { mergeCells: { range: rango(0, 1, 0, n), mergeType: "MERGE_ALL" } },
    fmt(rango(0, 1, 0, n), { backgroundColor: fuerte, textFormat: { fontFamily: "Playfair Display", foregroundColor: color("#FFFFFF"), bold: true, fontSize: 20 }, verticalAlignment: "MIDDLE", padding: { left: 12 } }),
    // 2: instrucciones
    { mergeCells: { range: rango(1, 2, 0, n), mergeType: "MERGE_ALL" } },
    fmt(rango(1, 2, 0, n), { backgroundColor: tinte, textFormat: { fontFamily: "Roboto", italic: true, fontSize: 10, foregroundColor: color("#45526A") }, wrapStrategy: "WRAP", verticalAlignment: "MIDDLE", padding: { left: 12 } }),
    // 3: números clave
    fmt(rango(2, 3, 0, n), { backgroundColor: color("#FFFFFF"), textFormat: { fontFamily: "Roboto", fontSize: 10, foregroundColor: color("#6B7486") }, verticalAlignment: "MIDDLE", horizontalAlignment: "RIGHT" }),
    // 4: encabezados
    fmt(rango(3, 4, 0, n), { backgroundColor: fuerte, textFormat: { fontFamily: "Roboto", bold: true, fontSize: 10, foregroundColor: color("#FFFFFF") }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" }),
    alto(0, 1, 52), alto(1, 2, 40), alto(2, 3, 38), alto(3, 4, 38), alto(4, 3000, 28),
    ...ANCHOS[tipo].map((px, c) => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: c, endIndex: c + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } })),
    { addBanding: { bandedRange: { range: rango(4, 3000, 0, n), rowProperties: { firstBandColor: color("#FFFFFF"), secondBandColor: color("#F7F9FB") } } } },
    { updateBorders: { range: rango(3, 3000, 0, n), innerHorizontal: linea, bottom: linea } },
    // Números al centro; nombres a la izquierda y en negritas
    fmt(rango(4, 3000, 0, n), { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", textFormat: { fontFamily: "Roboto", fontSize: 11, foregroundColor: color("#1F2A37") } }),
  ];
  const izq = tipo === "comp" ? [1, 3] : tipo === "resumen" ? [0] : [2];
  izq.forEach(c => reqs.push(fmt(rango(4, 3000, c, c + 1), { horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 8 }, textFormat: { fontFamily: "Roboto", bold: true, fontSize: 11, foregroundColor: color("#1F2A37") } })));
  if (tipo !== "resumen") reqs.push(fmt(rango(4, 3000, 0, 1), { horizontalAlignment: "LEFT", padding: { left: 8 }, verticalAlignment: "MIDDLE", textFormat: { fontFamily: "Roboto", fontSize: 10, foregroundColor: color("#6B7486") } }));
  if (tipo !== "resumen") reqs.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: n - 1, endIndex: n }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } });
  const dinero = tipo === "comp" ? [6, 7, 8] : tipo === "resumen" ? [1, 2, 3, 4, 5, 6] : [4];
  const MONEDA = { type: "CURRENCY", pattern: "\"$\"#,##0" };
  dinero.forEach(c => reqs.push({ repeatCell: { range: rango(4, 3000, c, c + 1), cell: { userEnteredFormat: { numberFormat: MONEDA } }, fields: "userEnteredFormat.numberFormat" } }));
  if (tipo === "tania" || tipo === "edwin") reqs.push({ repeatCell: { range: rango(4, 3000, 1, 2), cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } });
  if (tipo === "resumen") reqs.push(fmt(rango(4, 3000, 4, 5), { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", numberFormat: MONEDA, backgroundColor: tinte, textFormat: { fontFamily: "Roboto", bold: true, fontSize: 12, foregroundColor: fuerte } }));
  // Números clave del renglón 3: etiqueta gris y valor grande
  [1, 4, 7].filter(c => c < n && KPIS[tipo][c]).forEach(c => reqs.push(fmt(rango(2, 3, c, c + 1), { horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", numberFormat: c === 7 && tipo !== "comp" ? { type: "NUMBER", pattern: "0" } : MONEDA,
    textFormat: { fontFamily: "Roboto", bold: true, fontSize: 15, foregroundColor: c === 4 && tipo !== "comp" ? color("#A33227") : c === 7 && tipo === "comp" ? color("#A33227") : fuerte } })));
  // Columnas editables: amarillo suave y encabezado dorado
  (EDITABLES[tipo] || []).forEach(c => {
    reqs.push({ repeatCell: { range: rango(4, 3000, c, c + 1), cell: { userEnteredFormat: { backgroundColor: color(AMARILLO) } }, fields: "userEnteredFormat.backgroundColor" } });
    reqs.push(fmt(rango(3, 4, c, c + 1), { backgroundColor: color("#C9A227"), textFormat: { fontFamily: "Roboto", bold: true, fontSize: 10, foregroundColor: color("#FFFFFF") }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" }));
  });
  const lista = (c, valores) => ({ setDataValidation: { range: rango(4, 3000, c, c + 1), rule: { condition: { type: "ONE_OF_LIST", values: valores.map(v => ({ userEnteredValue: v })) }, strict: true, showCustomUi: true } } });
  let i = 0;
  const pinta = (c, cond, valor, fondoH, letraH) => ({ addConditionalFormatRule: { index: i++, rule: { ranges: [rango(4, 3000, c, c + 1)],
    booleanRule: { condition: { type: cond, values: [{ userEnteredValue: valor }] }, format: { ...(fondoH ? { backgroundColor: color(fondoH) } : {}), textFormat: { bold: true, foregroundColor: color(letraH) } } } } } });
  if (tipo === "tania" || tipo === "edwin") reqs.push(lista(5, ["Sí", "No"]), lista(6, ["Efectivo", "Transferencia"]),
    pinta(5, "TEXT_EQ", "Sí", "#DFF0E7", "#1F6B4F"), pinta(5, "TEXT_EQ", "No", "#FBE6E2", "#A33227"), pinta(7, "NUMBER_LESS_THAN_EQ", "1", null, "#A33227"));
  if (tipo === "comp") reqs.push(lista(10, ["Efectivo", "Transferencia"]),
    pinta(9, "TEXT_EQ", "Sí", "#DFF0E7", "#1F6B4F"), pinta(9, "TEXT_EQ", "Parcial", "#FAF0D4", "#7A5A10"), pinta(9, "TEXT_EQ", "No", "#FBE6E2", "#A33227"), pinta(8, "NUMBER_GREATER", "0", null, "#A33227"));
  // Aviso (no bloqueo) al querer editar lo que viene de la agenda
  const libres = EDITABLES[tipo] || [];
  for (let c = 0; c < n; c++) if (!libres.includes(c)) reqs.push({ addProtectedRange: { protectedRange: { range: rango(4, 3000, c, c + 1), warningOnly: true, description: "Viene de la agenda" } } });
  return reqs;
}
/* Quita el formato anterior de una pestaña (para volver a darle el formato nuevo). */
function limpiarPestana(sh) {
  const id = sh.properties.sheetId; const reqs = [];
  (sh.bandedRanges || []).forEach(b => reqs.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } }));
  (sh.protectedRanges || []).forEach(p => reqs.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } }));
  for (let k = (sh.conditionalFormats || []).length - 1; k >= 0; k--) reqs.push({ deleteConditionalFormatRule: { sheetId: id, index: k } });
  reqs.push({ unmergeCells: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 4 } } });
  reqs.push({ setDataValidation: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 3000 } } });
  reqs.push({ repeatCell: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 3000 }, cell: { userEnteredFormat: {} }, fields: "userEnteredFormat" } });
  return reqs;
}

/* ------------------------------------------------------------ sincronizar */
async function sincronizar(cfg, quien) {
  const cs = cuentaServicio(); if (!cs) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT en Vercel.");
  const id = cfg.spreadsheetId; if (!id) throw new Error("Todavía no se conecta ninguna hoja.");
  const token = await tokenGoogle(cs);
  // 1. Pestañas: crear las que falten, con su formato
  const meta = await google(token, `/${id}?fields=properties.title,sheets.properties`);
  const existentes = Object.fromEntries((meta.sheets || []).map(s => [s.properties.title, s.properties.sheetId]));
  const faltan = Object.entries(TABS).filter(([, t]) => existentes[t] == null);
  if (faltan.length) {
    const r = await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: faltan.map(([, t]) => ({ addSheet: { properties: { title: t } } })) }) });
    (r.replies || []).forEach((x, n) => { existentes[faltan[n][1]] = x.addSheet.properties.sheetId; });
    await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: faltan.flatMap(([tipo, t]) => formatoPestana(existentes[t], tipo)) }) });
    await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: Object.values(TABS).map((t, k) => ({ updateSheetProperties: { properties: { sheetId: existentes[t], index: k }, fields: "index" } })) }) }).catch(() => {});
    // La hoja vacía que trae Google por omisión se borra si no tiene nada nuestro
    const sobrante = (meta.sheets || []).find(s => !Object.values(TABS).includes(s.properties.title));
    if (sobrante && (meta.sheets || []).length === 1) await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: sobrante.properties.sheetId } }] }) }).catch(() => {});
  }
  if (cfg.formato !== FORMATO_VERSION) {
    const det = await google(token, `/${id}?fields=sheets(properties(sheetId,title),bandedRanges(bandedRangeId),protectedRanges(protectedRangeId),conditionalFormats)`);
    const nuestras = (det.sheets || []).filter(sh => Object.values(TABS).includes(sh.properties.title) && !faltan.some(([, t]) => t === sh.properties.title));
    if (nuestras.length) {
      await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: nuestras.flatMap(limpiarPestana) }) });
      const tipoDe = t => Object.entries(TABS).find(([, x]) => x === t)[0];
      await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: nuestras.flatMap(sh => formatoPestana(sh.properties.sheetId, tipoDe(sh.properties.title))) }) });
    }
  }
  // 2. Leer lo que hay en la hoja (celdas editables) y compararlo con lo que se escribió la vez pasada
  const q = (t, r) => `ranges=${encodeURIComponent(`'${t}'!${r}`)}`;
  const leido = await google(token, `/${id}/values:batchGet?${[q(TABS.tania, "A5:I3000"), q(TABS.edwin, "A5:I3000"), q(TABS.comp, "A5:L3000")].join("&")}&valueRenderOption=UNFORMATTED_VALUE`);
  const [vT, vE, vC] = (leido.valueRanges || []).map(x => x.values || []);
  const exp = cfg.exportados || {};
  const datos = {
    tania: await leerColeccion("maestros/tania/alumnos"), edwin: await leerColeccion("maestros/edwin/alumnos"),
    comps: await leerColeccion("competencias"), inscs: await leerColeccion("inscripciones"),
  };
  const cambios = { tania: [], edwin: [], comp: [] };
  for (const [perfil, filas] of [["tania", vT], ["edwin", vE]]) {
    const tocados = {};
    for (const f of filas) {
      const clave = String(f[8] || ""); const e = exp[clave]; if (!e || !clave.startsWith(perfil + "|")) continue;
      const [, aid, pid] = clave.split("|"); const a = datos[perfil][aid]; const p = a && (a.paquetes || []).find(x => x.id === pid); if (!p) continue;
      const m = numero(f[4]), pag = norm(f[5]) === "si" ? true : norm(f[5]) === "no" ? false : null, met = metodoDe(f[6]);
      const c = {};
      if (m !== e.m && !(m === null && e.m === null)) c.monto = m;
      if (pag !== null && pag !== e.p) c.pagado = pag;
      if (met !== null && met !== e.f) c.metodo = met;
      else if (met === null && String(f[6] || "") === "" && e.f) c.metodo = "";
      if (!Object.keys(c).length) continue;
      Object.assign(p, c); tocados[aid] = a;
      cambios[perfil].push(`Desde Google Sheets: ${a.nombre}, paquete de ${p.clases} clases (${p.fecha || "sin fecha"}): ${[
        c.pagado !== undefined ? (c.pagado ? "pagado" : "sin pagar") : "", c.metodo !== undefined ? (metodoTxt(c.metodo) || "sin forma de pago") : "",
        c.monto !== undefined ? (c.monto == null ? "sin monto" : `$${c.monto.toLocaleString("es-MX")}`) : ""].filter(Boolean).join(", ")}`);
    }
    for (const [aid, a] of Object.entries(tocados)) await guardarDoc(`maestros/${perfil}/alumnos/${aid}`, a);
  }
  const nombres = {}; for (const p of ["tania", "edwin"]) for (const [aid, a] of Object.entries(datos[p])) nombres[aid] = a && a.nombre;
  for (const f of vC) {
    const clave = String(f[11] || ""); const e = exp[clave]; if (!e || !clave.startsWith("comp|")) continue;
    const i = datos.inscs[clave.slice(5)]; const c = i && datos.comps[i.competenciaId]; if (!c) continue;
    const pagado = numero(f[7]); if (pagado === null || pagado === e.pagado) continue;
    const dif = pagado - e.pagado; const met = metodoDe(f[10]) || "";
    i.pagos = [...(i.pagos || []), { id: nuevoId(), monto: dif, metodo: met, fecha: hoyMx(), nota: "desde Google Sheets" }];
    await guardarDoc(`inscripciones/${i.id}`, i);
    cambios.comp.push({ perfil: i.maestro, texto: `Desde Google Sheets: ${dif > 0 ? "pago" : "ajuste"} de $${Math.abs(dif).toLocaleString("es-MX")}${met ? ` (${metodoTxt(met)})` : ""} de ${nombres[i.alumnoId] || "alumno"} en ${c.nombre}` });
    datos.inscs[i.id] = i;
  }
  await anotarHistorial("tania", [...cambios.tania, ...cambios.comp.filter(x => x.perfil !== "edwin").map(x => x.texto)]);
  await anotarHistorial("edwin", [...cambios.edwin, ...cambios.comp.filter(x => x.perfil === "edwin").map(x => x.texto)]);
  // 3. Escribir la hoja con los datos de la agenda
  const semanas = { tania: await leerColeccion("maestros/tania/semanas"), edwin: await leerColeccion("maestros/edwin/semanas") };
  const fT = filasPagos("tania", datos.tania, semanas.tania), fE = filasPagos("edwin", datos.edwin, semanas.edwin);
  const fC = filasComp(datos.comps, datos.inscs, nombres);
  fC.forEach((x, n) => { const r = 5 + n; x.valores[8] = `=G${r}-H${r}`; x.valores[9] = `=IF(I${r}<=0,"Sí",IF(H${r}>0,"Parcial","No"))`; });
  const meses = [...new Set([...fT, ...fE].map(x => x.valores[1]).concat(fC.map(x => (datos.comps[datos.inscs[x.clave.slice(5)].competenciaId] || {}).inicio)).filter(Boolean).map(f => f.slice(0, 7)))].sort().reverse();
  const pt = `'${TABS.tania}'`, pe = `'${TABS.edwin}'`, pc = `'${TABS.comp}'`;
  const filasRes = meses.map((m, n) => { const r = 5 + n, t = mesTxt(m);
    return [t, `=SUMIFS(${pt}!E:E,${pt}!A:A,A${r},${pt}!F:F,"Sí")`, `=SUMIFS(${pe}!E:E,${pe}!A:A,A${r},${pe}!F:F,"Sí")`, `=SUMIFS(${pc}!H:H,${pc}!A:A,A${r})`,
      `=B${r}+C${r}+D${r}`, `=SUMIFS(${pt}!E:E,${pt}!A:A,A${r},${pt}!F:F,"No")+SUMIFS(${pe}!E:E,${pe}!A:A,A${r},${pe}!F:F,"No")`, `=SUMIFS(${pc}!I:I,${pc}!A:A,A${r})`]; });
  const enc = tipo => [[TITULOS[tipo][0]], [TITULOS[tipo][1]], KPIS[tipo], ENCABEZADOS[tipo]];
  await google(token, `/${id}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: [`${pt}!A5:I3000`, `${pe}!A5:I3000`, `${pc}!A5:L3000`, `'${TABS.resumen}'!A5:G400`] }) });
  await google(token, `/${id}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: [
    { range: `${pt}!A1`, values: [...enc("tania"), ...fT.map(x => x.valores)] },
    { range: `${pe}!A1`, values: [...enc("edwin"), ...fE.map(x => x.valores)] },
    { range: `${pc}!A1`, values: [...enc("comp"), ...fC.map(x => x.valores)] },
    { range: `'${TABS.resumen}'!A1`, values: [...enc("resumen"), ...filasRes] },
  ] }) });
  // 4. Recordar lo que se escribió, para saber después qué se editó en la hoja
  const exportados = {};
  [...fT, ...fE].forEach(x => { exportados[x.clave] = x.exp; }); fC.forEach(x => { exportados[x.clave] = x.exp; });
  // Número de cada pestaña, para enlaces que abren directo una pestaña (#gid=)
  const gids = Object.fromEntries(Object.entries(TABS).map(([k, t]) => [k, existentes[t]]).filter(([, v]) => v != null));
  const nuevo = { ...cfg, exportados, gids, formato: FORMATO_VERSION, ultimo: Date.now(), por: quien || "", error: "", url: `https://docs.google.com/spreadsheets/d/${id}/edit`, titulo: (meta.properties && meta.properties.title) || "" };
  await guardarDoc("config/sheets", nuevo);
  return { cambios: cambios.tania.length + cambios.edwin.length + cambios.comp.length, url: nuevo.url };
}

/* ------------------------------------------------------------ acceso */
async function usuarioDe(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!token || !anon) return null;
  const r = await fetch(`${SB()}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json(); const email = String(u.email || "").toLowerCase();
  const e = await fetch(`${SB()}/rest/v1/editores?select=email,dueno`, { headers: hSB() });
  const ed = (e.ok ? await e.json() : []).find(x => String(x.email).toLowerCase() === email);
  return ed ? { email, dueno: !!ed.dueno } : null;
}
const esCron = req => (process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`) || /vercel-cron/i.test(String(req.headers["user-agent"] || ""));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const cs = cuentaServicio();
  if (req.method === "GET" && req.query && req.query.info) return res.status(200).json({ configurada: !!cs, correo: cs ? cs.client_email : "" });
  if (!SB() || !LLAVE()) return res.status(503).json({ error: "Falta la llave de servicio de Supabase en Vercel." });
  if (!cs) return res.status(503).json({ error: "Falta GOOGLE_SERVICE_ACCOUNT en Vercel." });
  let cfg = (await leerDoc("config/sheets")) || {};
  // Si hay otra sincronización en curso (menos de 50 s), no se encima.
  const ocupado = () => cfg.enCurso && Date.now() - cfg.enCurso < 50000;
  const correr = async quien => {
    if (ocupado()) return res.status(200).json({ ok: true, ocupado: true, url: cfg.url || "" });
    await guardarDoc("config/sheets", { ...cfg, enCurso: Date.now() });
    try { const r = await sincronizar(cfg, quien); return res.status(200).json({ ok: true, ...r }); }
    catch (e) { await guardarDoc("config/sheets", { ...cfg, enCurso: 0, error: e.message, errorEn: Date.now() }).catch(() => {}); return res.status(200).json({ ok: false, error: e.message }); }
  };
  if (req.method === "GET") { if (!esCron(req)) return res.status(401).json({ error: "No autorizado" }); if (!cfg.spreadsheetId) return res.status(200).json({ ok: true, sinHoja: true }); return correr("automático"); }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const u = await usuarioDe(req); if (!u) return res.status(401).json({ error: "Tu sesión no tiene permiso. Vuelve a entrar." });
  const { accion, hoja } = req.body || {};
  if (accion === "conectar") {
    if (!u.dueno) return res.status(403).json({ error: "Solo la dueña de la agenda puede conectar la hoja." });
    const id = idHoja(hoja); if (!id) return res.status(400).json({ error: "Pega el enlace completo de la hoja de Google Sheets." });
    cfg = { spreadsheetId: id, exportados: {}, conectadaPor: u.email, conectadaEn: Date.now() };
    return correr(u.email);
  }
  if (accion === "sync") { if (!cfg.spreadsheetId) return res.status(200).json({ ok: false, error: "Todavía no se conecta ninguna hoja." }); return correr(u.email); }
  return res.status(400).json({ error: "Acción desconocida" });
}
