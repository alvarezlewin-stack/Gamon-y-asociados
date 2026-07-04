# Arquitectura PWA — Gamón & Asociados / LexFlow Bolivia

**Última actualización:** Etapa D (post-auditoría técnica).
**Repositorio:** `alvarezlewin-stack/Gamon-y-asociados`
**URL en producción:** `https://alvarezlewin-stack.github.io/Gamon-y-asociados/`

Este documento explica cómo funciona la capa PWA de la aplicación, para que cualquier desarrollador (humano o IA) pueda entenderla y modificarla sin romper nada.

---

## 1. Filosofía de despliegue

Este proyecto **no usa build tools** (sin Vite, sin Webpack, sin npm install). Todos los archivos que ves en el repositorio son exactamente los que se sirven en producción, sin transformación previa. Esto es una decisión deliberada: el mantenedor actual del proyecto sube archivos manualmente desde un celular Android usando la interfaz web de GitHub, sin acceso a terminal.

**Consecuencia práctica:** cualquier archivo nuevo que se agregue al proyecto debe:
1. Ser JavaScript/HTML/CSS que el navegador pueda ejecutar tal cual (sin JSX sin compilar, sin `import`/`export` de ES Modules salvo que se declare `type="module"` explícitamente).
2. Subirse manualmente al repositorio.
3. Agregarse a la lista `APP_SHELL` del Service Worker si necesita estar disponible offline (ver sección 4).

---

## 2. Archivos del proyecto y su rol

| Archivo | Rol |
|---|---|
| `index.html` | Punto de entrada. Carga React/ReactDOM/Tailwind desde CDN, enlaza el manifest, registra el Service Worker, monta la app en `<div id="root">`. |
| `app.js` | Toda la lógica de la aplicación (componentes React, estado, funciones). Compilado desde JSX a `React.createElement` de antemano (ver sección 6), no se compila en el navegador. |
| `manifest.json` | Metadata de instalación: nombre, íconos, colores, modo de visualización. |
| `service-worker.js` | Lógica de caché y funcionamiento offline. |
| `logo.jpg`, `icon-*.png`, `favicon.png` | Recursos visuales de marca. |

Todos los archivos están en la **raíz del repositorio, sin subcarpetas** — esto fue deliberado para simplificar la subida manual de archivos desde el selector de archivos de Android (que no maneja bien la selección de carpetas completas).

---

## 3. Registro del Service Worker

En `index.html`, al final del `<body>`:

```html
<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
</script>
```

- Se registra recién en el evento `load` (no bloquea la primera carga de la página).
- Si el registro falla (navegador viejo, error de red), la app sigue funcionando online igual — el `.catch()` silencioso es intencional.
- La ruta es relativa (`"service-worker.js"`), por lo que el **scope del Service Worker queda limitado a la carpeta donde vive el archivo** — en este caso, toda la app, porque está en la raíz.

---

## 4. Estrategia de caché y `APP_SHELL`

### ¿Qué es el `APP_SHELL`?
Es la lista de archivos que se descargan y guardan en caché **apenas se instala el Service Worker por primera vez**, antes de que el usuario los pida. Es el "esqueleto mínimo" para que la app pueda arrancar sin internet.

```js
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./logo.jpg",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.png",
];
```

🟧 **Regla obligatoria:** si agregás un archivo nuevo al proyecto (por ejemplo, un módulo nuevo como `procesos.js`, o un ícono nuevo), **tenés que sumarlo a esta lista a mano**. Esta lista NO se genera sola. Si te olvidás, ese archivo específico no va a estar disponible cuando el usuario esté sin internet (aunque sí va a funcionar con internet, porque la estrategia de red cubre ese caso — ver siguiente sección).

### Estrategia de caché: "Red primero, caché de respaldo"

```js
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

**Cómo funciona, paso a paso:**
1. Cada vez que el navegador pide un archivo (HTML, JS, imagen, fuente, lo que sea), el Service Worker intenta traerlo **de internet primero**.
2. Si lo consigue, lo devuelve **y de paso actualiza la copia guardada** en caché con esta versión nueva.
3. Si falla (no hay internet), recién ahí busca la copia guardada y la devuelve.

**Por qué esta estrategia y no "caché primero":** la alternativa ("caché primero, red de respaldo") es más rápida pero tiene un defecto grave que ya sufrimos en este proyecto — si actualizás un archivo en el servidor, el usuario sigue viendo la versión vieja cacheada indefinidamente, porque el Service Worker nunca vuelve a pedirle nada a la red mientras la caché tenga una respuesta. Eso fue literalmente la causa del bug de pantalla negra con Babel: la versión vieja rota quedó atrapada en caché y las actualizaciones no llegaban. Con "red primero", cada visita con internet trae la versión más nueva automáticamente.

**Costo de esta decisión:** con buena conexión, cada carga hace una petición de red de más comparado con "caché primero" (imperceptible en la práctica). Es un trade-off correcto para una app que todavía se actualiza seguido.

---

## 5. Procedimiento para agregar archivos nuevos

Cuando sumes un módulo nuevo (por ejemplo, `procesos.js` para el módulo de Procesos):

1. **Crear el archivo** con el código correspondiente.
2. **Referenciarlo en `index.html`** con un `<script src="procesos.js"></script>` (antes de `app.js` si `app.js` depende de él, o después si es al revés — el orden de los `<script>` importa porque define el orden de ejecución).
3. **Agregarlo a `APP_SHELL`** en `service-worker.js`: `"./procesos.js"`.
4. **Subir a la vez** el archivo nuevo y los archivos modificados (`index.html`, `service-worker.js`) en el mismo "Commit changes" de GitHub — subirlos por separado puede dejar a la app en un estado intermedio roto si alguien la visita justo entre subida y subida.
5. **Bumpear la versión de caché** (ver sección 6) para forzar que los navegadores que ya visitaron la app antes descarten la caché vieja y tomen la nueva.

---

## 6. Publicación y actualización de versión

### Publicación (ya configurada, no requiere repetirse)
El repositorio tiene GitHub Pages activado: `Settings → Pages → Source: Deploy from a branch → main / (root)`. Cualquier archivo que se suba a la rama `main` se publica automáticamente en la URL pública en 1-2 minutos, sin pasos adicionales.

### Cómo se actualiza una versión

**Paso obligatorio en cada cambio de `service-worker.js` mismo, o de cualquier archivo del `APP_SHELL`:**

```js
const CACHE_NAME = "gamon-agenda-cache-v2"; // <- subir este número
```

**Por qué es necesario:** el navegador solo vuelve a ejecutar el ciclo `install` → `activate` de un Service Worker cuando detecta que el **archivo `service-worker.js` cambió de contenido byte a byte**. Si solo cambiás `app.js` pero no tocás `service-worker.js`, la estrategia "red primero" igual va a traer la versión nueva de `app.js` sin problema (no depende del número de versión para eso). **Pero** si necesitás forzar una limpieza total de la caché vieja (por ejemplo, si sacaste un archivo del `APP_SHELL` y no querés que quede huérfano en caché), subir el número de `CACHE_NAME` es lo que dispara ese "borrón y cuenta nueva":

```js
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
```

Esto borra cualquier caché con un nombre distinto al actual — por eso cambiar el número es lo que "invalida" todo lo viejo.

### Compilación de JSX (sin Babel en el navegador)

`app.js` no contiene JSX crudo — está **precompilado a `React.createElement`** antes de subirse, usando el compilador de TypeScript en el entorno de desarrollo (`tsc --jsx react`). Esto fue una decisión tomada después de que Babel Standalone (que traduce JSX en tiempo real en el navegador) falló en producción por un problema de carga de dependencias internas.

**Regla para el futuro:** cualquier archivo `.js` nuevo que contenga JSX debe pasar por el mismo proceso de compilación antes de subirse. Nunca se debe volver a depender de un compilador de JSX corriendo en el navegador del usuario final.

---

## 7. Capa de datos: StorageService + IndexedDB

Desde la Iteración 1, ningún módulo lee ni escribe `localStorage` o `IndexedDB` directamente para datos de negocio (clientes, eventos, notas). Todo pasa por `storage-service.js`, que expone:

```js
StorageService.init()                    // abre la base y migra datos viejos (una sola vez)
StorageService.getAll(storeName)         // devuelve todos los registros de una colección
StorageService.put(storeName, record)    // crea o actualiza un registro (por su "id")
StorageService.remove(storeName, id)     // elimina un registro
```

**Colecciones actuales (`storeName`):** `"clients"`, `"events"`, `"notes"`.

**Migración automática:** la primera vez que un usuario abre esta versión, `StorageService.init()` detecta si hay datos viejos en `localStorage` (clave `gamon-agenda-data-v1`) y los copia a `IndexedDB` sin intervención del usuario. El `localStorage` viejo no se borra — queda como respaldo silencioso. La migración no se repite (se marca con la clave `gamon-agenda-migrated-v1`).

**Por qué esta capa importa para el futuro:** el día que se migre a un servidor propio (Supabase u otro), solo hay que reescribir el contenido de `storage-service.js` para que hable con una API en vez de con `IndexedDB`. Las pantallas (`app.js`) no deberían necesitar ningún cambio, porque solo conocen `StorageService.getAll/put/remove`, no cómo están implementados por dentro.

**Regla para módulos nuevos (Procesos, Actuaciones, Documentos, etc.):** cada entidad nueva debe sumarse a la lista `STORES` dentro de `storage-service.js`, y usar siempre `StorageService.getAll/put/remove` — nunca acceder a `indexedDB` directamente desde otro archivo.

## 8. Checklist rápido antes de cada despliegue

- [ ] ¿Agregué algún archivo nuevo? → Sumarlo a `APP_SHELL` en `service-worker.js`.
- [ ] ¿El archivo nuevo tiene JSX? → Compilarlo a `React.createElement` antes de subir.
- [ ] ¿Cambié algo que requiere invalidar la caché vieja de todos los usuarios? → Subir el número de `CACHE_NAME`.
- [ ] ¿Subí todos los archivos relacionados en el mismo commit? → Evita estados intermedios rotos.
- [ ] ¿Probé el link público después de esperar 1-2 minutos? → GitHub Pages tarda en propagar.
