"use strict";
/* ===========================================================================
   Equus — la conexión con la base del club.

   Esto es lo que hace que no importe desde qué teléfono se entre: los datos
   viven en un servidor, no en el aparato. Quien decide qué puede ver y tocar
   cada quien no es esta página —eso sería confiar en el navegador— sino las
   reglas de la base (backend/almacen.sql), que se aplican del lado del
   servidor y no se pueden saltar.

   La app maneja documentos: colecciones con un id y un objeto. La tabla
   almacen guarda justo eso, así que aquí no hay traducción de por medio.
   =========================================================================== */

window.Nube = {
  cliente: null,
  authId: null,
  correo: null,
  listo: false,
  cache: {},
  alCambiar: () => {},
  canal: null,

  get configurado() {
    const c = window.EQUUS_NUBE;
    /* Sin dominio propio no se pueden crear cuentas —Supabase rechaza los
       inventados—, así que la app se queda en modo local y lo dice, en vez de
       fallar al entrar sin explicar por qué. */
    return !!(c && c.url && c.llave && c.dominioCuentas && window.supabase);
  },

  /* Las cuentas de la base necesitan forma de correo, pero en el club nadie
     usa uno para entrar: se escribe el usuario y aquí se le pone el resto. */
  correoDe(usuario) {
    const dominio = (window.EQUUS_NUBE || {}).dominioCuentas;
    if (!dominio) throw new Error("Falta el dominio del club en supabase-config.js");
    return String(usuario).trim().toLowerCase() + "@" + dominio;
  },

  crearCliente(opciones) {
    const c = window.EQUUS_NUBE;
    return window.supabase.createClient(c.url, c.llave, opciones);
  },

  /* Devuelve true si ya había sesión abierta en este aparato. */
  async iniciar(alCambiar) {
    if (!this.configurado) return false;
    this.alCambiar = alCambiar || this.alCambiar;
    try {
      this.cliente = this.crearCliente({
        auth: { persistSession: true, autoRefreshToken: true },
      });
      const { data } = await this.cliente.auth.getSession();
      if (!data || !data.session) return false;
      await this.tomarSesion(data.session);
      return true;
    } catch (e) {
      console.warn("No se pudo conectar con la base del club:", e.message);
      this.cliente = null;
      return false;
    }
  },

  async tomarSesion(sesion) {
    this.authId = sesion.user.id;
    this.correo = sesion.user.email;
    await this.cargarTodo();
    this.escuchar();
    this.listo = true;
  },

  async entrar(usuario, clave) {
    if (!this.cliente) return false;
    const { data, error } = await this.cliente.auth.signInWithPassword({
      email: this.correoDe(usuario), password: String(clave),
    });
    if (error || !data.session) return false;
    await this.tomarSesion(data.session);
    return true;
  },

  async salir() {
    if (this.canal) { try { await this.cliente.removeChannel(this.canal); } catch (e) {} this.canal = null; }
    if (this.cliente) { try { await this.cliente.auth.signOut(); } catch (e) {} }
    this.authId = null; this.correo = null; this.listo = false;
    for (const k of Object.keys(this.cache)) this.cache[k] = {};
  },

  /* Alta de una persona. signUp deja al recién creado como sesión activa, así
     que se hace con un cliente aparte y desechable: dirección no pierde la
     suya. Requiere que en Supabase esté apagada la confirmación por correo,
     porque estos correos no existen. */
  async crearCuenta(usuario, clave) {
    const suelto = this.crearCliente({
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await suelto.auth.signUp({
      email: this.correoDe(usuario), password: String(clave),
    });
    if (error) throw new Error(error.message);
    return (data.user || {}).id || null;
  },

  async cargarTodo() {
    const { data, error } = await this.cliente
      .from("almacen").select("coleccion, doc_id, datos");
    if (error) throw new Error(error.message);
    const sig = {};
    for (const fila of data) {
      (sig[fila.coleccion] ||= {})[fila.doc_id] = fila.datos;
    }
    /* Las reservas de los demás no se ven, y está bien: nadie tiene por qué
       saber quién monta qué. Pero sí hace falta saber qué caballo está tomado
       para no apartarlo dos veces, y para eso está esta vista, que dice el
       caballo y la hora sin decir de quién es la clase. */
    const { data: ocup } = await this.cliente
      .from("ocupacion_app").select("doc_id, fecha, plantilla_id, caballo_id, hora, tipo_id");
    sig.reservas ||= {};
    for (const o of (ocup || [])) {
      if (sig.reservas[o.doc_id]) continue;          /* la mía, con todo su detalle */
      sig.reservas[o.doc_id] = { fecha:o.fecha, plantillaId:o.plantilla_id,
        caballoId:o.caballo_id, hora:o.hora, tipoId:o.tipo_id || "escuela", ajena:true };
    }
    this.cache = sig;
  },

  /* Cuando alguien cambia algo, a todos se les actualiza la pantalla. Si el
     aviso llega incompleto —una fila que ya no se puede ver— se recarga. */
  escuchar() {
    if (this.canal) return;
    this.canal = this.cliente.channel("almacen-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "almacen" }, async carga => {
        try {
          const fila = carga.new && carga.new.coleccion ? carga.new : carga.old;
          if (!fila || !fila.coleccion) return this.recargar();
          const col = (this.cache[fila.coleccion] ||= {});
          if (carga.eventType === "DELETE") delete col[fila.doc_id];
          else col[fila.doc_id] = fila.datos;
          this.alCambiar();
        } catch (e) { this.recargar(); }
      })
      .subscribe();
  },

  async recargar() {
    try { await this.cargarTodo(); this.alCambiar(); } catch (e) {}
  },

  todo(c) {
    /* El id va al final a propósito: manda el de la colección. Si un documento
       trae un campo id guardado, no debe tapar al de verdad. */
    return Object.entries(this.cache[c] || {}).map(([id, d]) => ({ ...d, id }));
  },

  async poner(c, id, datos) {
    const previo = (this.cache[c] || {})[id];
    (this.cache[c] ||= {})[id] = datos;                 /* que se vea ya */
    const { error } = await this.cliente.from("almacen")
      .upsert({ coleccion: c, doc_id: id, datos }, { onConflict: "coleccion,doc_id" });
    if (error) {
      if (previo) this.cache[c][id] = previo; else delete this.cache[c][id];
      throw new Error(error.message);
    }
  },

  async quitar(c, id) {
    const previo = (this.cache[c] || {})[id];
    delete (this.cache[c] || {})[id];
    const { error } = await this.cliente.from("almacen")
      .delete().eq("coleccion", c).eq("doc_id", id);
    if (error) { if (previo) this.cache[c][id] = previo; throw new Error(error.message); }
  },

  /* Aparta el lugar antes de escribir. Dos jinetes pueden pedir el mismo
     caballo en el mismo segundo: gana quien llega primero, y el otro se entera
     en vez de creer que lo tiene. Lo resuelve la llave de la tabla, no la
     página: un segundo INSERT con el mismo id sencillamente no entra. */
  async apartar(c, id, datos) {
    const { error } = await this.cliente.from("almacen")
      .insert({ coleccion: c, doc_id: id, datos });
    if (error) {
      if (error.code === "23505") return false;         /* alguien se adelantó */
      throw new Error(error.message);
    }
    (this.cache[c] ||= {})[id] = datos;
    return true;
  },
};
