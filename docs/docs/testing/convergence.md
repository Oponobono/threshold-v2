# Convergence Test Suite

## Propósito

Verificar que el Sync Engine converge correctamente: dos dispositivos que sincronizan a través del backend deben terminar con el mismo estado de datos.

## Arquitectura del Test

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Device A        │────▶│    Backend      │◀────│  Device B        │
│  (DeviceSimulator)│    │  (TestEnvironment)│    │  (DeviceSimulator)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### TestEnvironment.js
- Express server efímero con SQLite in-memory
- JWT integrado
- `restart()` para simular reinicios de servidor

### DeviceSimulator.js
- HTTP sync push/pull real
- Own SQLite database in-memory
- `dumpAll()` para verificar estado
- Latencia/packet loss simulation
- `syncPushOnly()`/`syncPullOnly()` para parcial sync

### ConvergenceAssert.js
- `deepEqual()` — excluye timestamps/metadata
- `sameEntities()` — excluye version_number
- `noQueue()` — verifica cola vacía

## Escenarios (10 core)

| # | Escenario | Descripción |
|---|---|---|
| 001 | CREATE converge | A crea subject → sync → B debe tenerlo |
| 002 | UPDATE converge | A actualiza subject → sync → B debe tener cambios |
| 003 | DELETE converge | A elimina → sync → B no debe tenerlo |
| 004 | Initial sync | B nuevo descarga todo desde backend |
| 005 | Delta sync offline-then-sync | A offline crea → reconecta → sync → B recibe |
| 006 | Conflict resolution | A y B modifican mismo campo → LWW |
| 007 | Multi-entity cascade | Crear subject+course+deck+card → sync |
| 008 | Queue reducer | 10 CREATEs + 5 UPDATEs + 3 DELETEs → compactado |
| 009 | RESTORE semantics | DELETE + CREATE mismo ID → RESTORE |
| 010 | Full cycle con assets | Crear + sync + delete + sync + restore |

## Ejecución

```bash
# Desde backend/tests/convergence/
node index.js

# Salida esperada:
# ========================================
#  Convergence Suite - Resultados
# ========================================
#  Escenario 001: ✅ PASS (120ms)
#  Escenario 002: ✅ PASS (95ms)
#  ...
#  Resumen: 10/10 PASS | 0 FAIL | 0 ERROR
```
