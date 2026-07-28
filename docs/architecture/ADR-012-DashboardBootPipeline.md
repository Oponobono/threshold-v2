# ADR-012: Dashboard Boot Pipeline

**Estado:** Aceptado  
**Fecha:** 2026-07-28  
**Sprint:** DashboardCoordinator — SQLite Bridge Contention

---

## Contexto

El Dashboard monta múltiples consumidores de SQLite simultáneamente. El bridge
JSI/SQLite es single-threaded: cuando dos operaciones se encolan al mismo tiempo,
la segunda espera a que la primera termine. En cold boot, esto producía:

```
Dashboard mount
 ├── Schedule.getByField  depth=0  bridge=3500ms  ← bloquea todo
 ├── GPA aggregation      depth=4  wait=1249ms
 ├── Knowledge (125 rows) depth=2  bridge=1640ms
 └── Flashcards JOIN      depth=2  bridge=1394ms
```

El orden dependía de React scheduler + InteractionManager + latencia de red.
No existía causalidad garantizada.

---

## Decisión

**El `DashboardCoordinator` es el único dueño de la secuencia de carga del Dashboard.**

Ningún consumidor nuevo puede activarse al montar el Dashboard sin coordinarse con
el Coordinator o esperar su señal de disponibilidad.

---

## Pipeline de arranque

```
Dashboard mount
        │
        └── DashboardCoordinator.start()
                │
                ├── setTimeout(150ms)   ← cede al bridge (frame) al mountar
                │
                ├── await P0A: Schedule.execute()
                │       ├── GET /schedules/today (network)
                │       └── SQLite: getByField (bridge warm)
                │
                ├── await P0B: GPA.execute()
                │       └── SQLite: aggregation JOIN (bridge caliente)
                │
                └── Promise.resolve()
                        │
                        ├── triggerBootSnapshotRef.current?.()   ← P0C (síncrono)
                        │       └── Knowledge.buildSnapshot(BOOT)
                        │
                        └── setCoreReady(true)                   ← P1 (React ~500ms)
                                └── PredictionPolling.firstRun()
```

---

## Tres mecanismos de señal

### 1. `await` secuencial (P0A → P0B)

Dentro del coordinator, las tareas se ejecutan en orden con `await`. Ninguna
tarea SQLite inicia hasta que la anterior libera el bridge.

```ts
for (const task of sortedTasks) {
  await task.execute(signal);
}
```

### 2. Callback ref directo (P0C — Knowledge)

El snapshot de Knowledge se dispara como **microtask** al resolver la Promise
del coordinator. Cortocircuita el React scheduler (~500ms) porque Knowledge es
parte del critical path visual del Dashboard.

```ts
// index.tsx
coordinator.start().then(() => {
  triggerBootSnapshotRef.current?.();  // síncrono — no setState
  setCoreReady(true);
});

// index.tsx (render body)
triggerBootSnapshotRef.current = triggerBootSnapshot;  // siempre actualizado
```

```ts
// useKnowledgeInsights.ts
const runBootSnapshot = () => {
  if (!userId || bootDoneRef.current) return;
  bootDoneRef.current = true;  // guarda atómica antes del async
  buildSnapshot(BOOT, false);
};
```

**Invariante del guard:** `bootDoneRef.current = true` se ejecuta **antes** del
`async`. Así, dos llamadas simultáneas (coordinator + evento de sync) nunca
pasan el guard al mismo tiempo.

### 3. Estado React (P1 — PredictionPolling)

El polling de predicciones no es critical path visual. El delay de ~500ms del
React scheduler es aceptable. Se usa `useState` simple:

```ts
const [coreReady, setCoreReady] = useState(false);
usePredictionPolling(profile?.id, true, coreReady);
```

`usePredictionPolling` espera `coreReady === true` antes de disparar su primera
query a Flashcards.

---

## Resultado validado (cold boot, Render backend)

| Operación | Antes | Después | Mejora |
|---|---|---|---|
| Schedule queue depth | 2–4 | 0 | ✅ |
| GPA wait | ~1249ms | 43ms | ~97% |
| Knowledge bridge | 600–1640ms | **28ms** | ~98% |
| Flashcards JOIN | compite con core | después de coreReady | ✅ |
| Queue depth máxima | 4 | 2 (secuencia interna) | controlada |

---

## Reglas para futuras features

> **Cualquier feature que ejecute trabajo pesado al montar el Dashboard debe
> clasificarse en una de estas categorías antes de implementarse:**

| Prioridad | Criterio | Mecanismo |
|---|---|---|
| **P0 — Core visual** | El usuario no puede usar el Dashboard sin este dato | `await` dentro del coordinator |
| **P0C — Secondary core** | Dato secundario pero crítico (Knowledge) | `triggerBootSnapshotRef` callback directo |
| **P1 — Intelligence** | Datos de enriquecimiento, toleran ~500ms de delay | `coreReady` via `useState` |
| **P2 — Background** | Analytics, sync, indexación | Fire-and-forget fuera del coordinator |

### Lo que está prohibido

```ts
// ❌ Nunca: SQLite directa al montar Dashboard sin coordinación
useEffect(() => {
  repo.getAll().then(setData);
}, []);

// ❌ Nunca: InteractionManager como único delay (no garantiza orden)
InteractionManager.runAfterInteractions(() => {
  heavyQuery();
});

// ❌ Nunca: setTimeout fijo como proxy de "no competir"
setTimeout(() => refreshData(), 2000);
```

```ts
// ✅ P0: agregar la tarea al coordinator
buildDashboardTasks({ syncTodaySchedules, refreshOverallGpa, newTask });

// ✅ P1: esperar coreReady
useMyHook(userId, coreReady);

// ✅ P2: fire-and-forget en useEffect vacío (sin SQLite en cold path)
useEffect(() => { analyticsPing(); }, []);
```

---

## Consecuencias

**Positivas:**
- El cold boot del Dashboard es ahora determinista. El orden de queries es
  causal, no dependiente del scheduler.
- Cualquier regresión de performance es observable en los logs de `[Queue]`.
- El patrón es reutilizable para cualquier pantalla que tenga múltiples
  consumidores de SQLite en mount.

**Negativas / Trade-offs:**
- El coordinator introduce un `setTimeout(150ms)` al arranque. Ese frame es
  el costo de ceder el bridge antes de las queries pesadas.
- `coreReady` via `useState` introduce ~500ms de delay para P1. Es aceptable
  para secondary intelligence pero no para core visual.
- Si el coordinator crece con demasiadas tareas P0, el pipeline se convierte
  en un cuello de botella. Regla: máximo 3 tareas P0. Las demás deben ser P1+.

---

## Referencias

- [`DashboardCoordinator.ts`](file:///c:/Users/cris7/OneDrive/Desktop/Threshold/mobile/src/dashboard/DashboardCoordinator.ts)
- [`DashboardTasks.ts`](file:///c:/Users/cris7/OneDrive/Desktop/Threshold/mobile/src/dashboard/DashboardTasks.ts)
- [`useKnowledgeInsights.ts`](file:///c:/Users/cris7/OneDrive/Desktop/Threshold/mobile/src/hooks/useKnowledgeInsights.ts)
- [`usePredictionPolling.ts`](file:///c:/Users/cris7/OneDrive/Desktop/Threshold/mobile/src/hooks/usePredictionPolling.ts)
- [`index.tsx` (Dashboard)](file:///c:/Users/cris7/OneDrive/Desktop/Threshold/mobile/app/(tabs)/index.tsx)
