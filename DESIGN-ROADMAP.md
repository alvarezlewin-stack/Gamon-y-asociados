# DESIGN-ROADMAP.md — LexFlow Bolivia
Documento maestro de diseño. Fuente de verdad para toda decisión visual/UX.
Estado: Vivo. Solo se agrega, nunca se borra historial.

## 1. Identidad visual — v1.0 (aprobada)

**Fecha:** 2026-07-06
**Responsable:** Conversación de diseño (Principal Product Designer)

### Paleta
| Uso | Nombre | Hex |
|---|---|---|
| Fondo base | Base | #0A0C0F |
| Superficie / tarjeta | Card | #14171D |
| Borde / hairline | Hairline | #262B33 |
| Marca (dorado) | Gold | #C9A24B |
| Marca hover | Gold Bright | #E4C878 |
| Alerta | Danger | #C9564B |
| Éxito | Success | #4C9A6A |
| Información | Info | #4C7FC9 |
| IA | Purple | #9B7FC9 |

Motivo: el naranja/dorado saturado de la v0 leía como app Android estándar.
Se redujo saturación y se reservó el dorado solo para acentos y estados activos,
nunca como relleno de tarjetas. El púrpura se reserva exclusivamente para todo
lo relacionado a IA, para no confundirlo con el resto del sistema.

### Tipografía
- **Fraunces** (serif) — saludo, encabezados grandes, números destacados.
- **Public Sans** — UI general, cuerpo, botones.
- **IBM Plex Mono** — expedientes, horas, datos técnicos.

> Corrección (2026-07-06): el mockup inicial usó Manrope y JetBrains Mono. Al leer
> `PROJECT-CHARTER.md` se confirmó que la tipografía vigente es Fraunces + Public Sans +
> IBM Plex Mono. Se corrigió `lexflow-design-system.html`. No contradice el charter;
> corrige un mockup hecho antes de haberlo leído.

### Elemento de firma (signature)
"Docket rail": línea vertical con nodos que conecta cronologías (audiencias, actuaciones).
Reutilizado en Inicio, Proceso, Centro de Expediente y Centro de Agenda con el mismo lenguaje.

## 2. Decisiones de diseño — historial completo (nunca se borra)

| # | Decisión | Motivo | Estado |
|---|---|---|---|
| D-001 | Fondo casi-negro + dorado atenuado, no saturado | Elevar de "app Android" a "software ejecutivo" | ✅ Aprobado |
| D-002 | Docket rail como elemento de firma | Diferenciación visual única, ligada al dominio jurídico | ✅ Aprobado |
| D-003 | Tags de materia sin relleno sólido | Consistencia con sistema de tarjetas outline | ✅ Aprobado |
| D-004 | Doble marca siempre visible (LexFlow™ + estudio) | Requisito de negocio, multiestudio futuro | ✅ Aprobado |
| D-005 | Pantalla de Proceso (listado + expediente) reutiliza el docket rail como cronología del caso | Consistencia visual entre Inicio y Proceso | ✅ Aprobado |
| D-006 | Filtros de materia como chips, no dropdown | Más rápido de tocar en mobile, menos fricción | ✅ Aprobado |
| D-007 | Estados vacío y de carga (skeleton) incluidos desde la primera versión de Proceso | Evitar retrabajo cuando Claude A conecte datos reales | ✅ Aprobado |
| D-008 | Centro de Expediente: cabecera inteligente, timeline con íconos por tipo, panel de IA (copiloto, no chat), centro documental, flujo procesal, acciones rápidas, reserva de integraciones futuras | Directiva del proyecto: pasar de "pantallas aisladas" a "centros de trabajo" | ✅ Aprobado |
| D-009 | Centro de Agenda / Jornada Jurídica: vista del día cruzando todos los casos, vencimientos con semáforo de urgencia, bitácora del estudio | Complemento del Centro de Expediente | ✅ Aprobado |
| D-010 | El ítem "Actuaciones + Cronología" de `ROADMAP.md` se considera satisfecho por el timeline del Centro de Expediente (D-008) | Evitar diseñar dos veces la misma cronología | ✅ Aprobado |
| D-011 | Centro de Inteligencia Jurídica: consulta jurídica como barra de comando (no chat), radar de riesgos cruzado, cola de análisis documental, sugerencias globales, jurisprudencia reservada | Directiva explícita: "no diseñar un chat, diseñar un copiloto" | ✅ Aprobado |
| D-012 | Severidad de riesgo reutiliza el mismo semáforo de color que Vencimientos | Un solo lenguaje de urgencia en todo el sistema | ✅ Aprobado |
| D-013 | **Cierre oficial de fase D-001 a D-012.** Design System 1.0, Centro de Inicio, Centro de Expediente, Centro de Agenda y Centro de Inteligencia Jurídica quedan como identidad visual oficial. No se rediseñan sin autorización expresa. | Directiva de Dirección de Proyecto | ✅ Cierre de fase |
| D-014 | **Prioridad y Riesgo son atributos manuales** definidos por el abogado (no se calculan). Prioridad: Alta/Media/Baja. Riesgo: Alto/Medio/Bajo. La IA podrá sugerir un valor a futuro, nunca lo modifica sola. | Decisión de Dirección — el abogado conserva el control; resuelve pregunta abierta de D-008/D-011 | ✅ Aprobado |
| D-015 | **Bitácora evoluciona conceptualmente a Activity Log** (registro de actividad automático: procesos, actuaciones, documentos, cambios de estado, vencimientos, actividad de IA, sincronizaciones, auditoría). No se implementa todavía, solo se documenta como evolución futura. | Decisión de Dirección — resuelve la pregunta abierta sobre la fuente de datos de la Bitácora (D-009) | ✅ Documentado, sin implementar |
| D-016 | **Nueva misión: Biblioteca Oficial de Componentes** (`lexflow-component-library.html`). 22 categorías documentadas: Botones, Inputs, Selectores, Tablas, Tarjetas, Badges/Tags/Chips, Avatares, Navegación/Sidebar, Timeline, Modales, Alertas/Toasts, Paneles, Formularios, Buscador, Filtros, Paginación, Calendario, Estados (vacío/carga/error/skeleton), Confirmaciones, Indicadores de riesgo/prioridad, Componentes de IA, Reglas responsive. Cada uno con propósito, variantes, comportamiento y accesibilidad. | Fortalecer el sistema de diseño para facilitar la implementación, sin seguir diseñando pantallas nuevas | ✅ Entregado |

## 3. Estado de fase

**Fase de pantallas (D-001 a D-013): CERRADA.** Design System, Centro de Inicio, Proceso,
Centro de Expediente, Centro de Agenda y Centro de Inteligencia Jurídica son la identidad
visual oficial de LexFlow. No se rediseñan sin autorización expresa.

**Fase actual (desde D-016): Biblioteca Oficial de Componentes.** No se diseñan pantallas
nuevas; se documenta y consolida el sistema para que Claude A pueda implementar sobre una
base estable.

**En espera de autorización/arquitectura** (no forman parte del roadmap activo de diseño):
- Centro Documental (depende de la decisión de almacenamiento real de archivos)
- Reportes y Configuración (multiestudio)

## 4. Notas de coordinación

Este documento es propiedad de la conversación de **diseño**.
No contiene decisiones de arquitectura de datos, IndexedDB ni StorageService — esas viven en
`ARCHITECTURE.md` / `DECISION-LOG.md`, propiedad de la conversación de **backend**.
Si una decisión visual requiere un cambio de datos, se registra aquí y se notifica
explícitamente para su validación en la otra conversación.
