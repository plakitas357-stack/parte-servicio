/* =========================================================
   Parte de servicio — copia local de la app
   Guarda la app en el móvil para que abra sin cobertura.
   NO guarda los partes: eso sigue en localStorage.

   Estrategia: primero red, y si no hay red, la copia guardada.
   Por eso NO hay que tocar este archivo al publicar una versión
   nueva: basta con reemplazar index.html en GitHub.

   v3.5: con cobertura mala (sótano, parking, un palo de señal) la
   red no falla, se queda esperando. Antes eso dejaba la app en
   blanco un buen rato. Ahora, si tarda más de la cuenta, se sirve
   la copia guardada y la red sigue por detrás refrescándola.
   ========================================================= */

var CACHE = "parte-servicio";
var BASE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
var ESPERA = 3500;   // milisegundos antes de tirar de la copia guardada

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

// Corta la espera: o contesta la red antes de ESPERA, o se da por fallida.
function conTiempo(promesa, ms) {
  return new Promise(function (res, rej) {
    var t = setTimeout(function () { rej(new Error("la red tarda demasiado")); }, ms);
    promesa.then(
      function (v) { clearTimeout(t); res(v); },
      function (e) { clearTimeout(t); rej(e); }
    );
  });
}

// ignoreSearch: así ./index.html?algo también encuentra su copia guardada.
function desdeCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (m) {
    if (m) return m;
    return caches.match("./index.html").then(function (raiz) {
      return raiz || new Response(
        "<h1>Sin conexi\u00f3n</h1><p>La copia de la app todav\u00eda no est\u00e1 guardada en este m\u00f3vil. \u00c1brela una vez con cobertura.</p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    });
  });
}

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // La red se lanza igualmente y refresca la copia aunque hayamos
  // contestado ya con lo guardado: la próxima vez estará al día.
  var red = fetch(req).then(function (res) {
    if (res && res.status === 200) {
      var copia = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copia); }).catch(function () {});
    }
    return res;
  });
  red.catch(function () { /* sin red: no pasa nada, contesta la copia */ });

  ev.respondWith(
    conTiempo(red, ESPERA).catch(function () { return desdeCache(req); })
  );
});
