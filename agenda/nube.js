/* ==========================================================================
   Equus · conexión con la nube
   La agenda se escribió para claude.ai y le pide sus servicios con
   window.claude.use("db" | "user" | "sample" | "assets" | "downloads" | "mcp").
   Este archivo da esos mismos servicios con Supabase (datos, cuentas y
   comprobantes), con /api/asistente (el chat, con la API de Anthropic) y con
   Google Drive (la hoja de pagos). Así la agenda casi no cambia.
   ========================================================================== */
(function () {
  "use strict";
  let resolverListo;
  const Nube = window.EquusNube = { listo: new Promise(r => { resolverListo = r; }), correo: "", salir };
  let sb = null, cfg = null, yo = null, sesion = null;

  const clon = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const padre = p => p.replace(/\/[^/]+$/, "");
  const hoja = p => p.slice(p.lastIndexOf("/") + 1);
  const error = (code, message) => Object.assign(new Error(message || code), { code });
  const errorDe = e => {
    if (!e) return error("unknown");
    if (e.code === "42501" || /row-level security|permission/i.test(e.message || "")) return error("invalid_argument", "sin permiso");
    if (e.name === "TypeError" || /fetch|network/i.test(e.message || "")) return error("unavailable", "sin conexión");
    return error(e.code || "unknown", e.message);
  };

  /* --------------------------------------------------------------- arranque */
  async function iniciar() {
    try { cfg = await fetch("/api/config", { cache: "no-store" }).then(r => r.ok ? r.json() : null); } catch (e) { cfg = null; }
    cfg = cfg || window.EQUUS_CONFIG || null;
    if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
      // Sin Supabase configurado: guarda solo en este dispositivo (sirve para probar).
      window.claude = { use: async nombre => nombre === "downloads" ? downloads : null };
      resolverListo(); return;
    }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "equus-sesion" },
    });
    sb.auth.onAuthStateChange((_ev, s) => { sesion = s; });
    try { sesion = (await sb.auth.getSession()).data.session; } catch (e) { sesion = null; }
    if (!sesion) sesion = await pantallaEntrar();
    const { data, error: err } = await sb.from("editores").select("email,nombre,dueno");
    yo = !err && (data || []).find(e => e.email.toLowerCase() === String(sesion.user.email || "").toLowerCase());
    if (!yo) { pantallaSinAcceso(sesion.user.email); return; }
    Nube.correo = sesion.user.email;
    // Nombre de cada usuario, para mostrar en el Historial quién hizo cada cambio.
    sb.from("docs").upsert({ path: `usuarios/${sesion.user.id}`, data: { nombre: yo.nombre, email: yo.email }, updated_at: new Date().toISOString() }).then(() => {}, () => {});
    escucharCambios();
    window.claude = { use: async nombre => SERVICIOS[nombre] ? SERVICIOS[nombre]() : null };
    resolverListo();
  }

  async function salir() {
    if (sb) await sb.auth.signOut().catch(() => {});
    try { localStorage.removeItem("equus-google"); } catch (e) {}
    location.reload();
  }

  /* ------------------------------------------- entrar con correo y contraseña */
  function capa(html) {
    let el = document.getElementById("entrar");
    if (!el) { el = document.createElement("div"); el.id = "entrar"; document.body.appendChild(el); }
    el.innerHTML = `<div class="entrar-caja"><img class="entrar-logo" src="iconos/logo-clara.png" alt="Equus">${html}</div>`;
    return el;
  }
  function pantallaEntrar() {
    return new Promise(resolve => {
      const pedir = (correo, msg) => {
        const el = capa(`<h1>Agenda de alumnos</h1>
          <p>Entra con tu correo y tu contraseña.</p>
          <form id="f-entrar"><input id="e-correo" type="email" autocomplete="username" inputmode="email" required placeholder="Correo" value="${String(correo || "").replace(/[<>&"]/g, "")}">
          <input id="e-clave" type="password" autocomplete="current-password" required placeholder="Contraseña">
          <button type="submit">Entrar</button></form><p class="entrar-msg">${msg || ""}</p>`);
        const f = el.querySelector("#f-entrar");
        f.addEventListener("submit", async ev => {
          ev.preventDefault();
          const email = el.querySelector("#e-correo").value.trim(), password = el.querySelector("#e-clave").value;
          f.querySelector("button").disabled = true; el.querySelector(".entrar-msg").textContent = "Entrando…";
          let r;
          try { r = await sb.auth.signInWithPassword({ email, password }); } catch (e) { r = { error: e }; }
          if (r.error || !r.data || !r.data.session) {
            pedir(email, /fetch|network/i.test((r.error && r.error.message) || "") ? "No hay conexión. Revisa tu internet e intenta otra vez." : "El correo o la contraseña no son correctos.");
            return;
          }
          document.getElementById("entrar").remove();
          resolve(r.data.session);
        });
      };
      pedir("");
    });
  }
  function pantallaSinAcceso(correo) {
    const el = capa(`<h1>Sin acceso</h1><p>El correo <b>${String(correo).replace(/[<>&"]/g, "")}</b> no tiene permiso para usar la agenda.
      Pide a Romina que lo agregue.</p><button type="button" class="entrar-otro">Entrar con otro correo</button>`);
    el.querySelector(".entrar-otro").addEventListener("click", salir);
  }

  /* -------------------------------------------------------- datos (db) */
  const cache = new Map();          // ruta → datos
  const subsCol = new Map();        // colección → Set(fn)
  const subsDoc = new Map();        // ruta → Set(fn)
  const snapCol = col => {
    const docs = [];
    for (const [p, d] of cache) if (padre(p) === col) docs.push({ id: hoja(p), data: () => clon(d) });
    return { docs, size: docs.length, empty: !docs.length };
  };
  const snapDoc = p => ({ id: hoja(p), exists: cache.has(p), data: () => clon(cache.get(p)) });
  function avisar(p) {
    (subsCol.get(padre(p)) || []).forEach(fn => fn(snapCol(padre(p))));
    (subsDoc.get(p) || []).forEach(fn => fn(snapDoc(p)));
  }
  async function cargarCol(col) {
    const { data, error: err } = await sb.from("docs").select("path,data").eq("coleccion", col).limit(2000);
    if (err) throw errorDe(err);
    for (const p of [...cache.keys()]) if (padre(p) === col) cache.delete(p);
    (data || []).forEach(r => cache.set(r.path, r.data));
    (subsCol.get(col) || []).forEach(fn => fn(snapCol(col)));
  }
  async function cargarDoc(p) {
    const { data, error: err } = await sb.from("docs").select("path,data").eq("path", p).maybeSingle();
    if (err) throw errorDe(err);
    if (data) cache.set(p, data.data); else cache.delete(p);
    (subsDoc.get(p) || []).forEach(fn => fn(snapDoc(p)));
  }
  function recargarTodo() {
    for (const col of subsCol.keys()) if (subsCol.get(col).size) cargarCol(col).catch(() => {});
    for (const p of subsDoc.keys()) if (subsDoc.get(p).size) cargarDoc(p).catch(() => {});
  }
  function escucharCambios() {
    let caido = false;
    sb.channel("docs").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, ev => {
      if (ev.eventType === "DELETE") { const p = ev.old && ev.old.path; if (p) { cache.delete(p); avisar(p); } }
      else if (ev.new && ev.new.path) { cache.set(ev.new.path, ev.new.data); avisar(ev.new.path); }
    }).subscribe(estado => {
      if (estado === "SUBSCRIBED") { if (caido) recargarTodo(); caido = false; }
      else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") caido = true;
    });
    // Al volver a la app en el celular, trae lo que cambió mientras estaba en segundo plano.
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recargarTodo(); });
  }
  const suscribir = (mapa, clave, fn, cargar, err) => {
    if (!mapa.has(clave)) mapa.set(clave, new Set());
    mapa.get(clave).add(fn);
    cargar(clave).catch(e => { if (err) err(e); });
    return () => { const s = mapa.get(clave); if (s) s.delete(fn); };
  };
  const db = {
    collection: col => {
      const q = { limit: () => q, onSnapshot: (fn, err) => suscribir(subsCol, col, fn, cargarCol, err) };
      return q;
    },
    doc: p => ({
      onSnapshot: (fn, err) => suscribir(subsDoc, p, fn, cargarDoc, err),
      async get() { await cargarDoc(p); return snapDoc(p); },
      async set(datos) {
        const antes = cache.get(p);
        cache.set(p, clon(datos)); avisar(p);
        const { error: err } = await sb.from("docs").upsert({ path: p, data: datos, updated_at: new Date().toISOString() });
        if (err) { if (antes === undefined) cache.delete(p); else cache.set(p, antes); avisar(p); throw errorDe(err); }
      },
      async delete() {
        const antes = cache.get(p);
        cache.delete(p); avisar(p);
        const { error: err } = await sb.from("docs").delete().eq("path", p);
        if (err) { if (antes !== undefined) { cache.set(p, antes); avisar(p); } throw errorDe(err); }
      },
    }),
  };

  /* ------------------------------------------------------------ usuario */
  const user = {
    me: async () => ({ id: sesion.user.id, name: yo.nombre, email: yo.email }),
    can: async () => true,
    isOwner: async () => !!yo.dueno,
    async profiles(ids) {
      const { data } = await sb.from("docs").select("path,data").in("path", ids.map(id => `usuarios/${id}`));
      const r = {}; (data || []).forEach(x => { r[hoja(x.path)] = { name: x.data && x.data.nombre }; });
      return r;
    },
  };

  /* ---------------------------------------------- asistente (sample) */
  // Las fotos se achican antes de mandarlas: llegan más rápido y cuestan menos.
  async function imagenB64(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
      const k = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return { media_type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] };
    } finally { URL.revokeObjectURL(url); }
  }
  async function token() { const s = (await sb.auth.getSession()).data.session; return s && s.access_token; }
  const sample = async () => { throw error("not_supported"); };
  sample.limits = async () => ({ images: { maxCount: 5, mediaTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"] } });
  sample.json = async (turnos, opciones = {}) => {
    let imagenes = [];
    try { imagenes = await Promise.all((opciones.images || []).map(imagenB64)); }
    catch (e) { throw error("invalid_image", "No se pudo leer una de las imágenes"); }
    let r;
    try {
      r = await fetch("/api/asistente", {
        method: "POST", signal: opciones.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ turnos, imagenes }),
      });
    } catch (e) { throw error(e && e.name === "AbortError" ? "cancelled" : "unavailable"); }
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.error) throw error((j && j.error) || (r.status === 413 ? "prompt_too_large" : "unknown"));
    return j.datos;
  };

  /* ------------------------------------------ comprobantes (assets) */
  const urls = new Map(); let pedidas = new Set(), tPedir = null;
  const assets = {
    async upload(file, { type } = {}) {
      const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "application/pdf": "pdf" })[type] || "bin";
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      if (file.size > 20 * 1024 * 1024) throw error("too_large");
      const { error: err } = await sb.storage.from("comprobantes").upload(id, file, { contentType: type || file.type, upsert: false });
      if (err) throw error(/size|large/i.test(err.message) ? "too_large" : /quota/i.test(err.message) ? "quota_or_state" : "unknown", err.message);
      return { id, contentType: type || file.type };
    },
    async delete(id) { await sb.storage.from("comprobantes").remove([id]); urls.delete(id); },
    // Enlace temporal (1 hora) para ver un comprobante. Mientras llega se devuelve "#"
    // y, ya que llegan, se vuelve a dibujar la página.
    url(id) {
      const u = urls.get(id);
      if (u && u.vence > Date.now()) return u.url;
      pedidas.add(id); clearTimeout(tPedir);
      tPedir = setTimeout(async () => {
        const lista = [...pedidas]; pedidas = new Set();
        const { data } = await sb.storage.from("comprobantes").createSignedUrls(lista, 3600);
        (data || []).forEach(x => { if (x.signedUrl) urls.set(x.path, { url: x.signedUrl, vence: Date.now() + 3300 * 1000 }); });
        if (typeof window.render === "function") window.render();
      }, 30);
      return "#";
    },
  };

  /* ----------------------------------------------------- descargas */
  const downloads = {
    async save({ filename, data }) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
  };

  /* ------------------------------------------ Google Drive (mcp) */
  const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const g = { token: null, vence: 0, cliente: null, pendiente: null };
  try { const t = JSON.parse(localStorage.getItem("equus-google") || "null"); if (t && t.vence > Date.now()) Object.assign(g, t); } catch (e) {}
  const cargarGis = () => window.google && google.accounts ? Promise.resolve() : new Promise((ok, mal) => {
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.onload = ok; s.onerror = mal; document.head.appendChild(s);
  });
  // Se llama directo desde el botón (Google solo abre su ventana si viene de un toque).
  function conectarGoogle() {
    if (g.token && g.vence > Date.now() + 60000) return Promise.resolve(g.token);
    if (g.pendiente) return g.pendiente;
    g.pendiente = new Promise((ok, mal) => {
      const pedir = () => {
        if (!g.cliente) g.cliente = google.accounts.oauth2.initTokenClient({
          client_id: cfg.googleClientId, scope: "https://www.googleapis.com/auth/drive.file",
          callback: r => {
            g.pendiente = null;
            if (!r || r.error || !r.access_token) { g.mal && g.mal(error("popup_closed")); return; }
            g.token = r.access_token; g.vence = Date.now() + (Number(r.expires_in) || 3600) * 1000;
            try { localStorage.setItem("equus-google", JSON.stringify({ token: g.token, vence: g.vence })); } catch (e) {}
            g.ok && g.ok(g.token);
          },
          error_callback: () => { g.pendiente = null; g.mal && g.mal(error("popup_closed")); },
        });
        g.ok = ok; g.mal = mal;
        g.cliente.requestAccessToken({ prompt: "" });
      };
      if (window.google && google.accounts) pedir();
      else cargarGis().then(pedir, () => { g.pendiente = null; mal(error("server_unavailable")); });
    });
    return g.pendiente;
  }
  async function tokenGoogle() {
    if (g.token && g.vence > Date.now() + 60000) return g.token;
    if (g.pendiente) return g.pendiente;
    throw error("needs_reauth");
  }
  async function api(url, opciones = {}) {
    const t = await tokenGoogle();
    let r;
    try { r = await fetch(url, { ...opciones, headers: { ...(opciones.headers || {}), Authorization: `Bearer ${t}` } }); }
    catch (e) { throw error("server_unavailable"); }
    if (r.status === 401) { g.token = null; try { localStorage.removeItem("equus-google"); } catch (e) {} throw error("needs_reauth"); }
    if (!r.ok) throw error("tool_error", `Drive respondió ${r.status}`);
    return r;
  }
  const deB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const aB64 = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const archivo = j => ({ payload: { id: j.id, viewUrl: j.webViewLink } });
  const herramientas = {
    async create_file(a) {
      if (!a.base64Content) {
        const r = await api("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: a.title, mimeType: a.contentMimeType, ...(a.parentId ? { parents: [a.parentId] } : {}) }),
        });
        return archivo(await r.json());
      }
      // Excel → se convierte en hoja de Google Sheets al subirlo.
      const meta = { name: a.title, mimeType: a.contentMimeType === XLSX ? "application/vnd.google-apps.spreadsheet" : a.contentMimeType, ...(a.parentId ? { parents: [a.parentId] } : {}) };
      const b = "equus" + Math.random().toString(36).slice(2);
      const cuerpo = new Blob([
        `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${a.contentMimeType}\r\n\r\n`,
        deB64(a.base64Content), `\r\n--${b}--`]);
      const r = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
        method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body: cuerpo,
      });
      return archivo(await r.json());
    },
    async download_file_content(a) {
      const r = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(a.fileId)}/export?mimeType=${encodeURIComponent(a.exportMimeType || XLSX)}`);
      return { payload: { id: a.fileId, content: aB64(await r.arrayBuffer()) } };
    },
    async trash_file(a) {
      await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(a.fileId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }),
      });
      return { payload: { id: a.fileId } };
    },
  };
  const mcp = {
    conectar: conectarGoogle,
    async callTool(_servidor, nombre, args) {
      if (!herramientas[nombre]) throw error("tool_error");
      return herramientas[nombre](args || {});
    },
  };

  const SERVICIOS = {
    db: () => db, user: () => user, sample: () => sample, assets: () => assets, downloads: () => downloads,
    mcp: () => (cfg.googleClientId && yo.dueno ? mcp : null),
  };

  iniciar().catch(() => resolverListo());
})();
