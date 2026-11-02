// Enlace fijo a los Excel que la agenda mantiene al día en Supabase.
// /api/excel?f=pagos-tania|pagos-edwin|competencias[&mes=AAAA-MM]&k=CLAVE
// La clave está en config/excel (la genera la agenda). Se leen los archivos con
// la llave de servicio que Vercel tiene guardada; nunca llega al navegador.
import crypto from "node:crypto";

const ARCHIVOS = { "pagos-tania": "Pagos de Tania", "pagos-edwin": "Pagos de Edwin", competencias: "Competencias" };
const pagina = (res, codigo, texto) => res.status(codigo).setHeader("Content-Type", "text/html; charset=utf-8")
  .send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Equus · Excel</title>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#0B2B2C">
<h2 style="font-family:Georgia,serif">Equus · Excel</h2><p>${texto}</p></body>`);
const mesMexico = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave) return pagina(res, 503, "Falta conectar Supabase en Vercel (llave de servicio).");
  const { f = "", k = "", mes = "" } = req.query || {};
  if (!ARCHIVOS[f]) return pagina(res, 404, "Ese Excel no existe.");
  if (mes && !/^\d{4}-\d{2}$/.test(mes)) return pagina(res, 400, "El mes no es válido.");
  const h = { apikey: llave, Authorization: `Bearer ${llave}` };
  let clave = "";
  try {
    const r = await fetch(`${url}/rest/v1/docs?path=eq.config/excel&select=data`, { headers: h });
    const filas = r.ok ? await r.json() : [];
    clave = (filas[0] && filas[0].data && filas[0].data.clave) || "";
  } catch (e) { return pagina(res, 502, "No se pudo conectar con la base de datos. Intenta en un momento."); }
  const a = Buffer.from(String(k)), b = Buffer.from(String(clave));
  if (!clave || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return pagina(res, 403, "Este enlace ya no sirve. Pide el enlace nuevo a quien administra la agenda.");
  const nombre = f === "competencias" ? `competencias-${mes || mesMexico()}.xlsx` : `${f}.xlsx`;
  const o = await fetch(`${url}/storage/v1/object/comprobantes/excel/${nombre}`, { headers: h });
  if (o.status === 400 || o.status === 404) return pagina(res, 404, `Todavía no hay Excel de ${ARCHIVOS[f].toLowerCase()}${f === "competencias" ? ` de ${mes || mesMexico()}` : ""}. Abre la agenda, ve a Pagos → Excel y Google Drive y toca “Actualizar ahora”.`);
  if (!o.ok) return pagina(res, 502, "No se pudo leer el Excel. Intenta en un momento.");
  const buf = Buffer.from(await o.arrayBuffer());
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `inline; filename="${nombre}"`);
  return res.status(200).send(buf);
}
