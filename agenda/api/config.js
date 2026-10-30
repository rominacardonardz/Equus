// Datos públicos que necesita la página para conectarse. Se configuran en
// Vercel → Settings → Environment Variables. La llave de Anthropic NO va aquí.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  });
}
