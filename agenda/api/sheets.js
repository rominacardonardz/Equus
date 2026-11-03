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
/* Dos archivos: pagos de clases (una pestaña por mes) y competencias (una por año). */
const TITULO_ARCHIVO = { pagos: "Equus · Pagos de clases", comp: "Equus · Competencias" };
const VIEJAS = ["Pagos Tania", "Pagos Edwin", "Competencias", "Hoja 1", "Sheet1", "Hoja1"];

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

/* ------------------------------------------------------------ cómo se ve cada pestaña
   Cada pestaña se arma como una lista de renglones con su tipo; de ahí salen
   los valores y el formato. Se vuelve a escribir completa en cada sincronización. */
const PAGOS_COLS = ["Fecha", "Alumno", "Clases", "✎ Monto", "✎ ¿Pagó?", "✎ Forma de pago", "Le quedan", "Clave"];
const PAGOS_ANCHO = [105, 230, 70, 115, 95, 150, 100, 30];
const COMP_COLS = ["Alumno", "Maestro", "Pruebas", "Total", "✎ Pagado", "Te debe", "Estado", "✎ Forma de pago", "Detalle de pruebas", "Clave"];
const COMP_ANCHO = [210, 90, 75, 110, 115, 110, 100, 150, 330, 30];
const fechaCorta = f => { if (!f) return ""; const [y, m, d] = f.split("-"); return `${Number(d)} ${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][Number(m) - 1]}`; };
const horaTxt = h => { if (!h) return ""; const [H, M] = h.split(":").map(Number); return `${H % 12 || 12}:${String(M || 0).padStart(2, "0")} ${H < 12 ? "am" : "pm"}`; };
const fechasLargas = c => { const a = fechaCorta(c.inicio), b = fechaCorta(c.fin || c.inicio); return a === b ? a : `${a} al ${b}`; };

/* Pestaña de un mes: tarjetas del mes, bloque de Tania, bloque de Edwin y total. */
function planMes(m, porMaestro) {
  const R = [{ t: "titulo", v: [`Pagos de clases · ${mesTxt(m)}`] },
    { t: "instr", v: ["✎ Las columnas doradas se cambian aquí (Monto, ¿Pagó?, Forma de pago) y pasan solas a la agenda. Lo demás se llena desde la agenda."] },
    { t: "kpi", v: [] }, { t: "kpi", v: [] }, { t: "vacio", v: [] }];
  const subt = {}, rangos = [];
  for (const perfil of ["tania", "edwin"]) {
    const filas = porMaestro[perfil] || [];
    R.push({ t: "seccion", v: [`${MAESTROS[perfil].toUpperCase()}   ·   ${filas.length} ${filas.length === 1 ? "paquete" : "paquetes"}`], perfil }, { t: "enc", v: PAGOS_COLS });
    const a = R.length + 1;
    if (!filas.length) R.push({ t: "nada", v: ["", "Sin paquetes este mes"] });
    filas.forEach((f, n) => R.push({ t: "dato", v: f.valores, par: n % 2, clave: f.clave }));
    const b = R.length; rangos.push([a, b]);
    R.push({ t: "subtotal", v: ["", `Subtotal ${MAESTROS[perfil]}`, "Cobrado", `=SUMIFS(D${a}:D${b},E${a}:E${b},"Sí")`, "Por cobrar", `=SUMIFS(D${a}:D${b},E${a}:E${b},"No")`] });
    subt[perfil] = R.length;
    R.push({ t: "vacio", v: [] });
  }
  R.push({ t: "total", v: ["", "TOTAL DEL MES", "Cobrado", `=D${subt.tania}+D${subt.edwin}`, "Por cobrar", `=F${subt.tania}+F${subt.edwin}`] });
  const tot = R.length;
  const suma = (cond) => rangos.map(([a, b]) => `SUMIFS(D${a}:D${b},E${a}:E${b},"Sí",F${a}:F${b},"${cond}")`).join("+");
  const cuenta = (v) => rangos.map(([a, b]) => `COUNTIF(E${a}:E${b},"${v}")`).join("+");
  R[2].v = ["Cobrado", `=D${tot}`, "Por cobrar", `=F${tot}`, "Pagaron", `=(${cuenta("Sí")})&" de "&(${cuenta("Sí")}+${cuenta("No")})`];
  R[3].v = ["Efectivo", `=${suma("Efectivo")}`, "Transferencia", `=${suma("Transferencia")}`, "Deben", `=${cuenta("No")}`];
  return { R, subt, tot, cols: PAGOS_COLS.length, editables: [3, 4, 5], pago: 4, metodo: 5, monedas: [3], anchos: PAGOS_ANCHO, color: COLOR.resumen, congelar: 4,
    kpiFmt: { 1: "MONEDA", 3: "MONEDA", 5: "TEXTO", r1: { 1: "MONEDA", 3: "MONEDA", 5: "NUMERO" } }, kpiRojo: [[2, 3], [3, 5]] };
}
/* Pestaña de una competencia: quién debe y cuánto, alumno por alumno. */
function planCompetencia(c, filas) {
  const R = [{ t: "titulo", v: [c.nombre] },
    { t: "instr", v: [`${fechasLargas(c)} ${String(c.inicio).slice(0, 4)}${c.lugar ? "  ·  " + c.lugar : ""}   —   ✎ En Pagado escribe el total que ya pagó cada alumno y en Forma de pago cómo pagó; la agenda lo registra.`] },
    { t: "kpi", v: [] }, { t: "vacio", v: [] }, { t: "enc", v: COMP_COLS }];
  const a = R.length + 1;
  if (!filas.length) R.push({ t: "nada", v: ["Sin alumnos inscritos"] });
  filas.forEach((f, n) => { const r = R.length + 1; const v = f.valores.slice(); v[5] = `=D${r}-E${r}`; v[6] = `=IF(D${r}=0,"—",IF(F${r}<=0,"Pagado",IF(E${r}>0,"Parcial","Debe")))`; R.push({ t: "dato", v, par: n % 2, clave: f.clave }); });
  const b = R.length;
  R.push({ t: "total", v: ["TOTAL", "", `=SUM(C${a}:C${b})`, `=SUM(D${a}:D${b})`, `=SUM(E${a}:E${b})`, `=SUM(F${a}:F${b})`] });
  const tot = R.length;
  R[2].v = ["Te deben", `=F${tot}`, "Cobrado", `=E${tot}&""`, "Ya pagaron", `=COUNTIF(G${a}:G${b},"Pagado")&" de "&COUNTIF(J${a}:J${b},"comp|*")`];
  R[2].v[3] = `=E${tot}`;
  return { R, tot, a, b, cols: COMP_COLS.length, editables: [4, 7], pago: 6, metodo: 7, monedas: [3, 4, 5], anchos: COMP_ANCHO, color: COLOR.comp, congelar: 3,
    kpiFmt: { 1: "MONEDA", 3: "MONEDA", 5: "TEXTO" }, kpiRojo: [[2, 1]], estado: true };
}

/* Formato de una pestaña según su plan. */
function formatoPlan(sheetId, plan, tipoArchivo) {
  const n = plan.cols, ult = n - 1;
  const rg = (r1, r2, c1 = 0, c2 = n) => ({ sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 });
  const fmt = (r, f, fields = "userEnteredFormat") => ({ repeatCell: { range: r, cell: { userEnteredFormat: f }, fields } });
  const alto = (a, px) => ({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: a, endIndex: a + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } });
  const txt = (o = {}) => ({ fontFamily: "Roboto", fontSize: 11, foregroundColor: color("#1F2A37"), ...o });
  const linea = { style: "SOLID", color: color("#D5DBE3") };
  const MONEDA = { type: "CURRENCY", pattern: "\"$\"#,##0" };
  const NF = { MONEDA, NUMERO: { type: "NUMBER", pattern: "0" }, TEXTO: { type: "TEXT" } };
  const reqs = [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: plan.congelar || 3, hideGridlines: true }, tabColor: color(plan.color) }, fields: "gridProperties.frozenRowCount,gridProperties.hideGridlines,tabColor" } },
    ...plan.anchos.map((px, c) => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: c, endIndex: c + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } })),
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: ult, endIndex: n }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
    fmt(rg(0, plan.R.length + 30), { verticalAlignment: "MIDDLE", textFormat: txt() }),
  ];
  let kpiN = 0;
  plan.R.forEach((r, k) => {
    const fila = rg(k, k + 1);
    if (r.t === "titulo") { reqs.push({ mergeCells: { range: rg(k, k + 1, 0, ult), mergeType: "MERGE_ALL" } }, fmt(fila, { backgroundColor: color(plan.color), verticalAlignment: "MIDDLE", padding: { left: 16 }, textFormat: txt({ fontFamily: "Playfair Display", fontSize: 22, bold: true, foregroundColor: color("#FFFFFF") }) }), alto(k, 58)); }
    if (r.t === "instr") { reqs.push({ mergeCells: { range: rg(k, k + 1, 0, ult), mergeType: "MERGE_ALL" } }, fmt(fila, { backgroundColor: color("#F1F5F7"), wrapStrategy: "WRAP", verticalAlignment: "MIDDLE", padding: { left: 16 }, textFormat: txt({ italic: true, fontSize: 10, foregroundColor: color("#45526A") }) }), alto(k, 40)); }
    if (r.t === "kpi") {
      const conf = kpiN === 0 ? plan.kpiFmt : (plan.kpiFmt.r1 || plan.kpiFmt);
      reqs.push(fmt(fila, { backgroundColor: color("#FFFFFF"), verticalAlignment: "MIDDLE", horizontalAlignment: "RIGHT", padding: { right: 6 }, textFormat: txt({ fontSize: 10, foregroundColor: color("#6B7486") }) }), alto(k, 44));
      [1, 3, 5].forEach(c => { const rojo = (plan.kpiRojo || []).some(([rk, rc]) => rk === k && rc === c);
        reqs.push(fmt(rg(k, k + 1, c, c + 1), { horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 6 }, numberFormat: NF[conf[c] || "MONEDA"],
          textFormat: txt({ fontSize: 17, bold: true, foregroundColor: color(rojo ? "#A33227" : plan.color) }) })); });
      reqs.push({ updateBorders: { range: rg(k, k + 1, 0, 6), bottom: { style: "SOLID", color: color("#E4EAF0") } } });
      kpiN++;
    }
    if (r.t === "vacio") reqs.push(alto(k, 14));
    if (r.t === "seccion") { const cs = r.perfil ? COLOR[r.perfil] : plan.color;
      reqs.push({ mergeCells: { range: rg(k, k + 1, 0, ult), mergeType: "MERGE_ALL" } }, fmt(fila, { backgroundColor: color(cs), verticalAlignment: "MIDDLE", padding: { left: 12 }, textFormat: txt({ fontSize: 13, bold: true, foregroundColor: color("#FFFFFF") }) }), alto(k, 36)); }
    if (r.t === "enc") {
      reqs.push(fmt(fila, { backgroundColor: color("#E4EAF0"), horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", textFormat: txt({ fontSize: 10, bold: true, foregroundColor: color("#33415C") }) }), alto(k, 34));
      (plan.editables || []).forEach(c => reqs.push(fmt(rg(k, k + 1, c, c + 1), { backgroundColor: color("#C9A227"), horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", textFormat: txt({ fontSize: 10, bold: true, foregroundColor: color("#FFFFFF") }) })));
    }
    if (r.t === "dato" || r.t === "nada") {
      const fondo = r.par ? "#F7F9FB" : "#FFFFFF";
      reqs.push(fmt(fila, { backgroundColor: color(fondo), horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", textFormat: txt() }), alto(k, r.t === "nada" ? 28 : tipoArchivo === "comp" && !plan.resumen ? 40 : 30));
      if (r.t === "nada") reqs.push(fmt(fila, { backgroundColor: color(fondo), horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 8 }, textFormat: txt({ italic: true, foregroundColor: color("#8A93A5") }) }));
      else {
        const nom = plan.resumen ? 0 : tipoArchivo === "pagos" ? 1 : 0;
        reqs.push(fmt(rg(k, k + 1, nom, nom + 1), { backgroundColor: color(fondo), horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 8 }, textFormat: txt({ bold: true }) }));
        if (tipoArchivo === "comp" && !plan.resumen) reqs.push(fmt(rg(k, k + 1, 8, 9), { backgroundColor: color(fondo), horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", padding: { left: 8 }, textFormat: txt({ fontSize: 9, foregroundColor: color("#45526A") }) }));
        (plan.editables || []).forEach(c => reqs.push({ repeatCell: { range: rg(k, k + 1, c, c + 1), cell: { userEnteredFormat: { backgroundColor: color(AMARILLO) } }, fields: "userEnteredFormat.backgroundColor" } }));
        if (tipoArchivo === "pagos" && !plan.resumen) reqs.push({ repeatCell: { range: rg(k, k + 1, 0, 1), cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } });
        plan.monedas.forEach(c => reqs.push({ repeatCell: { range: rg(k, k + 1, c, c + 1), cell: { userEnteredFormat: { numberFormat: MONEDA } }, fields: "userEnteredFormat.numberFormat" } }));
      }
    }
    if (r.t === "subtotal" || r.t === "total") {
      const fuerte = r.t === "total";
      reqs.push(fmt(fila, { backgroundColor: color(fuerte ? plan.color : "#EEF2F6"), horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE",
        textFormat: txt({ bold: true, fontSize: fuerte ? 13 : 11, foregroundColor: color(fuerte ? "#FFFFFF" : "#1F2A37") }) }), alto(k, fuerte ? 42 : 30));
      (r.monedas || (tipoArchivo === "pagos" && !plan.resumen ? [3, 5] : plan.monedas)).forEach(c => reqs.push({ repeatCell: { range: rg(k, k + 1, c, c + 1), cell: { userEnteredFormat: { numberFormat: MONEDA } }, fields: "userEnteredFormat.numberFormat" } }));
      reqs.push({ updateBorders: { range: fila, top: { style: "SOLID_MEDIUM", color: color(fuerte ? plan.color : "#AEB8C6") } } });
    }
  });
  // Listas y colores en los renglones de datos
  const datos = plan.R.map((r, k) => r.t === "dato" ? k : -1).filter(k => k >= 0);
  const tramos = []; datos.forEach(k => { const t = tramos[tramos.length - 1]; if (t && t[1] === k) t[1] = k + 1; else tramos.push([k, k + 1]); });
  let idx = 0;
  const regla = (rangos, valor, fondo, letra) => ({ addConditionalFormatRule: { index: idx++, rule: { ranges: rangos, booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: valor }] }, format: { backgroundColor: color(fondo), textFormat: { bold: true, foregroundColor: color(letra) } } } } } });
  if (tramos.length && !plan.resumen) {
    const col = c => tramos.map(([a, b]) => rg(a, b, c, c + 1));
    if (tipoArchivo === "pagos") reqs.push(regla(col(plan.pago), "Sí", "#DFF0E7", "#1F6B4F"), regla(col(plan.pago), "No", "#FBE6E2", "#A33227"),
      { addConditionalFormatRule: { index: idx++, rule: { ranges: col(6), booleanRule: { condition: { type: "NUMBER_LESS_THAN_EQ", values: [{ userEnteredValue: "1" }] }, format: { textFormat: { bold: true, foregroundColor: color("#A33227") } } } } } });
    if (tipoArchivo === "comp") reqs.push(regla(col(6), "Pagado", "#DFF0E7", "#1F6B4F"), regla(col(6), "Parcial", "#FAF0D4", "#7A5A10"), regla(col(6), "Debe", "#FBE6E2", "#A33227"),
      { addConditionalFormatRule: { index: idx++, rule: { ranges: col(5), booleanRule: { condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] }, format: { textFormat: { bold: true, foregroundColor: color("#A33227") } } } } } });
    tramos.forEach(([a, b]) => {
      if (tipoArchivo === "pagos") reqs.push({ setDataValidation: { range: rg(a, b, 4, 5), rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Sí" }, { userEnteredValue: "No" }] }, strict: true, showCustomUi: true } } });
      reqs.push({ setDataValidation: { range: rg(a, b, plan.metodo, plan.metodo + 1), rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Efectivo" }, { userEnteredValue: "Transferencia" }] }, strict: true, showCustomUi: true } } });
    });
  }
  tramos.forEach(([a, b]) => reqs.push({ updateBorders: { range: rg(a, b), innerHorizontal: linea, bottom: linea } }));
  if (plan.resumen && plan.rojas) plan.rojas.forEach(c => tramos.length && reqs.push({ addConditionalFormatRule: { index: idx++, rule: { ranges: tramos.map(([a, b]) => rg(a, b, c, c + 1)),
    booleanRule: { condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] }, format: { textFormat: { bold: true, foregroundColor: color("#A33227") } } } } } }));
  return reqs;
}
/* Resúmenes: pagos (un renglón por mes, con gráfica) y competencias (bloques por año, con gráfica). */
function planResumenPagos(filas) {
  const cols = ["Mes", "Cobrado · Tania", "Cobrado · Edwin", "TOTAL COBRADO", "Por cobrar", "Efectivo", "Transferencia", ""];
  const R = [{ t: "titulo", v: ["Resumen de pagos de clases"] }, { t: "instr", v: ["Un renglón por mes; se calcula solo con las pestañas de cada mes. Abajo, la gráfica de lo cobrado por mes."] },
    { t: "kpi", v: [] }, { t: "vacio", v: [] }, { t: "enc", v: cols }];
  const a = R.length + 1; filas.forEach((v, n) => R.push({ t: "dato", v, par: n % 2 })); const b = R.length;
  const S = c => filas.length ? `=SUM(${c}${a}:${c}${b})` : 0;
  R.push({ t: "total", v: ["TOTAL", S("B"), S("C"), S("D"), S("E"), S("F"), S("G")] }); const tot = R.length;
  R[2].v = ["Cobrado (todo)", `=D${tot}`, "Por cobrar (todo)", `=E${tot}`, "Meses", String(filas.length)];
  return { R, cols: cols.length, editables: [], monedas: [1, 2, 3, 4, 5, 6], anchos: [170, 140, 140, 150, 130, 130, 140, 20], color: COLOR.resumen, resumen: true, congelar: 3,
    kpiFmt: { 1: "MONEDA", 3: "MONEDA", 5: "NUMERO" }, kpiRojo: [[2, 3]], rojas: [4],
    grafica: filas.length ? { titulo: "Cobrado por mes", dominio: [a - 1, b, 0], series: [[a - 1, b, 1], [a - 1, b, 2]], fila: tot + 1, apilada: true } : null };
}
function planResumenComp(porAnio) {
  const cols = ["Competencia", "Fechas", "Lugar", "Alumnos", "Ya pagaron", "Total", "Cobrado", "Te deben", ""];
  const R = [{ t: "titulo", v: ["Resumen de competencias"] }, { t: "instr", v: ["Una línea por competencia, por año. Cada competencia tiene su pestaña con el detalle de cada alumno. Abajo, la gráfica del año."] },
    { t: "kpi", v: [] }, { t: "vacio", v: [] }];
  const totales = []; let graf = null;
  porAnio.forEach(({ anio, filas }, y) => {
    R.push({ t: "seccion", v: [`${anio}   ·   ${filas.length} ${filas.length === 1 ? "competencia" : "competencias"}`] }, { t: "enc", v: cols });
    const a = R.length + 1; if (!filas.length) R.push({ t: "nada", v: ["Sin competencias"] });
    filas.forEach((v, n) => R.push({ t: "dato", v, par: n % 2 })); const b = R.length;
    R.push({ t: "subtotal", v: [`TOTAL ${anio}`, "", "", `=SUM(D${a}:D${b})`, "", `=SUM(F${a}:F${b})`, `=SUM(G${a}:G${b})`, `=SUM(H${a}:H${b})`], monedas: [5, 6, 7] });
    totales.push(R.length); R.push({ t: "vacio", v: [] });
    if (y === 0 && filas.length) graf = { titulo: `Cobrado y por cobrar · ${anio}`, dominio: [a - 1, b, 0], series: [[a - 1, b, 6], [a - 1, b, 7]], apilada: true };
  });
  const T = c => totales.length ? "=" + totales.map(f => `${c}${f}`).join("+") : 0;
  R[2].v = ["Te deben (todo)", T("H"), "Cobrado (todo)", T("G"), "Competencias", String(porAnio.reduce((t, x) => t + x.filas.length, 0))];
  if (graf) graf.fila = R.length + 1;
  return { R, cols: cols.length, editables: [], monedas: [5, 6, 7], anchos: [240, 120, 120, 80, 105, 115, 115, 120, 20], color: COLOR.comp, resumen: true, congelar: 3,
    kpiFmt: { 1: "MONEDA", 3: "MONEDA", 5: "NUMERO" }, kpiRojo: [[2, 1]], rojas: [7], grafica: graf };
}
/* Gráfica de columnas debajo de la tabla. */
function grafica(sheetId, g) {
  const src = ([r1, r2, c]) => ({ sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c, endColumnIndex: c + 1 });
  return { addChart: { chart: { spec: { title: g.titulo, titleTextFormat: { fontFamily: "Roboto", bold: true, fontSize: 13 }, fontName: "Roboto",
    basicChart: { chartType: "COLUMN", legendPosition: "BOTTOM_LEGEND", headerCount: 1, stackedType: g.apilada ? "STACKED" : "NOT_STACKED",
      axis: [{ position: "BOTTOM_AXIS" }, { position: "LEFT_AXIS" }],
      domains: [{ domain: { sourceRange: { sources: [src(g.dominio)] } } }],
      series: g.series.map((s2, k) => ({ series: { sourceRange: { sources: [src(s2)] } }, targetAxis: "LEFT_AXIS", color: color(["#0B6E72", "#C9A227", "#A33227"][k] || "#1B3A5F") })) } },
    position: { overlayPosition: { anchorCell: { sheetId, rowIndex: g.fila, columnIndex: 0 }, widthPixels: 760, heightPixels: 340 } } } } };
}

/* ------------------------------------------------------------ armar los datos */
function filasPagos(perfil, alumnos, semanas) {
  const filas = [];
  for (const [aid, a] of Object.entries(alumnos)) {
    if (!a || a.borrado) continue;
    const paqs = (a.paquetes || []).slice().sort((x, y) => String(y.fecha || "").localeCompare(String(x.fecha || "")));
    const saldo = saldoAlumno(a, aid, semanas);
    paqs.forEach((p, n) => filas.push({ clave: `${perfil}|${aid}|${p.id}`, mes: String(p.fecha || "").slice(0, 7),
      valores: [p.fecha || "", a.nombre || "", Number(p.clases) || 0, p.monto == null ? "" : Number(p.monto), p.pagado ? "Sí" : "No", metodoTxt(p.metodo), n === 0 ? saldo : "", `${perfil}|${aid}|${p.id}`],
      exp: { m: p.monto == null ? null : Number(p.monto), p: !!p.pagado, f: p.metodo || "" } }));
  }
  return filas.sort((x, y) => String(x.valores[0]).localeCompare(String(y.valores[0])) || String(x.valores[1]).localeCompare(String(y.valores[1])));
}
function filasDeComp(c, inscs, nombres, caballos) {
  return Object.values(inscs).filter(i => i.competenciaId === c.id).map(i => {
    const k = cuentaInscripcion(i, c);
    const metodos = [...new Set((i.pagos || []).map(p => metodoTxt(p.metodo)).filter(Boolean))];
    const prs = (i.pruebas || []).slice().sort((x, y) => `${x.fecha}${x.hora}`.localeCompare(`${y.fecha}${y.hora}`));
    const detalle = prs.map(p => [fechaCorta(p.fecha), horaTxt(p.hora), p.categoria, p.caballoId ? (caballos[p.caballoId] || {}).nombre : p.caballoTxt].filter(Boolean).join(" · ")).join("\n");
    return { clave: `comp|${i.id}`, nombre: nombres[i.alumnoId] || "Alumno borrado",
      valores: [nombres[i.alumnoId] || "Alumno borrado", MAESTROS[i.maestro] || "", prs.length, k.total, k.pagado, null, null, metodos.length === 1 ? metodos[0] : metodos.join(" y "), detalle, `comp|${i.id}`],
      exp: { pagado: k.pagado, f: metodos.length === 1 ? metodos[0] : "" } };
  }).sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
}

/* ------------------------------------------------------------ escribir un archivo */
async function escribirArchivo(token, id, tipoArchivo, pestanas, resumen, anteriores = []) {
  // pestanas: [{ titulo, plan }] en orden; resumen: plan del resumen; anteriores: pestañas que la agenda creó antes
  const meta = await google(token, `/${id}?fields=properties.title,sheets(properties(sheetId,title,index),conditionalFormats,charts(chartId),bandedRanges(bandedRangeId),protectedRanges(protectedRangeId))`);
  const hojas = meta.sheets || [];
  const porTitulo = Object.fromEntries(hojas.map(h => [h.properties.title, h]));
  const todas = [{ titulo: "Resumen", plan: resumen }, ...pestanas];
  const faltan = todas.filter(x => !porTitulo[x.titulo]);
  const pre = [];
  if (meta.properties && meta.properties.title !== TITULO_ARCHIVO[tipoArchivo]) pre.push({ updateSpreadsheetProperties: { properties: { title: TITULO_ARCHIVO[tipoArchivo] }, fields: "title" } });
  faltan.forEach(x => pre.push({ addSheet: { properties: { title: x.titulo } } }));
  let ids = Object.fromEntries(hojas.map(h => [h.properties.title, h.properties.sheetId]));
  if (pre.length) {
    const r = await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: pre }) });
    (r.replies || []).forEach(x => { if (x && x.addSheet) ids[x.addSheet.properties.title] = x.addSheet.properties.sheetId; });
  }
  // Limpiar el formato anterior de nuestras pestañas y borrar las viejas o la vacía de Google
  const limpiar = [];
  for (const x of todas) {
    const h = porTitulo[x.titulo]; const sid = ids[x.titulo];
    (h && h.bandedRanges || []).forEach(b => limpiar.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } }));
    (h && h.charts || []).forEach(g => limpiar.push({ deleteEmbeddedObject: { objectId: g.chartId } }));
    (h && h.protectedRanges || []).forEach(q => limpiar.push({ deleteProtectedRange: { protectedRangeId: q.protectedRangeId } }));
    for (let k = ((h && h.conditionalFormats) || []).length - 1; k >= 0; k--) limpiar.push({ deleteConditionalFormatRule: { sheetId: sid, index: k } });
    limpiar.push({ unmergeCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 3000 } } },
      { setDataValidation: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 3000 } } },
      { updateBorders: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 3000, startColumnIndex: 0, endColumnIndex: 26 }, top: { style: "NONE" }, bottom: { style: "NONE" }, innerHorizontal: { style: "NONE" } } },
      { repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 3000 }, cell: { userEnteredFormat: {} }, fields: "userEnteredFormat" } },
      { updateDimensionProperties: { range: { sheetId: sid, dimension: "COLUMNS", startIndex: 0, endIndex: 26 }, properties: { hiddenByUser: false }, fields: "hiddenByUser" } });
  }
  const actuales = new Set(todas.map(x => x.titulo));
  hojas.filter(h => !actuales.has(h.properties.title) && (VIEJAS.includes(h.properties.title) || anteriores.includes(h.properties.title) || (tipoArchivo === "comp" && /^\d{4}$/.test(h.properties.title))))
    .forEach(h => limpiar.push({ deleteSheet: { sheetId: h.properties.sheetId } }));
  if (limpiar.length) await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: limpiar }) });
  // Valores
  const ref = t => `'${t.replace(/'/g, "''")}'`;
  await google(token, `/${id}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: todas.map(x => `${ref(x.titulo)}!A1:Z3000`) }) });
  await google(token, `/${id}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED",
    data: todas.map(x => ({ range: `${ref(x.titulo)}!A1`, values: x.plan.R.map(r => r.v.length ? r.v : [""]) })) }) });
  // Formato y orden de las pestañas
  const fmt = [];
  todas.forEach((x, k) => { const sid = ids[x.titulo];
    fmt.push(...formatoPlan(sid, x.plan, tipoArchivo));
    if (x.plan.grafica) fmt.push(grafica(sid, x.plan.grafica));
    fmt.push({ updateSheetProperties: { properties: { sheetId: sid, index: k }, fields: "index" } }); });
  await google(token, `/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: fmt }) });
  return { url: `https://docs.google.com/spreadsheets/d/${id}/edit`, gids: Object.fromEntries(todas.map(x => [x.titulo, ids[x.titulo]])) };
}
/* Lee lo que hay en las pestañas de un archivo (para traer lo que se editó ahí). */
async function leerArchivo(token, id) {
  const meta = await google(token, `/${id}?fields=sheets.properties.title`);
  const titulos = (meta.sheets || []).map(h => h.properties.title).filter(t => t !== "Resumen");
  if (!titulos.length) return [];
  const q = titulos.map(t => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'!A1:L3000`)}`).join("&");
  const r = await google(token, `/${id}/values:batchGet?${q}&valueRenderOption=UNFORMATTED_VALUE`);
  return (r.valueRanges || []).flatMap(x => x.values || []);
}

/* ------------------------------------------------------------ sincronizar */
async function sincronizar(cfg, quien) {
  const cs = cuentaServicio(); if (!cs) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT en Vercel.");
  const P = cfg.pagos && cfg.pagos.spreadsheetId, C = cfg.comp && cfg.comp.spreadsheetId;
  if (!P && !C) throw new Error("Todavía no se conecta ninguna hoja.");
  const token = await tokenGoogle(cs);
  const exp = cfg.exportados || {};
  const datos = {
    tania: await leerColeccion("maestros/tania/alumnos"), edwin: await leerColeccion("maestros/edwin/alumnos"),
    comps: await leerColeccion("competencias"), inscs: await leerColeccion("inscripciones"), caballos: await leerColeccion("caballos"),
  };
  const nombres = {}; for (const p of ["tania", "edwin"]) for (const [aid, a] of Object.entries(datos[p])) nombres[aid] = a && a.nombre;
  // 1. Traer lo que se editó en las hojas desde la última vez
  const cambios = { tania: [], edwin: [] };
  if (P) {
    const filas = await leerArchivo(token, P); const tocados = { tania: {}, edwin: {} };
    for (const f of filas) {
      const clave = String(f[7] || ""); const e = exp[clave]; if (!e || !/^(tania|edwin)\|/.test(clave)) continue;
      const [perfil, aid, pid] = clave.split("|"); const a = datos[perfil][aid]; const p = a && (a.paquetes || []).find(x => x.id === pid); if (!p) continue;
      const m = numero(f[3]), pag = norm(f[4]) === "si" ? true : norm(f[4]) === "no" ? false : null, met = metodoDe(f[5]);
      const c = {};
      if (m !== e.m && !(m === null && e.m === null)) c.monto = m;
      if (pag !== null && pag !== e.p) c.pagado = pag;
      if (met !== null && met !== e.f) c.metodo = met; else if (met === null && String(f[5] || "") === "" && e.f) c.metodo = "";
      if (!Object.keys(c).length) continue;
      Object.assign(p, c); tocados[perfil][aid] = a;
      cambios[perfil].push(`Desde Google Sheets: ${a.nombre}, paquete de ${p.clases} clases (${p.fecha || "sin fecha"}): ${[
        c.pagado !== undefined ? (c.pagado ? "pagado" : "sin pagar") : "", c.metodo !== undefined ? (metodoTxt(c.metodo) || "sin forma de pago") : "",
        c.monto !== undefined ? (c.monto == null ? "sin monto" : `$${c.monto.toLocaleString("es-MX")}`) : ""].filter(Boolean).join(", ")}`);
    }
    for (const perfil of ["tania", "edwin"]) for (const [aid, a] of Object.entries(tocados[perfil])) await guardarDoc(`maestros/${perfil}/alumnos/${aid}`, a);
  }
  if (C) {
    const filas = await leerArchivo(token, C);
    for (const f of filas) {
      const clave = String(f[9] || ""); const e = exp[clave]; if (!e || !clave.startsWith("comp|")) continue;
      const i = datos.inscs[clave.slice(5)]; const c = i && datos.comps[i.competenciaId]; if (!c) continue;
      const pagado = numero(f[4]); if (pagado === null || pagado === e.pagado) continue;
      const dif = pagado - e.pagado; const met = metodoDe(f[7]) || "";
      i.pagos = [...(i.pagos || []), { id: nuevoId(), monto: dif, metodo: met, fecha: hoyMx(), nota: "desde Google Sheets" }];
      await guardarDoc(`inscripciones/${i.id}`, i); datos.inscs[i.id] = i;
      (cambios[i.maestro === "edwin" ? "edwin" : "tania"]).push(`Desde Google Sheets: ${dif > 0 ? "pago" : "ajuste"} de $${Math.abs(dif).toLocaleString("es-MX")}${met ? ` (${metodoTxt(met)})` : ""} de ${nombres[i.alumnoId] || "alumno"} en ${c.nombre}`);
    }
  }
  await anotarHistorial("tania", cambios.tania); await anotarHistorial("edwin", cambios.edwin);
  // 2. Escribir las hojas con los datos de la agenda
  const exportados = {}; const nuevo = { ...cfg, ultimo: Date.now(), por: quien || "", error: "", formato: 3 };
  if (P) {
    const semanas = { tania: await leerColeccion("maestros/tania/semanas"), edwin: await leerColeccion("maestros/edwin/semanas") };
    const todas = { tania: filasPagos("tania", datos.tania, semanas.tania), edwin: filasPagos("edwin", datos.edwin, semanas.edwin) };
    [...todas.tania, ...todas.edwin].forEach(x => { exportados[x.clave] = x.exp; });
    const meses = [...new Set([...todas.tania, ...todas.edwin].map(x => x.mes).filter(m => /^\d{4}-\d{2}$/.test(m)).concat(hoyMx().slice(0, 7)))].sort().reverse();
    const pestanas = meses.map(m => ({ titulo: mesTxt(m), plan: planMes(m, { tania: todas.tania.filter(x => x.mes === m), edwin: todas.edwin.filter(x => x.mes === m) }) }));
    const q = t => `'${t.replace(/'/g, "''")}'`;
    const resumen = planResumenPagos(pestanas.map(x => [x.titulo, `=${q(x.titulo)}!D${x.plan.subt.tania}`, `=${q(x.titulo)}!D${x.plan.subt.edwin}`, `=${q(x.titulo)}!D${x.plan.tot}`, `=${q(x.titulo)}!F${x.plan.tot}`, `=${q(x.titulo)}!B4`, `=${q(x.titulo)}!D4`]));
    nuevo.pagos = { ...cfg.pagos, ...(await escribirArchivo(token, P, "pagos", pestanas, resumen, Object.keys((cfg.pagos && cfg.pagos.gids) || {}))) };
  }
  if (C) {
    const comps = Object.values(datos.comps).filter(c => c && c.inicio).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
    const usados = new Set(["Resumen"]);
    const pestanas = comps.map(c => {
      let t = String(c.nombre || "Competencia").replace(/[\[\]*?:\\/]/g, " ").trim().slice(0, 90);
      if (usados.has(t)) t = `${t} (${fechaCorta(c.inicio)} ${String(c.inicio).slice(0, 4)})`; usados.add(t);
      const filas = filasDeComp(c, datos.inscs, nombres, datos.caballos);
      filas.forEach(f => { exportados[f.clave] = f.exp; });
      // Primero los que deben (de más a menos), luego los que ya pagaron
      filas.sort((x, y) => ((y.valores[3] - y.valores[4]) - (x.valores[3] - x.valores[4])) || x.nombre.localeCompare(y.nombre, "es"));
      return { titulo: t, c, alumnos: filas.length, plan: planCompetencia(c, filas) };
    });
    const q = t => `'${t.replace(/'/g, "''")}'`;
    const anios = [...new Set(comps.map(c => String(c.inicio).slice(0, 4)).concat(hoyMx().slice(0, 4)))].sort().reverse();
    const resumen = planResumenComp(anios.map(anio => ({ anio, filas: pestanas.filter(x => String(x.c.inicio).startsWith(anio)).slice().reverse()
      .map(x => [x.titulo, fechasLargas(x.c), x.c.lugar || "", x.alumnos, `=${q(x.titulo)}!F3`, `=${q(x.titulo)}!D${x.plan.tot}`, `=${q(x.titulo)}!E${x.plan.tot}`, `=${q(x.titulo)}!F${x.plan.tot}`]) })));
    nuevo.comp = { ...cfg.comp, ...(await escribirArchivo(token, C, "comp", pestanas, resumen, Object.keys((cfg.comp && cfg.comp.gids) || {}))) };
  }
  // 3. Recordar lo que se escribió, para saber después qué se editó en la hoja (se conservan claves de archivos no conectados)
  nuevo.exportados = { ...(P ? {} : Object.fromEntries(Object.entries(exp).filter(([k]) => !k.startsWith("comp|")))), ...(C ? {} : Object.fromEntries(Object.entries(exp).filter(([k]) => k.startsWith("comp|")))), ...exportados };
  if (!P) Object.keys(exp).forEach(k => { if (!k.startsWith("comp|")) nuevo.exportados[k] = exp[k]; });
  if (!C) Object.keys(exp).forEach(k => { if (k.startsWith("comp|")) nuevo.exportados[k] = exp[k]; });
  await guardarDoc("config/sheets", nuevo);
  return { cambios: cambios.tania.length + cambios.edwin.length };
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
/* La versión anterior tenía un solo archivo (cfg.spreadsheetId): se vuelve el de competencias. */
const PAGOS_INICIAL = "1laSiRqcSICtlM5IliFo_Zdg7Z5LPiN_27kAER-ASpwo"; // la hoja de pagos que Romina compartió con el robot
const migrar = cfg => {
  if (cfg.spreadsheetId && !cfg.pagos && !cfg.comp) { cfg = { ...cfg, comp: { spreadsheetId: cfg.spreadsheetId } }; delete cfg.spreadsheetId; delete cfg.url; delete cfg.gids; }
  if (!cfg.pagos && cfg.comp && cfg.comp.spreadsheetId !== PAGOS_INICIAL) cfg = { ...cfg, pagos: { spreadsheetId: PAGOS_INICIAL } };
  return cfg;
};
const hayHoja = cfg => !!((cfg.pagos && cfg.pagos.spreadsheetId) || (cfg.comp && cfg.comp.spreadsheetId));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const cs = cuentaServicio();
  if (req.method === "GET" && req.query && req.query.info) return res.status(200).json({ configurada: !!cs, correo: cs ? cs.client_email : "" });
  if (!SB() || !LLAVE()) return res.status(503).json({ error: "Falta la llave de servicio de Supabase en Vercel." });
  if (!cs) return res.status(503).json({ error: "Falta GOOGLE_SERVICE_ACCOUNT en Vercel." });
  let cfg = migrar((await leerDoc("config/sheets")) || {});
  // Si hay otra sincronización en curso (menos de 50 s), no se encima.
  const ocupado = () => cfg.enCurso && Date.now() - cfg.enCurso < 50000;
  const correr = async quien => {
    if (ocupado()) return res.status(200).json({ ok: true, ocupado: true });
    await guardarDoc("config/sheets", { ...cfg, enCurso: Date.now() });
    try { const r = await sincronizar(cfg, quien); return res.status(200).json({ ok: true, ...r }); }
    catch (e) { await guardarDoc("config/sheets", { ...cfg, enCurso: 0, error: e.message, errorEn: Date.now() }).catch(() => {}); return res.status(200).json({ ok: false, error: e.message }); }
  };
  if (req.method === "GET") { if (!esCron(req)) return res.status(401).json({ error: "No autorizado" }); if (!hayHoja(cfg)) return res.status(200).json({ ok: true, sinHoja: true }); return correr("automático"); }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const u = await usuarioDe(req); if (!u) return res.status(401).json({ error: "Tu sesión no tiene permiso. Vuelve a entrar." });
  const { accion, hoja, tipo } = req.body || {};
  if (accion === "conectar") {
    if (!u.dueno) return res.status(403).json({ error: "Solo la dueña de la agenda puede conectar las hojas." });
    if (tipo !== "pagos" && tipo !== "comp") return res.status(400).json({ error: "Falta decir qué hoja es." });
    const id = idHoja(hoja); if (!id) return res.status(400).json({ error: "Pega el enlace completo de la hoja de Google Sheets." });
    const otra = cfg[tipo === "pagos" ? "comp" : "pagos"];
    if (otra && otra.spreadsheetId === id) return res.status(400).json({ error: "Esa hoja ya se usa para la otra parte. Crea una hoja distinta." });
    cfg = { ...cfg, [tipo]: { spreadsheetId: id, conectadaPor: u.email, conectadaEn: Date.now() } };
    return correr(u.email);
  }
  if (accion === "sync") { if (!hayHoja(cfg)) return res.status(200).json({ ok: false, error: "Todavía no se conecta ninguna hoja." }); return correr(u.email); }
  return res.status(400).json({ error: "Acción desconocida" });
}
