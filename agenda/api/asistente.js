// Chat asistente de la agenda. La página manda la conversación (y fotos, si hay);
// aquí se revisa que quien escribe sea editor y se le pregunta a Claude con la
// llave de Anthropic, que solo vive en Vercel (nunca llega al navegador).
import Anthropic from "@anthropic-ai/sdk";

// Modelo: se puede cambiar sin tocar código con la variable ANTHROPIC_MODEL en Vercel
// (por ejemplo claude-haiku-5-5, que es mucho más barato).
const MODELO = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const ESFUERZO = process.env.ANTHROPIC_EFFORT || "low";
const MAX_IMAGENES = 5;

const SISTEMA = "Eres el asistente de una agenda de clases de equitación. Respondes únicamente con un objeto JSON válido, " +
  "sin texto antes ni después y sin bloques de código, con la forma que pide el primer mensaje.";

const client = new Anthropic(); // toma ANTHROPIC_API_KEY de las variables de entorno

async function editorDe(token) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !key) return false;
  const h = { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const u = await fetch(`${url}/auth/v1/user`, { headers: h });
  if (!u.ok) return false;
  const r = await fetch(`${url}/rest/v1/rpc/es_editor`, { method: "POST", headers: h, body: "{}" });
  return r.ok && (await r.json()) === true;
}

// Junta turnos seguidos del mismo rol y pone las fotos en el último mensaje.
function mensajesDe(turnos, imagenes) {
  const msgs = [];
  for (const t of turnos) {
    const role = t.role === "assistant" ? "assistant" : "user";
    const texto = String(t.content ?? "");
    const ultimo = msgs[msgs.length - 1];
    if (ultimo && ultimo.role === role) ultimo.content[0].text += "\n\n" + texto;
    else msgs.push({ role, content: [{ type: "text", text: texto }] });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const final = msgs[msgs.length - 1];
  if (final && final.role === "user" && imagenes.length) {
    const bloques = [];
    imagenes.forEach((img, i) => {
      bloques.push({ type: "text", text: `Imagen ${i + 1}:` });
      bloques.push({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } });
    });
    final.content = [...bloques, ...final.content];
  }
  return msgs;
}

function jsonDe(texto) {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(limpio); } catch (e) {}
  const a = limpio.indexOf("{"), b = limpio.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(limpio.slice(a, b + 1)); } catch (e) {} }
  return undefined;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "sampling_disabled" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try { if (!(await editorDe(token))) return res.status(401).json({ error: "session_expired" }); }
  catch (e) { return res.status(502).json({ error: "unavailable" }); }

  const { turnos, imagenes = [] } = req.body || {};
  if (!Array.isArray(turnos) || !turnos.length) return res.status(400).json({ error: "invalid_input" });
  const fotos = (Array.isArray(imagenes) ? imagenes : []).slice(0, MAX_IMAGENES)
    .filter(x => x && typeof x.data === "string" && /^image\/(jpeg|png|gif|webp)$/.test(x.media_type));

  const peticion = {
    model: MODELO,
    max_tokens: 16000,
    system: SISTEMA,
    output_config: { effort: ESFUERZO },
    messages: mensajesDe(turnos, fotos),
  };
  // En Opus, si un filtro de seguridad rechaza el mensaje por error, otro modelo lo vuelve a intentar.
  const conRespaldo = /^claude-(opus|fable|sonnet-5-5)/.test(MODELO);

  let r;
  try {
    r = conRespaldo
      ? await client.beta.messages.create({ ...peticion, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await client.messages.create(peticion);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "rate_limited" });
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return res.status(503).json({ error: "sampling_disabled" });
    if (e instanceof Anthropic.BadRequestError) return res.status(400).json({ error: /too long|too large|exceed/i.test(e.message) ? "prompt_too_large" : "invalid_input" });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: "unavailable" });
    return res.status(500).json({ error: "unknown" });
  }

  if (r.stop_reason === "refusal") return res.status(200).json({ error: "refused" });
  const texto = r.content.filter(b => b.type === "text").map(b => b.text).join("");
  const datos = jsonDe(texto);
  if (datos === undefined) return res.status(200).json({ error: r.stop_reason === "max_tokens" ? "prompt_too_large" : "invalid_json" });
  return res.status(200).json({ datos });
}
