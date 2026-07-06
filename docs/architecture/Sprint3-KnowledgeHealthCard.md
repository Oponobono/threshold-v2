# Sprint 3 — Primer consumidor del KnowledgeSnapshot

## Objetivo

Validar que `KnowledgeSnapshot` puede ser consumido por la UI sin que ésta conozca absolutamente nada de:

- FSRS
- SQLite
- Queries SQL
- Retrievability
- Stability
- Difficulty

La UI solo conoce:

```
KnowledgeProvider
        ↓
KnowledgeSnapshot
```

Si este sprint es exitoso, el contrato del dominio queda validado por un consumidor real.

---

## Arquitectura

```
SQLite
    │
    ▼
getKnowledgeAggregation()
    │
    ▼
KnowledgeSnapshotBuilder
    │
    ▼
KnowledgeSnapshot (Value Object)
    │
    ▼
KnowledgeProjection
    │
    ▼
KnowledgeProvider
    │
    ▼
useKnowledgeInsights()
    │
    ▼
KnowledgeHealthCard
    │
    ▼
Dashboard
```

---

## 1. useKnowledgeInsights()

Responsabilidad:

- construir el Snapshot
- cachearlo
- refrescarlo
- exponer estados de carga

API:

```ts
interface UseKnowledgeInsights {
    snapshot: KnowledgeSnapshot | null;
    loading: boolean;
    error: Error | null;
    refresh(): Promise<void>;
}
```

Inicialmente:
- carga al montar
- refresh manual
- sin polling automático

---

## 2. KnowledgeHealthCard

Primer consumidor del Snapshot.

Solo utiliza:

```
snapshot.health
snapshot.metadata
```

No conoce:
- retrievability
- estabilidad
- SQL
- FSRS

### Diseño

```
┌───────────────────────────────────────────┐
│          Estado de Aprendizaje            │
├───────────────────────────────────────────┤
│                                           │
│               84%                         │
│         Excelente memoria                 │
│                                           │
│ ████████████████████░░░                   │
│                                           │
│ Confianza: 96%                            │
│                                           │
├───────────────────────────────────────────┤
│ Riesgo de olvido                          │
│                                           │
│ 🟢 Bajo                                   │
│                                           │
│ 18% del conocimiento                      │
│ entrará en riesgo si hoy no estudias.     │
├───────────────────────────────────────────┤
│ Tarjetas     1248                         │
│ Materias     6                            │
│ Último cálculo hace 2 min                 │
└───────────────────────────────────────────┘
```

### Score thresholds

```
90-100   Verde
75-89    Verde claro
60-74    Amarillo
40-59    Naranja
0-39     Rojo
```

### Forgetting Risk

```
0-15%    🟢 Bajo
16-35%   🟡 Medio
36%+     🔴 Alto
```

---

## 3. Dashboard

No eliminar la capa operativa. Mantener ambas:

```
Dashboard
├── Estado de Aprendizaje      (KnowledgeSnapshot)
├── Repasos pendientes          (ReviewScheduler)
├── Próximos repasos
├── Actividad reciente
└── Acciones rápidas
```

**Cognitiva**: ¿Cómo está mi conocimiento? → `KnowledgeSnapshot`
**Operativa**: ¿Qué debo hacer hoy? → `ReviewScheduler`

No mezclarlas.

---

## Lo que NO entra en este sprint

- forecast
- momentum
- balance
- loss projection
- recomendaciones IA
- polling automático

---

## Criterios de éxito

- Dashboard consume únicamente `KnowledgeSnapshot`
- Ningún componente React conoce FSRS
- Ningún componente React ejecuta SQL
- Ningún componente React calcula retrievability
- `KnowledgeHealthCard` funciona solo con `snapshot.health` + `snapshot.metadata`

---

## Principio arquitectónico

> El dominio evoluciona únicamente cuando un consumidor demuestra necesitar nueva información.
