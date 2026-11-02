// Datos públicos que necesita la página para conectarse. Se configuran en
// Vercel → Settings → Environment Variables. La llave de Anthropic NO va aquí.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    // El chat queda apagado salvo que en Vercel se ponga CHAT_ACTIVO = 1 (necesita créditos en Anthropic).
    chat: process.env.CHAT_ACTIVO === "1" && !!process.env.ANTHROPIC_API_KEY,
  });
}
