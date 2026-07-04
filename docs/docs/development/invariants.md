# Invariantes del Protocolo

## Definiciones

**Entidad persistente**: Existe en la base de datos. No necesariamente participa en sincronización. Ej: logs, analytics, cache.

**Entidad sincronizable**: Cumple todos los invariantes del protocolo. Es una ciudadana de primera clase del Sync Engine.

## Sync Entity Contract (10 Invariantes)

1. Toda entidad sincronizable posee `user_id`
2. Toda entidad sincronizable posee `sync_version`
3. Toda mutación (CREATE/UPDATE) incrementa `sync_version`
4. Toda eliminación genera `deletion_version` en `sync_deletions`
5. Toda entidad participa en **Initial Sync**
6. Toda entidad participa en **Delta Sync**
7. Toda entidad participa en **Push** (endpoint + cola)
8. Toda entidad participa en **Backup/Restore** (cuando aplique)
9. Toda entidad aparece en el **Consistency Report**
10. Toda entidad está cubierta por la **Stress Suite** o por un **escenario específico** de convergencia

> *Si una tabla rompe cualquiera de estas reglas, no es una entidad sincronizable. Es solo una tabla.*

## Verificación

La incorporación de una nueva entidad sincronizable no se considera completa hasta que todos los invariantes sean verificables mediante pruebas automáticas:

- **[Convergence Suite](/testing/convergence)** — verifica sync converge
- **[Stress Suite](/testing/stress)** — verifica resistencia
- **[Consistency Report](/testing/consistency)** — verifica integridad

## Entidades Sincronizables Actuales (15)

| # | Tipo | Invariantes cumplidos |
|---|---|---|
| 1 | subject | ✅ (10/10) |
| 2 | course | ✅ (10/10) |
| 3 | flashcard-deck | ✅ (10/10) |
| 4 | flashcard | ✅ (10/10) |
| 5 | assessment | ✅ (10/10) |
| 6 | assessment-category | ✅ (10/10) |
| 7 | schedule | ✅ (10/10) |
| 8 | calendar-event | ✅ (10/10) |
| 9 | grading-period | ✅ (10/10) |
| 10 | lms-account | ✅ (10/10) |
| 11 | threshold-override | ✅ (10/10) |
| 12 | study-session | ✅ (10/10) |
| 13 | photo | ✅ (10/10) |
| 14 | audio-recording | ✅ (10/10) |
| 15 | scanned-document | ✅ (10/10) |
