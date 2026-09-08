/* Equus — a qué proyecto se conecta la app.

   La llave publicable es pública a propósito: va en el navegador y no da
   acceso a nada por sí sola. Lo que protege los datos son las reglas de la
   base (backend/almacen.sql), que las aplica el servidor. La llave secreta
   NUNCA va aquí.

   dominioCuentas: en el club nadie entra con correo, se entra con usuario. La
   base sí necesita algo con forma de correo, así que la app le pega este
   dominio por detrás. TIENE QUE SER UN DOMINIO QUE EXISTA Y QUE SEA DEL CLUB:
   Supabase rechaza los inventados —comprobado: "cuentas.equus.mx" no se lo
   traga—, y poner uno ajeno le manda correos a un desconocido. Nadie va a
   recibir nada en estas direcciones, pero el dominio tiene que ser suyo.

   Mientras no haya dominio propio, se deja vacío: la app funciona guardando en
   cada aparato y lo dice en pantalla. */
window.EQUUS_NUBE = {
  url: "https://zegbggcxftytfdsnkdxu.supabase.co",
  llave: "sb_publishable_Rbmh47Y4_QHoEXcA8YmZ9w_miKkAX1x",
  dominioCuentas: "",          /* p. ej. "equusmty.com" cuando esté comprado */
};
