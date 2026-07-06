# ARCHITECTURE.md — LexFlow Bolivia (Backend / Arquitectura)

Documento maestro de arquitectura técnica, propiedad de "Claude A" (Arquitecto/Backend). No cubre diseño visual ni UX — eso vive en `DESIGN-ROADMAP.md`, responsabilidad de "Claude B".

## Capas del sistema

```
Pantallas (Claude B)
    ↓
Servicios de dominio: ProcesoService, ProcesoParteService, PersonaService, InstitutionService
    ↓
Servicios técnicos: ValidationService, StorageService
    ↓
IndexedDB
```

Regla invariable: los servicios técnicos nunca dependen de servicios de dominio (pueden usarse desde cualquier módulo futuro sin conocerlo). Los servicios de dominio pueden usar servicios técnicos, nunca al revés.

## Capacidad transaccional (actualizada en esta iteración)

`StorageService` expone 3 niveles, de más simple a más flexible:

1. `put(store, record)` / `remove(store, id)` — operación única, un store.
2. `putMultiple(operaciones)` — varias escrituras tipo `put`, en una sola transacción atómica, sobre uno o más stores. (Existe desde la Arquitectura 0.9; usada hoy por `ProcesoService.createProcesoCompleto()`.)
3. `writeMany(operaciones)` — igual que `putMultiple`, pero admite mezclar `put` y `remove` en la misma transacción atómica. (Nuevo en esta iteración.)
4. `runTransaction(storeNames, modo, funcionDeTrabajo)` — primitiva de más bajo nivel: entrega la transacción cruda de IndexedDB para casos que ninguno de los anteriores cubra. Cualquier servicio futuro puede apoyarse acá sin que `StorageService` necesite conocer su caso de uso de antemano.

Los niveles 2 y 3 están construidos **sobre** el nivel 4 — no son implementaciones paralelas.

## Documentos relacionados
- `MIGRACIONES.md` — versiones del esquema de IndexedDB (stores, índices).
- `DECISION-LOG.md` — decisiones arquitectónicas con su justificación.
- `ARQUITECTURA-PWA.md` / `VERIFICACION-PWA.md` — infraestructura de instalación/offline (Service Worker, manifest).

## Servicios existentes hoy
`StorageService`, `ValidationService`, `InstitutionService`, `PersonaService`, `ProcesoService`, `ProcesoParteService`, `PerfilUsuarioService` (config local, no de dominio), `I18N` (textos, no es un servicio de datos).

## Pendiente (próximas iteraciones de arquitectura)
- Integridad referencial completa (Arquitectura 1.0): impedir procesos/partes huérfanas, instituciones/personas eliminadas en uso, catálogos inválidos.
- Preparación (sin implementar todavía) para: API/servidor propio, sincronización, resolución de conflictos, auditoría/versionado, respaldo/exportación, IA.
