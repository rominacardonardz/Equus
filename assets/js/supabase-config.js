/* Equus — a qué proyecto se conecta la app.

   La llave publicable es pública a propósito: va en el navegador y no da
   acceso a nada por sí sola. Lo que protege los datos son las reglas de la
   base (backend/almacen.sql), que las aplica el servidor. La llave secreta
   NUNCA va aquí.

   dominioCuentas: en el club nadie entra con correo, se entra con usuario.
   La base sí necesita forma de correo, así que se le pega este dominio por
   detrás. No tiene que existir ni recibir nada. */
window.EQUUS_NUBE = {
  url: "https://zegbggcxftytfdsnkdxu.supabase.co",
  llave: "sb_publishable_Rbmh47Y4_QHoEXcA8YmZ9w_miKkAX1x",
  dominioCuentas: "cuentas.equus.mx",
};
