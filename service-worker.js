const CACHE_NAME = "gamon-agenda-cache-v12";

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./storage-service.js",
  "./i18n.js",
  "./perfil-usuario-service.js",
  "./validation-service.js",
  "./institution-service.js",
  "./persona-service.js",
  "./proceso-parte-service.js",
  "./proceso-service.js",
  "./smoke-test.js",
  "./manifest.json",
  "./logo.jpg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // En vez de "todo o nada" (cache.addAll), probamos archivo por archivo.
      // Así, si uno falla por una conexión inestable (ej. 3G débil), no tira
      // abajo la instalación completa del Service Worker.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.error("[SW] No se pudo precachear:", url, err);
            // Seguimos igual: ese archivo se cacheará más adelante,
            // la primera vez que se pida con éxito (estrategia "red primero").
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia: RED PRIMERO. Si hay internet, siempre trae la version mas nueva
// y la guarda. Si no hay internet, recien ahi usa lo que tenga guardado.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, copy).catch(() => {});
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
