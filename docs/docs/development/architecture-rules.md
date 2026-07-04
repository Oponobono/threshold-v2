# Reglas de Arquitectura

## Principio Rector

> *"Si no puedes observar una sincronización, no puedes confiar en ella."*

## Constraints

1. **No comentar código** a menos que sea estrictamente necesario
2. **No refactorizar código estable** sin ganancia funcional clara
3. **SQLite como única fuente de verdad** para datos de negocio; MMKV reservado para JWT, tokens, flags, configuración, metadatos
4. **La capa UI no debe importar directamente de `services/api`** — debe hacerlo vía DataStore, Repositories o Queries
5. **Mantener el orden de secciones del template**

## Regla de Gobierno

"No implementar una funcionalidad nueva mientras exista un ciclo de vida incompleto en una funcionalidad existente."

Antes de agregar X, verificar:
- ¿El usuario puede crearlo, editarlo, moverlo, vincularlo/desvincularlo, eliminarlo, restaurarlo?
- ¿Funciona offline? ¿Sincroniza? ¿Tiene pruebas?
- ¿Aparece en las matrices?

## Definición de "Done"

Una funcionalidad está terminada solo cuando completa:

1. **Modelo actualizado** — matrices (FEATURE_MATRIX, MUTATION_MATRIX, OWNERSHIP_MATRIX)
2. **Implementación** — código funcionando
3. **Convergence Suite** — prueba de sincronización
4. **Stress Suite** — prueba de resistencia
5. **Pruebas en dispositivos** — validación en campo
6. **Documentación** — matrices actualizadas
7. **FEATURE_MATRIX = ✅** y **USER_JOURNEYS = ✅** para esa entidad

## Metodología: Operación Campo

### Fase 1 — Usar como usuario real
1-2 semanas usando la app como herramienta principal de estudio. No probar botones — cumplir objetivos reales.

### Fase 2 — No arreglar inmediatamente
Documentar cada hallazgo sin abrir el editor. Cada hallazgo incluye: número, journey, paso, problema, impacto y documento afectado.

### Fase 3 — Agrupar
Resolver en sprints temáticos, no uno por uno.

### Fase 4 — Matrices como backlog
FEATURE_MATRIX y USER_JOURNEYS son el backlog vivo. Las celdas en rojo YA son las tareas.

## Decisiones Arquitectónicas Clave

### Arquitectura de Sync Audit
- Sync audit precede a cualquier cambio de código
- La participación de entidades debe rastrearse por ciclo
- Toda escritura en backend debe incrementar `sync_version`
- Los deletes deben usar soft-delete + tabla `sync_deletions`
- Analytics debe tratarse como dato derivado (no sincronizado bidireccionalmente)

### Threshold: De código a dominio
- El proyecto cruzó el umbral de estar organizado alrededor del código a estarlo alrededor del dominio
- Los documentos (SYNC_PROTOCOL, FEATURE_MATRIX, USER_JOURNEYS, etc.) constituyen la **especificación funcional del producto**
