# Field Log

## Purpose

Validar que el motor de sincronización Local First se comporta como un producto real durante días de uso continuo, incluyendo periodos prolongados sin conexión.

No se busca un bug concreto. Se busca responder:

> ¿Podría confiar en esta aplicación para gestionar toda mi información durante meses, incluso pasando días sin conexión?

## Methodology

- Usar la aplicación normalmente durante varios días.
- Probar intencionalmente: offline prolongado, kill durante sync, wifi ↔ datos, sync simultáneo desde dos dispositivos.
- **No optimizar ni corregir inmediatamente.** Primero registrar, luego agrupar, luego priorizar.
- Al alcanzar 20–30 hallazgos, agrupar por causa raíz y planificar el siguiente sprint basado en datos reales.

## Log

| ID | Date | Category | Steps | Expected | Actual | Severity | Status |
|----|------|----------|-------|----------|--------|----------|--------|
|    |      |          |       |          |        |          |        |

### Categories

- **Sync** — push / pull / conflict / convergence
- **Offline** — CRUD sin conexión, cola, reenvío
- **UI** — visual, navegación, estados vacío/carga/error
- **Backup/Restore** — backup, restore, consistencia post-restore
- **Auth** — login, token expiry, session switch
- **Performance** — lentitud, uso de memoria, tamaño de BD
- **Crash** — crash sin recuperación
- **Data Loss** — pérdida de datos confirmada

### Severity

- **Crítica** — pérdida de datos, sync roto, crash permanente
- **Alta** — funcionalidad degradada, workaround posible
- **Media** — cosmético, edge case
- **Baja** — sugerencia, mejora
