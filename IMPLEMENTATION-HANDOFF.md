# IMPLEMENTATION-HANDOFF.md — LexFlow Bolivia

Puente oficial entre `DESIGN-ROADMAP.md` (Claude B) y el código real (Claude A). Se actualiza cada vez que se implementa una pieza del diseño aprobado, marcando su estado.

## 1. Veredicto de compatibilidad técnica

**`lexflow-component-library.html` es 100% implementable con el stack actual, sin excepciones.** Revisé el archivo completo: HTML + CSS puro con variables (`:root { --bg, --gold, ... }`), Google Fonts vía `<link>`, cero JavaScript de terceros, cero build tools, cero `shadcn`/frameworks de componentes. No hay nada que negociar ni renunciar — el diseño respeta la filosofía "sin build" del proyecto tal cual está.

## 2. Hallazgo crítico — reconciliar ANTES de tocar pantallas

**La paleta en producción hoy no es la paleta v1.0 aprobada.**

| Token | Producción actual (`app.js`) | v1.0 aprobado (Claude B) |
|---|---|---|
| Fondo base | `#0B0B0A` | `#0A0C0F` |
| Superficie/tarjeta | `#18150F` | `#14171D` |
| Dorado (marca) | `#E3B23C` | `#C9A24B` |
| Texto principal | `#F3EDD9` | `#ECEDEF` |
| Alerta/urgente | `#C1443A` | `#C9564B` |
| Éxito | `#7C9473` | `#4C9A6A` |

No es un error — la identidad de marca maduró en la conversación de diseño (D-001: "el dorado saturado leía como app Android estándar") después de que production ya se había construido con la paleta original. **Acción requerida antes de implementar Fase 3:** actualizar los 6 valores en todo `app.js` (búsqueda y reemplazo directo, son hex fijos, no hay lógica que dependa de los valores exactos) para que Agenda/Clientes/Vencimientos/Notas —que van a seguir existiendo— no queden visualmente inconsistentes con las pantallas nuevas. Esto es un cambio de forma, no de comportamiento: cero riesgo funcional, alto riesgo de inconsistencia visual si se omite.

Tipografía: sin conflicto — `Fraunces` + `Public Sans` + `IBM Plex Mono` ya es exactamente lo que usa producción hoy.

## 3. Reconciliación de nomenclatura (el riesgo que el propio Claude B señaló)

Claude B trabaja con **CSS semántico + variables** (`.btn-primary`, `.card`, `var(--gold)`). Producción hoy usa **Tailwind (clases utilitarias) + estilos inline en objetos JS** (`style: { background: "#E3B23C" }` dentro de `React.createElement`). Son dos formas de escribir CSS que no se mezclan solas.

**Decisión tomada para el handoff:** en vez de reescribir toda la app a CSS semántico (riesgo alto, cero beneficio inmediato) o traducir todo el sistema de diseño a Tailwind a mano (pierde la documentación de Claude B como fuente de verdad), la resolución es:
1. Extraer las variables `:root` de `lexflow-component-library.html` a un archivo propio, `tokens.css`, cargado una sola vez en `index.html`.
2. Las pantallas **nuevas** (Centro de Expediente, Centro de Agenda, Centro de Inteligencia Jurídica) se construyen usando las clases semánticas de la biblioteca directamente (`.btn-primary`, `.badge-materia`, etc.), copiadas/adaptadas de `lexflow-component-library.html`.
3. Las pantallas **existentes** (Agenda, Clientes, Vencimientos, Notas) solo actualizan los valores hex (punto 2) — no se migran a CSS semántico en esta fase, para no arriesgar lo que ya funciona en producción con datos reales.

Esto evita reinterpretar el diseño pantalla por pantalla (el problema que Claude B identificó) sin forzar una reescritura riesgosa de código estable.

## 4. Qué SÍ se puede implementar ya (datos ya existen en el backend)

- **Docket rail / timeline:** puede alimentarse hoy con `Actuaciones` — **espera:** `Actuación` como store propio (no solo como concepto en `proceso-service.js`) todavía no fue construido como servicio de dominio. Falta `ActuacionService` antes de que el timeline tenga datos reales que mostrar. Hoy solo existe el registro de "cambio de estado" reutilizando el tipo `CAMBIO_ESTADO` (Decisión 3, Arquitectura 0.9) — no actuaciones generales.
- **Estados vacío/carga/skeleton (D-007):** implementables ya — no dependen de ningún dato nuevo.
- **Indicadores de riesgo/prioridad (D-012, D-014):** el modelo `Proceso` ya tiene `prioridad` y `riesgo` como campos fijos (`HIGH/MEDIUM/LOW`) — coincide exactamente con la decisión de que sean manuales, no calculados. Implementable ya.
- **Chips de materia (D-006):** el catálogo `materias` ya existe y tiene datos de siembra. Implementable ya.
- **Semáforo de Vencimientos:** ya existe en producción (la calculadora de plazos hábiles), reutilizable tal cual para D-012.

## 5. Qué NO se puede implementar todavía (falta backend)

- **Centro Documental:** ya señalado por ambas conversaciones — depende de la decisión de almacenamiento real de archivos (IndexedDB vs. servidor), todavía no tomada.
- **Reportes / Multiestudio:** depende del modelo de multiestudio, no diseñado en el backend todavía.
- **Panel de IA / Centro de Inteligencia Jurídica (D-011):** el diseño está aprobado como interfaz, pero no existe ningún `AIService` ni conexión a un modelo de IA — implementable únicamente como interfaz estática/de demostración hasta que exista esa capa.
- **Activity Log (D-015):** explícitamente documentado por Claude B como "no implementar todavía" — coincide con el estado real del backend (no hay un registro de actividad automático construido).
- **Timeline con datos reales de Actuaciones:** ver punto 4 — falta `ActuacionService`.

## 6. Próximo paso recomendado

1. Reconciliar la paleta (punto 2) — cambio aislado, bajo riesgo, alto valor de consistencia.
2. Crear `tokens.css` con las variables de Claude B.
3. Recién ahí: decidir con el Director cuál Centro se implementa primero (Inicio es el candidato lógico — no depende de ningún servicio nuevo, solo de datos que ya existen: Procesos, Clientes, Vencimientos).
4. `ActuacionService` como prerequisito de backend si se prioriza el Centro de Expediente antes que el Centro de Inicio.

## 7. Registro de estado (se actualiza a medida que se implemente)

| Pieza de diseño | Estado de implementación |
|---|---|
| Design System 1.0 (paleta, tipografía) | ✅ Reconciliado en `app.js`/`manifest.json`/`index.html` (Decisión 20) — pendiente cosmético: íconos PNG con el negro anterior |
| Biblioteca de Componentes (22 categorías) | ⏳ No implementada en producción todavía |
| Centro de Inicio | ⏳ No implementado |
| Centro de Expediente | ⏳ No implementado — `ActuacionService` YA EXISTE (Decisión 21), timeline ya tiene datos reales disponibles |
| Centro de Agenda | ⏳ No implementado |
| Centro de Inteligencia Jurídica | ⏳ No implementado — requiere `AIService` para funcionalidad real (interfaz sola es viable antes) |
