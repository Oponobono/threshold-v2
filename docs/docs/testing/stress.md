# Stress Suite

## Propósito

Verificar la resistencia del Sync Engine bajo condiciones adversas: alta concurrencia, latencia, pérdida de paquetes, reinicios de servidor y sincronización parcial.

## Arquitectura

### SimulationEngine.js
- Devices configurables (2/3/5/10)
- 5 tipos de perturbación
- SyncMetrics tracking
- NetworkController con latencia/packet loss

### SyncMetrics.js
| Métrica | Descripción |
|---|---|
| **Convergence Score** | 0-100% qué tan bien convergen los dispositivos |
| **Sync timing** | avg/P95/min/max por ciclo |
| **Queue depth** | Profundidad de cola en cada ciclo |
| **Retries** | Número de reintentos |
| **Conflicts** | Conflictos detectados |
| **Discarded by version** | Operaciones descartadas por version guard |

## Perturbaciones

| Tipo | Descripción |
|---|---|
| **Simultaneous sync** | Múltiples dispositivos sincronizan al mismo tiempo |
| **Random latency** | 50-500ms de latencia en requests |
| **Packet loss** | 10-30% de requests fallan |
| **Server restart** | Backend se reinicia durante sync |
| **Partial sync** | Sincronización solo push o solo pull |

## Tiers

| Tier | Comando | Ops | Devices | Propósito |
|---|---|---|---|---|
| **Smoke** | `node index.js smoke` | 100 | 2 | Verificación rápida |
| **Regression** | `node index.js regression` | 1000 | 3 | Validación diaria |
| **Nightly** | `node index.js nightly` | 10000 | 5 | Validación exhaustiva |
| **Custom** | `node index.js custom <ops> <devices>` | configurable | configurable | Depuración |
| **Random** | `node index.js random <ops> <devices>` | configurable | configurable | Escenarios aleatorios |

### RandomScenario

4 segmentos operativos:
1. Normal (operaciones estándar)
2. Heavy perturbations (alta latencia + pérdida + simultáneo)
3. Offline (todos desconectados)
4. Normal (verificar convergencia post-perturbación)

## Resultados Históricos

| Tier | Resultado | Detalle |
|---|---|---|
| Smoke 100×2 | ✅ PASS | 100% convergencia, 0 errores |
| Regression 1000×3 | ✅ PASS | 1056 conflictos, 0 errores |
| Random 100×2 | ✅ PASS | 100% convergencia, 31 conflictos |

## Ejecución

```bash
# Desde backend/tests/stress/
node index.js smoke
node index.js regression
node index.js random 500 3
```
