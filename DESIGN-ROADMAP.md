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

Motivo: el naranja/dorado saturado de la v0 leía como app Android estándar.
Se redujo saturación y se reservó el dorado solo para acentos y estados activos,
nunca como relleno de tarjetas.

### Tipografía
- **Fraunces** (serif) — saludo, encabezados grandes, números destacados. Aporta carácter ejecutivo.
- **Public Sans** — UI general, cuerpo, botones.
- **IBM Plex Mono** — expedientes, horas, datos técnicos. Refuerza precisión legal.

> Corrección (2026-07-06): el mockup inicial usó Manrope y JetBrains Mono. Al leer
> `PROJECT-CHARTER.md` se confirmó que la tipografía vigente del proyecto es Fraunces +
> Public Sans + IBM Plex Mono. Se corrigió `lexflow-design-system.html` para alinearlo.
> No se contradice el charter; se corrige un mockup previo a haberlo leído.

### Elemento de firma (signature)
"Docket rail": línea vertical con nodos que conecta la lista de audiencias/actuaciones,
evocando un expediente judicial. Es el elemento distintivo de LexFlow frente a dashboards genéricos.
Reutilizable en: Agenda, Vista de Proceso, Bitácora.

### Componentes definidos
- Tarjetas con borde de 1px (`--hairline`), sin relleno de color sólido.
- Tags de materia (Civil, Laboral, Comercial, Familia) como pills con borde, color por categoría.
- Botones: primary (relleno dorado), secondary (borde), ghost (texto dorado), danger (borde rojo).
- Tabla de procesos con encabezados en mono uppercase.
- Doble marca: LEXFLOW™ (mono, tracking amplio) siempre visible arriba; logo de estudio configurable debajo con línea divisoria.

### Entregable de referencia
`lexflow-design-system.html` — mockup funcional con dashboard rediseñado + documentación de tokens.

## 2. Decisiones de diseño cerradas

| # | Decisión | Motivo | Estado |
|---|---|---|---|
| D-001 | Fondo casi-negro + dorado atenuado, no saturado | Elevar de "app Android" a "software ejecutivo" | ✅ Aprobado |
| D-002 | Docket rail como elemento de firma | Diferenciación visual única, ligada al dominio jurídico | ✅ Aprobado |
| D-003 | Tags de materia sin relleno sólido | Consistencia con sistema de tarjetas outline | ✅ Aprobado |
| D-004 | Doble marca siempre visible (LexFlow™ + estudio) | Requisito de negocio, multiestudio futuro | ✅ Aprobado |
| D-005 | Pantalla de Proceso (listado + expediente) reutiliza el docket rail como cronología del caso | Consistencia visual entre Inicio y Proceso, misma metáfora | ✅ Aprobado |
| D-006 | Filtros de materia como chips, no dropdown | Más rápido de tocar en mobile, menos fricción | ✅ Aprobado |
| D-007 | Estados vacío y de carga (skeleton) incluidos desde la primera versión de Proceso | Evitar retrabajo cuando Claude A conecte datos reales de `ProcesoService` | ✅ Aprobado |
| D-008 | Centro de Expediente: cabecera inteligente, timeline con íconos por tipo, panel de IA (copiloto, no chat), centro documental, flujo procesal, acciones rápidas, reserva de integraciones futuras | Directiva del proyecto: pasar de "pantallas aisladas" a "centros de trabajo" | ✅ Aprobado |
| D-009 | Centro de Agenda / Jornada Jurídica: vista del día cruzando todos los casos, vencimientos con semáforo de urgencia, bitácora del estudio | Complemento del Centro de Expediente — este cubre "todo mi día", el otro cubre "un caso" | ✅ Aprobado |
| D-010 | El ítem "Actuaciones + Cronología" de `ROADMAP.md` se considera satisfecho por el timeline del Centro de Expediente (D-008) | Evitar diseñar dos veces la misma cronología con nombres distintos | ✅ Aprobado |
| D-005 | Pantalla de Proceso (listado + expediente) reutiliza el docket rail como cronología del caso | Consistencia visual entre Inicio y Proceso, misma metáfora | ✅ Aprobado |
| D-006 | Filtros de materia como chips, no dropdown | Más rápido de tocar en mobile, menos fricción | ✅ Aprobado |
| D-007 | Estados vacío y de carga (skeleton) incluidos desde la primera versión de Proceso | Evitar retrabajo cuando Claude A conecte datos reales de `ProcesoService` | ✅ Aprobado |

## 3. Próximas pantallas / centros de trabajo (según ROADMAP.md, ajustado por la directiva de Centros de Trabajo)

1. ~~Proceso — alta / listado / vista de expediente~~ ✅ Entregado (`lexflow-proceso.html`)
2. ~~Centro de Expediente~~ ✅ Entregado (`lexflow-centro-expediente.html`) — cubre también "Actuaciones + Cronología"
3. ~~Centro de Agenda / Jornada Jurídica~~ ✅ Entregado (`lexflow-centro-agenda.html`) — cubre "Jornada Jurídica + Bitácora + Vencimientos"
4. **Centro Documental** (gestión real de archivos) ← siguiente candidato, sujeto a decisión de almacenamiento (ver ROADMAP.md fase 3)
5. Centro de Inteligencia Jurídica (IA) — expandir el copiloto ya esbozado en D-008 a su propia vista completa
6. Reportes y Configuración (multiestudio)

## 4. Notas de coordinación

Este documento es propiedad de la conversación de **diseño**.
No contiene decisiones de arquitectura de datos, IndexedDB ni StorageService — esas viven en
`ARCHITECTURE.md` / `DECISION-LOG.md`, propiedad de la conversación de **backend**.
Si una decisión visual requiere un cambio de datos (ej. nuevo campo para mostrar en UI),
debe registrarse aquí y notificarse explícitamente para su validación en la otra conversación.
