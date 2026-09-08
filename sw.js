/* Equus — service worker.
   La app se guarda para que abra al instante y aguante un rato sin señal, pero
   la red manda: si hay versión nueva, esa se usa. */
const CACHE = "equus-v2";   /* al subir el logo real */
const BASE = new URL("./", self.location).pathname;
const ESENCIALES = [BASE, BASE + "index.html", BASE + "manifest.json",
  BASE + "assets/logo.png", BASE + "assets/logo-claro.png",
  BASE + "assets/marca.png", BASE + "assets/marca-clara.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESENCIALES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* tipografías y demás: a la red */

  e.respondWith(
    fetch(req)
      .then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match(BASE + "index.html")))
  );
});
