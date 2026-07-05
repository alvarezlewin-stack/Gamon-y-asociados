# Migraciones de IndexedDB — LexFlow Bolivia

Este documento registra **todas** las versiones del esquema de la base de datos (`gamon-agenda-db`). Es obligatorio actualizarlo en cada cambio de `DB_VERSION` dentro de `storage-service.js`, antes de subir el código a producción.

---

## Versión 1 — Base original (Agenda Gamón & Asociados)

**Fecha:** Iteración 1 del proyecto (migración desde `localStorage`).

**Stores existentes:**
| Store | keyPath | Índices |
|---|---|---|
| `clients` | `id` | ninguno |
| `events` | `id` | ninguno |
| `notes` | `id` | ninguno |

**Cambios realizados:** creación inicial de la base de datos + migración automática y transparente de los datos que antes vivían en `localStorage` (clave `gamon-agenda-data-v1`).

**Compatibilidad:** ninguna base previa — es la versión fundacional.

**Estrategia de migración:** al detectar que `IndexedDB` está vacía y existe la clave vieja de `localStorage`, se copian los registros una sola vez (`putAll`) y se marca con la clave `gamon-agenda-migrated-v1`. La copia vieja se borra después de migrar con éxito (para evitar el riesgo de resucitar datos obsoletos si la marca de migración se perdiera alguna vez sin perder la copia — ver `VERIFICACION-PWA.md`, sección 12).

**Estrategia de rollback:** ninguna necesaria — es la base fundacional, no reemplaza nada.

---

## Versión 2 — Infraestructura del módulo Procesos (Arquitectura 0.7)

**Fecha:** Iteración de infraestructura, sin pantallas nuevas (solo datos).

**Stores existentes (acumulado, v1 + nuevos):**

| Store | keyPath | Índices | Propósito |
|---|---|---|---|
| `clients` | `id` | ninguno | sin cambios de v1 |
| `events` | `id` | ninguno | sin cambios de v1 |
| `notes` | `id` | ninguno | sin cambios de v1 |
| `instituciones` | `id` | `tipoInstitucionId` | Juzgados, fiscalías y otras entidades |
| `personas` | `id` | `institucionId` | Jueces, fiscales, secretarios, contrapartes (sin campo `tipo` — el rol vive en `proceso_partes`) |
| `procesos` | `id` | `estadoProcesalId`, `materiaId`, `institucionId`, `nurej` | Núcleo del sistema |
| `proceso_partes` | `id` | `procesoId`, `clienteId`, `personaId` | Entidad puente: quién participa en cada proceso y con qué rol |
| `materias` | `id` | `codigo`, `activo` | Catálogo |
| `tipos_proceso` | `id` | `materiaId`, `codigo`, `activo` | Catálogo (depende de Materia) |
| `estados_procesales` | `id` | `codigo`, `activo` | Catálogo |
| `tipos_actuacion` | `id` | `codigo`, `activo` | Catálogo |
| `tipos_documento` | `id` | `codigo`, `activo` | Catálogo |
| `tipos_institucion` | `id` | `codigo`, `activo` | Catálogo |
| `delitos` | `id` | `codigo`, `activo` | Catálogo (solo aplica si Materia = Penal) |

**Justificación de cada índice nuevo:**
- `procesos.estadoProcesalId` / `materiaId` / `institucionId`: consultas de listado y dashboard ("procesos en tal estado") son las más frecuentes del sistema — sin índice, cada una recorrería toda la tabla.
- `procesos.nurej`: búsqueda directa por número de expediente.
- `proceso_partes.procesoId`: la consulta más repetida de todas ("las partes de este proceso").
- `proceso_partes.clienteId`: reemplaza el `clienteId` fijo que tenía `Proceso` en el diseño v1 — permite "todos los procesos de este cliente" sin duplicar el dato en `Proceso`.
- `proceso_partes.personaId`: "todos los procesos donde participa esta persona" (ej. este juez).
- `personas.institucionId`: "todas las personas de esta institución".
- `instituciones.tipoInstitucionId`: filtrar por tipo (juzgados vs. fiscalías).
- Catálogos (`codigo`, `activo`): búsqueda por código estable y filtrado de solo-activos sin traer registros dados de baja lógica.

**Cambios realizados:**
1. Se agregaron los 11 stores nuevos (todos vacíos al finalizar esta iteración).
2. Se extendió `StorageService` con `getByIndex`, `getMany`, `exists`, `count`, `generateId` — sin modificar `getAll`/`put`/`remove` existentes.
3. Se cambió el generador de IDs (`uid()` en `app.js`) para usar `crypto.randomUUID()` en vez de un identificador basado en `Math.random()` + timestamp. **Los IDs ya existentes no se migran** (no es necesario: solo los IDs nuevos deben ser UUID a partir de ahora).
4. Se sembraron datos mínimos de validación en los catálogos (2 materias, 2 estados procesales, 2 tipos de institución, 2 tipos de actuación, 1 tipo de documento, 1 delito) — **no es un catálogo real todavía**, es solo para confirmar que la arquitectura funciona de punta a punta. El catálogo completo se cargará en una iteración dedicada a las pantallas de configuración.

**Compatibilidad:** total con la v1. Ningún store existente cambia de forma ni pierde datos. `onupgradeneeded` verifica la existencia de cada store y de cada índice antes de crearlos (`if (!db.objectStoreNames.contains(...))` / `if (!store.indexNames.contains(...))`), por lo que correr esta migración sobre una base v1 con datos reales es seguro.

**Estrategia de migración:** declarativa (objeto `SCHEMA` en `storage-service.js`) — cada versión futura solo necesita sumar entradas nuevas a ese esquema y subir `DB_VERSION`; el código de `onupgradeneeded` no necesita reescribirse.

**Estrategia de rollback:** si algo falla, revertir `storage-service.js`, `app.js` y `service-worker.js` a la versión anterior. Como los stores nuevos quedan vacíos hasta que se construyan sus pantallas, no hay pérdida de datos de negocio real en un rollback — como máximo se pierden los 10 registros de siembra mínima de validación, que son descartables por diseño.

**Cómo verificar que la migración fue correcta:**
1. Abrir la app con datos reales ya cargados (clientes/eventos/notas existentes).
2. Confirmar que siguen apareciendo igual que antes.
3. Con la computadora conectada por USB (`chrome://inspect` → Application → IndexedDB → `gamon-agenda-db`), confirmar que aparecen los 11 stores nuevos, todos con sus índices, y los catálogos con los registros mínimos de siembra.
