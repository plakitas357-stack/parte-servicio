/* =========================================================
   Parte de servicio — copia local de la app
   Guarda la app en el móvil para que abra sin cobertura.
   NO guarda los partes: eso sigue en localStorage.

   Estrategia: primero red, y si no hay red, la copia guardada.
   Por eso NO hay que tocar este archivo al publicar una versión
   nueva: basta con reemplazar index.html en GitHub.
   ========================================================= */

var CACHE = "parte-servicio";
var BASE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(BASE); })
      .catch(function () { /* si algún archivo falla, seguimos igual */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(claves.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  ev.respondWith(
    fetch(req).then(function (res) {
      // hay red: se sirve lo último y se refresca la copia guardada
      if (res && res.status === 200) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return res;
    }).catch(function () {
      // sin red: se sirve la copia guardada
      return caches.match(req).then(function (m) {
        return m || caches.match("./index.html");
      });
    })
  );
});
