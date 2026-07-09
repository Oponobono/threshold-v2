# Startup Orchestration Bottleneck

## Problema

El primer `KnowledgeSnapshot.build()` tardaba ~1500ms, superando con creces el performance budget de 100ms. Esto retrasaba la aparición del Dashboard y generaba la impresión de una app lenta al arrancar.

**Síntoma observado**:
```
Snapshot #1: 1525ms  ← primer build (MANUAL_REFRESH)
Snapshot #2:   40ms  ← inmediatamente después
Snapshot #3:   36ms  ← estable
```

La diferencia entre #1 y #2 no se explicaba por SQLite — la misma consulta con los mismos datos pasaba de 1500ms a 40ms sin cambio alguno.

## Investigación

### Hipótesis 1 — Page cache frío (descartada)

Se instrumentó un warmup con la query exacta de producción (sin LIMIT, 120 filas, 10 columnas). El warmup completaba en 15-20ms, demostrando que SQLite ya recorría todas las páginas durante el bootstrap.

**Evidencia**:
```
[Warmup] Knowledge: 120 rows, 17.5 ms
[Warmup] GPA: 0 rows, 4.7 ms
```

### Hipótesis 2 — SQLite lento (descartada)

Benchmarks JSI durante el bootstrap mostraban rendimiento normal incluso en frío:
```
SELECT * flashcards LIMIT 120  21.0 ms
SELECT COUNT(*) subjects        3.8 ms
```

Y los snapshots aislados post-bootstrap eran consistentes:
```
Snapshot #1: 46.4 ms
Snapshot #2: 47.2 ms
Snapshot #3: 45.4 ms
```

### Hipótesis 3 — Planner / prepared statement (descartada)

EXPLAIN #1 vs #2 mostraban el mismo plan. Prepared statement cache funcionaba correctamente (warmup: 7-11ms prepare).

### Hipótesis 4 — Queue contention (confirmada parcialmente)

Se instrumentó `_track()` con timestamps (enqueue → start → sql_ok → done) para medir wait/bridge/create. Se descubrió que las queries pasaban ~70% del tiempo esperando turno en la cola serial (promise chain de `lastOp`).

**Evidencia**:
```
#11 "Knowledge aggregation query" → enq +5151ms depth=1
#11 "Knowledge aggregation query" ◆ start +6620ms waited=1469ms  ← 69% del total
#11 "Knowledge aggregation query" ◆ sql_ok +6658ms sql=20ms      ← SQL real es rápido
#11 "Knowledge aggregation query" ← done +6658ms total=1507ms bridge=20ms wait=1469ms
```

Sin embargo, al separar `await fn()` en `create` (creación de la Promise) vs `bridge` (`await promise`), se descubrió que el tiempo `bridge` también era elevado para algunas queries (no solo `wait`).

### Hipótesis 5 — expo-sqlite bridge congestionado (confirmada)

Se midió `bridge` para cada query y se observó que incluso sin cola (depth=0, wait≈0), algunas queries tenían `bridge` de 150-900ms:

```
#10 "BaseRepo.schedules.getByField" → enq +5688ms depth=0 wait=4ms bridge=917ms
#13 "BaseRepo.schedules.getAll"     → enq +6618ms depth=2 wait=183ms bridge=466ms
#18 "BaseRepo.photos.getAll"        → enq +8515ms depth=0 wait=4ms bridge=159ms
```

Esto indicaba que el problema no era solo la cola JS, sino una contención real en el puente nativo de expo-sqlite.

### Experimento definitivo — Defer 3s

Se difirió `refreshOverallGpa()` y el primer `KnowledgeSnapshot` con `setTimeout(3000)` para ejecutarlos cuando el startup ya estuviera completo.

**Resultado**:

| Escenario | GPA bridge | Knowledge bridge | Total |
|-----------|-----------|-----------------|-------|
| Sin defer | 1000ms | 34ms (wait 1499ms) | ~1517ms |
| Con defer 3s | 3ms | 161ms | ~166ms |

El GPA pasó de 1000ms bridge → 3ms bridge (-99.7%). La misma consulta, sin cambiar SQL, índices ni datos.

Además se observó que el "cuello" se movía entre queries según el orden de llegada al puente:

| Ejecución | GPA bridge | Knowledge bridge |
|-----------|-----------|-----------------|
| #1 (sin defer) | 1000ms | 34ms |
| #2 (con defer) | 3ms | 161ms |

El cuello caía sobre la query que llegaba primera cuando el puente estaba ocupado.

## Conclusión

SQLite no es el problema. El motor responde en 20-30ms para consultas complejas (JOIN, 120 filas, 10 columnas) y en <5ms para consultas simples.

El cuello real es la **contención del puente expo-sqlite durante el startup**, donde múltiples subsistemas compiten por el único canal serializado:

| Candidato | Bridge observado | Prioridad |
|-----------|-----------------|-----------|
| `schedules.getByField` | 917ms | Alta |
| `schedules.getAll` | 466ms | Alta |
| `CachePreload` (4× getAll) | 159ms c/u | Media |
| `PredictionPolling` | Indirecto | Media |
| `ReviewScheduler` | Indirecto | Media |

### Próximo paso

El rendimiento de las consultas GPA y Knowledge en reposo es aceptable (~46ms snapshot completo). No se debe optimizar SQL.

El problema que hay que resolver ahora es de **orquestación del arranque**: identificar qué tareas pueden diferirse, lazy-loadearse o ejecutarse en paralelo para liberar el puente de expo-sqlite durante la ventana crítica de startup.

**Orden de investigación**:

1. **schedules.getByField** (917ms) — ¿quién lo invoca? ¿es necesario durante el arranque?
2. **schedules.getAll** (466ms) — ¿depende del anterior? ¿duplican trabajo?
3. **CachePreload** — cuatro `getAll()` casi simultáneos; ¿pueden ser lazy?
4. **PredictionPolling / ReviewScheduler** — ¿pueden esperar a que la UI sea estable?


---
**Tags:** #architecture
