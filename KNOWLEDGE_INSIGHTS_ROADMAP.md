# Knowledge Insights Roadmap

## Visión

FSRS no es un módulo de flashcards. Es un modelo matemático de la memoria del estudiante. Hoy solo consumimos un dato (`next_review_date`) para mostrar "Repasos urgentes". Este plan convierte FSRS en el **Sistema Nervioso de Threshold**: un motor de inteligencia cognitiva que toda la aplicación consume.

Threshold ya no modela flashcards. Modela **conocimiento**. Anki modela tarjetas. Threshold modela memoria, materias, rendimiento, conocimiento y —eventualmente— aprendizaje. Son niveles de abstracción radicalmente distintos.

## Principio Arquitectónico

El Dashboard (y cualquier consumidor) **nunca debe conocer FSRS**. No importa `stability`, `difficulty`, `retrievability`, `interval`. Solo conoce `KnowledgeSnapshot` — una **proyección** del estado cognitivo del estudiante.

```
FlashcardDomainService
        │
        ▼
ReviewScheduler
        │
        ▼
KnowledgeProjection          ← NUEVO: construye la proyección
        │
        ▼
KnowledgeSnapshot            ← El modelo, no una consulta
        │
        ├── Dashboard
        ├── IA
        ├── Notas
        ├── Calendario
        └── Notificaciones
```

El Dashboard depende de `KnowledgeProvider` (interfaz), no de una implementación concreta:

```
Dashboard → KnowledgeProvider ← KnowledgeProjection
                                 ← KnowledgeCache
                                 ← KnowledgeMock
                                 ← KnowledgeRemote (futuro)
```

Regla: **El Dashboard no sabe que existen flashcards, decks, cards, FSRS, SQLite, ni Repository. Si mañana reemplazas FSRS por otro algoritmo, el Dashboard no se entera.**

---

## Fase K0 — Cimentación (Pre-Sprint)

Antes de construir la proyección, hay que asegurar que los datos crudos de FSRS son íntegros y representan la realidad.

### K0.1 — Verificar integridad de datos FSRS

- [ ] Query que detecte flashcards con `next_review_date` pasado pero `status` incorrecto
- [ ] Query que detecte `fsrs_stability` = 0 o NULL en tarjetas con reviews
- [ ] Migración one-time para poblar `fsrs_stability` = 1, `fsrs_difficulty` = 0.5 donde sea NULL

### K0.2 — Modo producción

- [ ] Cambiar `SCHEDULING_MODE` de `'development'` a `'production'` en `ReviewSchedulingPolicy.ts`
- [ ] Verificar que los intervals generados sean correctos (días reales, no minutos comprimidos)

### K0.3 — Unificar ReviewScheduler

- [ ] `ReviewScheduler.getStudySchedule()` actualmente calcula `mastery` desde `failure_rate` (card_logs). Cambiar a usar `retrievability` real desde FSRS.
- [ ] El `mastery` debe ser `retrievability` de FSRS, no un proxy estadístico. Retirada gradual del cálculo legacy.

### K0.4 — Agregación SQL optimizada

- [ ] Crear función de agregación única: 1 query devuelve todos los agregados necesarios para construir el Snapshot completo
- [ ] La retrievability actual se calcula en memoria (`calculateFSRS`). Para agregación, crear helper `calculateRetrievability(stability, elapsedDays)` reutilizable sin ejecutar el review completo

---

## Fase K1 — KnowledgeProjection + KnowledgeSnapshot Compuesto (Sprint K1)

Crear la capa de proyección del conocimiento. El Snapshot es un agregado compuesto, no un objeto plano. `KnowledgeProjection` construye el modelo; no es un "servicio", es un builder de la proyección cognitiva.

### K1.1 — Tipos base

- [ ] Crear `mobile/src/domain/knowledge/types.ts`

```typescript
// ─── Semántica de memoria (la UI nunca ve retrievability crudo) ───

export type MemoryLevel = 'excellent' | 'good' | 'recovering' | 'critical';
export type Momentum = 'improving' | 'stable' | 'declining';
export type ForgettingRisk = 'low' | 'medium' | 'high';
export type MemoryState = 'stable' | 'unstable' | 'decaying' | 'fragile';
export type SnapshotAge = 'fresh' | 'recent' | 'stale' | 'expired';
export type BalanceLevel = 'excellent' | 'good' | 'uneven' | 'critical';

// ─── Agregados ───

export interface LearningHealth {
  overallKnowledge: number;          // 0-100
  memoryLevel: MemoryLevel;         // Excelente, Bueno, Recuperándose, Crítico
  score: number;                    // 0-100 (el número que la UI puede mostrar)
  confidence: number;               // 0-1, qué tan confiable es el score (pocos datos = baja confianza)
  forgettingRisk: ForgettingRisk;
  knowledgeAtRisk: number;          // % de conocimiento consolidado que entrará en zona de olvido en 24h si no se estudia
}

export interface LearningMomentum {
  momentum: Momentum;
  weeklyChange: number;             // puntos porcentuales de cambio en retrievability promedio
  trendDescription: string;         // "Mejorando", "Estable", "En declive"
  consistency: number;              // 0-100, qué tan consistente ha sido el estudio
  velocity: number;                 // KnowledgeVelocity: qué tan rápido está aprendiendo (+14% esta semana)
}

export interface LearningBalance {
  balance: BalanceLevel;
  bestSubject: string;              // materia con mayor retrievability
  worstSubject: string;             // materia con menor retrievability
  gap: number;                      // diferencia porcentual entre best y worst
}

export interface KnowledgeLossProjection {
  loss24h: number;                  // % de conocimiento que se perderá en 24h si no estudia
  loss3d: number;                   // % en 3 días
  loss7d: number;                   // % en 7 días
  loss14d: number;                  // % en 14 días
  description: string;              // "Si no estudias esta semana, perderás ~22% de Anatomía"
}

export interface MemoryForecast {
  nextDeteriorationDays: number;    // días hasta que la retrievability baje de 70%
  lossProjection: KnowledgeLossProjection;
  examPreparation: number | null;   // 0-100 si hay examen próximo
}

export interface ReviewInsights {
  dueDeckCount: number;
  dueCardCount: number;
  estimatedMinutes: number;         // tiempo estimado hoy basado en avg response time
  masteredCards: number;
  learningCards: number;
  newCards: number;
  reviewsThisWeek: number;
  avgResponseTimeMs: number;
}

export interface SubjectKnowledge {
  subjectId: string;
  subjectName: string;
  retrievability: number;           // 0-100, para cálculo interno
  memoryLevel: MemoryLevel;         // para UI
  memoryState: MemoryState;
  momentum: Momentum;
  velocity: number;                 // qué tan rápido aprende esta materia
  stabilityDays: number;            // estabilidad promedio en días
  difficulty: number;               // 0-10
  totalCards: number;
  dueCards: number;
  masteredCards: number;
  learningCards: number;
  daysSinceLastReview: number;
  forgettingProbability: number;    // 0-100
  risk: ForgettingRisk;
}

/**
 * KnowledgeSnapshot — Value Object Inmutable.
 *
 * - Ningún consumidor puede mutarlo.
 * - Cada reconstrucción genera una nueva instancia.
 * - El cache reemplaza snapshots completos; nunca muta parcialmente.
 * - Todas las propiedades son readonly.
 */
export interface KnowledgeSnapshot {
  readonly generatedAt: Date;
  readonly validUntil: Date;        // generatedAt + 15 min (ventana de cache)
  readonly age: SnapshotAge;        // semántica: fresh/recent/stale/expired
  readonly clock: number;           // timestamp epoch ms, para debugging y reproducibilidad

  readonly health: LearningHealth;
  readonly momentum: LearningMomentum;
  readonly balance: LearningBalance;
  readonly forecast: MemoryForecast;
  readonly reviews: ReviewInsights;
  readonly subjects: readonly SubjectKnowledge[];

  readonly metadata: {
    readonly totalCards: number;
    readonly totalDecks: number;
    readonly totalSubjects: number;
    readonly daysSinceLastReview: number;
    readonly confidence: number;    // 0-1, confianza general del snapshot
  };
}

export interface StudyRecommendation {
  subjectId: string;
  subjectName: string;
  deckIds: string[];
  estimatedMinutes: number;
  priority: number;                 // 0-1, más alto = más urgente
  reason: 'forgetting' | 'exam_prep' | 'review';
  currentRetrievability: number;
}
```

### K1.2 — KnowledgeProvider (interfaz)

- [ ] Crear `mobile/src/domain/knowledge/KnowledgeProvider.ts`

```typescript
export interface KnowledgeProvider {
  buildSnapshot(userId: string): Promise<KnowledgeSnapshot>;
  getRecommendations(userId: string): Promise<StudyRecommendation[]>;
  getSubjectKnowledge(userId: string, subjectId?: string): Promise<SubjectKnowledge[]>;
}
```

El Dashboard depende de esta interfaz. No de `KnowledgeProjection` ni de ninguna implementación concreta.

### K1.3 — Helper puro `calculateRetrievability`

- [ ] Crear `mobile/src/domain/knowledge/retrievability.ts`

```typescript
export function calculateRetrievability(stability: number, elapsedDays: number): number {
  const safeStability = Math.max(0.1, stability);
  return Math.exp(-elapsedDays / (9 * safeStability));
}
```

Función pura, sin efectos, sin dependencias. Reutilizable desde cualquier lugar.

### K1.4 — KnowledgeProjection (implementación concreta)

- [ ] Crear `mobile/src/domain/knowledge/KnowledgeProjection.ts`

Implementa `KnowledgeProvider`. **1 sola consulta SQL para construir el Snapshot completo**.

| Método | Responsabilidad |
|--------|----------------|
| `buildSnapshot(userId)` | 1 query → construye `KnowledgeSnapshot` completo con todos los sub-agregados |
| `getRecommendations(userId)` | Ordena `SubjectKnowledge` por prioridad y genera recomendaciones |
| `getSubjectKnowledge(userId, subjectId?)` | Filtra `subjects` del snapshot |

`buildSnapshot()` ejecuta **1 query** que devuelve todas las agregaciones necesarias (por materia: AVG retrievability, AVG stability, AVG difficulty, COUNT due, COUNT mastered, etc.). En memoria construye los 5 sub-agregados.

#### Mapeo semántico (dominio, no UI)

| Cálculo interno | Exposición semántica |
|----------------|---------------------|
| `retrievability >= 85` | `memoryLevel: 'excellent'` |
| `retrievability >= 70` | `memoryLevel: 'good'` |
| `retrievability >= 50` | `memoryLevel: 'recovering'` |
| `retrievability < 50` | `memoryLevel: 'critical'` |
| `stability > 21 días` | `memoryState: 'stable'` |
| `stability > 7 días` | `memoryState: 'stable'` |
| `stability > 3 días` | `memoryState: 'unstable'` |
| `retrievability < 60%` | `memoryState: 'decaying'` |
| `repetitions < 2` | `memoryState: 'fragile'` |
| `weeklyChange > +2%` | `momentum: 'improving'` |
| `weeklyChange between -2% and +2%` | `momentum: 'stable'` |
| `weeklyChange < -2%` | `momentum: 'declining'` |
| `retrievability >= 80` | `forgettingRisk: 'low'` |
| `retrievability >= 60` | `forgettingRisk: 'medium'` |
| `retrievability < 60` | `forgettingRisk: 'high'` |
| `gap between best/worst < 15%` | `balance: 'excellent'` |
| `gap between best/worst < 30%` | `balance: 'good'` |
| `gap between best/worst < 50%` | `balance: 'uneven'` |
| `gap between best/worst >= 50%` | `balance: 'critical'` |
| `totalCards < 20` | `confidence: 0.3` |
| `totalCards < 100` | `confidence: 0.6` |
| `totalCards < 500` | `confidence: 0.85` |
| `totalCards >= 500` | `confidence: 0.96` |
| `snapshot age < 1 min` | `age: 'fresh'` |
| `snapshot age < 15 min` | `age: 'recent'` |
| `snapshot age < 1 hour` | `age: 'stale'` |
| `snapshot age >= 1 hour` | `age: 'expired'` |

### K1.5 — Pruebas

- [ ] Test: `buildSnapshot` con datos controlados devuelve todos los sub-agregados correctos
- [ ] Test: `memoryLevel` mapea correctamente desde retrievability crudo
- [ ] Test: `momentum` sin historial devuelve `'stable'`
- [ ] Test: `forgettingRisk` en cada nivel
- [ ] Test: `balance` con 1 materia vs 5 materias
- [ ] Test: `confidence` escala con cantidad de datos
- [ ] Test: `age` se calcula correctamente según diff desde generatedAt
- [ ] Test: `KnowledgeLossProjection` produce valores monótonos (loss7d >= loss3d >= loss24h)
- [ ] Test: `velocity` positivo cuando weeklyChange > 0
- [ ] Test: `SubjectKnowledge` con materia sin tarjetas
- [ ] Test: Snapshot determinista — mismos datos + mismo reloj = mismo snapshot

---

## Fase K1.5 — Knowledge Certification (Sprint Arquitectónico)

No agrega funcionalidad. Certifica que el dominio es sólido para los próximos años.

### Checklist de certificación

- [ ] Snapshot determinista: mismos datos SQLite + mismo `clock` = exactamente mismo snapshot
- [ ] Snapshot construido **exclusivamente desde SQLite**. Sin HTTP, sin API, sin MMKV
- [ ] Sin acceso desde UI a: `KnowledgeProjection` (solo conoce `KnowledgeProvider` interfaz), algoritmo FSRS, SQLite
- [ ] Snapshot reproducible: dado un userId y un timestamp histórico, se puede reconstruir el snapshot de ese momento (útil para debugging y retrospectiva)
- [ ] Tiempo de construcción < 50 ms con 10,000 tarjetas
- [ ] Cobertura de tests > 90% en lógica semántica (mapeo retrievability → memoryLevel, confidence, balance, etc.)
- [ ] Funciona offline sin degradación
- [ ] Compatible con SyncQueue — un snapshot no depende de datos no sincronizados
- [ ] `validUntil` calculado correctamente (15 min desde generatedAt)
- [ ] `confidence` es inversamente proporcional a la escasez de datos

---

## Fase K1.6 — Snapshot Benchmark (Sprint de Rendimiento)

Certifica que la proyección es viable a escala.

### Objetivos de rendimiento

| Escenario | Tiempo máximo | Objetivo |
|-----------|--------------|----------|
| 100 tarjetas, 500 card_logs | < 10 ms | Smoke |
| 1,000 tarjetas, 5,000 card_logs | < 20 ms | Regresión |
| 10,000 tarjetas, 50,000 card_logs | < 50 ms | Normal |
| 25,000 tarjetas, 100,000 card_logs | < 100 ms | Estrés |
| 50,000 tarjetas, 250,000 card_logs | < 200 ms | Límite |

### Medir

- [ ] Tiempo de query SQL (ejecución plana)
- [ ] Tiempo de mapping (filas → objetos en memoria)
- [ ] Tiempo de proyección (cálculo semántico: memoryLevel, confidence, balance, etc.)
- [ ] Memoria heap utilizada post-snapshot
- [ ] GC pause (si detectable)
- [ ] Tiempo de serialización (si se persiste o cachea)
- [ ] Tiempo de React render con el snapshot completo (estimación)

### Umbrales de aceptación

- [ ] K1.6.1: query SQL < 30% del tiempo total
- [ ] K1.6.2: mapping < 30% del tiempo total
- [ ] K1.6.3: proyección semántica < 40% del tiempo total
- [ ] K1.6.4: sin leaks de memoria detectables post-snapshot
- [ ] K1.6.5: heap estable después de 100 iteraciones

---

## Fase K2 — Dashboard Knowledge (Sprint K2)

La UI consume `KnowledgeSnapshot` a través de `KnowledgeProvider`. No conoce FSRS, flashcards, decks, cards, SQLite ni Repository.

### K2.1 — Tarjeta "Estado de Aprendizaje"

Reemplazar la sección "Repasos urgentes" (líneas 841-879 de index.tsx) por una tarjeta dual:

**Capa operativa** (se queda):
```
⚠️ 1 mazo listo para repasar    [Repasar]
```
Se muestra **siempre**. Si no hay pendientes: "✅ Todo al día. Tu memoria está estable."

**Capa cognitiva** (nueva):
```
Estado de Aprendizaje
████████░░  84%  ↑ Mejorando
Confianza: alta (96%)

Riesgo de olvido: 🟢 Bajo
Conocimiento en riesgo: 18% (si no estudias hoy)
Hoy: 18 min estimados
Próximo deterioro: dentro de 8 días

Balance: 🟢 Excelente (brecha entre materias: 8%)

Si no estudias esta semana:
Perderás ~15% de Anatomía
```

- [ ] Diseñar componente `KnowledgeHealthCard.tsx`
- [ ] Consumir `KnowledgeProvider` (interfaz), no implementación concreta
- [ ] Mostrar barra con `health.score`
- [ ] Mostrar `momentum.trendDescription` con flecha
- [ ] Mostrar `health.forgettingRisk` con color
- [ ] Mostrar `health.knowledgeAtRisk`
- [ ] Mostrar `reviews.estimatedMinutes`
- [ ] Mostrar `forecast.nextDeteriorationDays`
- [ ] Mostrar `balance.balance` con color
- [ ] Mostrar `forecast.lossProjection.description` expandible

### K2.2 — Recommendation strip

- [ ] Debajo de la tarjeta de salud, mostrar la recommendation más urgente:
  ```
  📋 Hoy prioriza: Anatomía (12 min) — riesgo de olvido alto
  ```
- [ ] Botón "Ir a materia"
- [ ] Si no hay urgentes: "Todo estable. Sigue así."

### K2.3 — Integrar en Dashboard

- [ ] Reemplazar el bloque condicional `{predictions.dueCount > 0 ? ... : null}`
- [ ] Mantener `snoozeManager` para la capa operativa
- [ ] Hook `useKnowledgeInsights` con polling cada 15 min (respetando `validUntil`)

### K2.4 — Web de materias en Dashboard

- [ ] Mini-tarjetas de materia:
  ```
  🟢 Física        92%  ↑ +14% esta semana
  🟡 Historia      71%  → estable
  🔴 Química       41%  ↓ 12 días sin repasar
  ```
- [ ] Cada una navega al detalle de materia
- [ ] Mostrar top 4-6 ordenadas por riesgo descendente

---

## Fase K3 — Detalle de Materia Enriquecido (Sprint K3)

### K3.1 — Knowledge Health en materia

- [ ] Consumir `SubjectKnowledge` desde el mismo Snapshot (no query aparte)

```
Salud del Conocimiento
Dominio:        ████████░░  86%  🟢 Excelente
Retención:      83%  (próximo deterioro en 4 días)
Estabilidad:    9.3 días promedio  ↑ Mejorando (+14% esta semana)
Tarjetas:       152 maduras · 31 nuevas · 14 en aprendizaje
Riesgo de olvido: Bajo (3%)
```

### K3.2 — Memory map visual

- [ ] Barras por estado:
  ```
  🟩 Estable   🟦 Aprendiendo   🟥 En riesgo
  152            31                14
  ```

### K3.3 — KnowledgeVelocity

- [ ] "Velocidad de aprendizaje: +14% esta semana"
- [ ] Mini sparkline comparando esta semana vs. anterior

### K3.4 — KnowledgeLossProjection específica

- [ ] "Si no estudias esta materia: 5% en 3 días · 18% en 7 días · 35% en 14 días"

---

## Fase K4 — Integración Cross-Domain (Sprint K4)

### K4.1 — IA

- [ ] `AIOrchestrator` consulta `KnowledgeProvider.buildSnapshot()`
- [ ] "¿Qué debería estudiar hoy?" → recommendations con razón semántica
- [ ] "¿Qué estoy olvidando?" → sujetos con retrievability más baja + loss projection
- [ ] "¿Estoy listo para mi examen?" → `forecast.examPreparation`
- [ ] La IA recibe `confidence` y puede decir "aún no tengo suficientes datos" si es baja

### K4.2 — Notificaciones

- [ ] Consulta `health.forgettingRisk` en vez de solo `dueCount > 0`
- [ ] "Tu memoria de Química está decayendo (Critical). 12 min hoy la recuperan."
- [ ] No notificar si riesgo es 'low' o confianza < 0.5

### K4.3 — Calendario

- [ ] Días con más due cards tienen intensidad visual (heatmap)
- [ ] Eventos de examen: "Preparación: 78%" desde `forecast.examPreparation`

### K4.4 — Notas (grades × knowledge)

- [ ] Junto al promedio: "Dominio: 62%"
- [ ] Detección de casos:
  - Nota alta + dominio bajo → "Aprobaste pero no retienes. Riesgo en examen final."
  - Nota baja + dominio alto → "Sabes más de lo que reflejan tus notas."

---

## Knowledge Authority Matrix

Quién tiene autoridad para qué en el dominio de conocimiento:

| Operación | Autoridad | Implementación |
|-----------|-----------|----------------|
| **Calcular** estado cognitivo | `FlashcardDomainService` + FSRS | Escribe `fsrs_stability`, `fsrs_difficulty`, `next_review_date` en SQLite |
| **Proyectar** snapshot | `KnowledgeProjection` | Lee SQLite, aplica mapeo semántico, produce `KnowledgeSnapshot` |
| **Cachear** snapshot | `KnowledgeCache` (implementa `KnowledgeProvider`) | Almacena en memoria con `validUntil` y `age` |
| **Consumir** snapshot | Dashboard, IA, Notas, Calendario, Notificaciones | Solo conocen `KnowledgeProvider` interfaz |
| **Transformar** a UI | Componentes React | Solo leen propiedades semánticas (`memoryLevel`, `momentum`, `risk`), nunca crudos |
| **Persistir** histórico | Fuera del alcance actual (futuro) | Podría ser tabla `knowledge_snapshots` en SQLite |

**Reglas de autoridad**:
- Nadie fuera de `KnowledgeProjection` puede construir un `KnowledgeSnapshot`
- Nadie fuera de `FlashcardDomainService` puede modificar parámetros FSRS
- La UI jamás ejecuta `calculateRetrievability()`
- La IA recibe el snapshot ya construido; no lo construye

---

## Estructura de Archivos Final

```
mobile/src/domain/
├── fsrs/                           # Sin cambios
│   ├── types.ts
│   ├── calculateFSRS.ts
│   ├── calculateElapsedDays.ts
│   ├── calculateNextReviewDate.ts
│   ├── FlashcardDomainService.ts
│   └── ReviewSchedulingPolicy.ts
├── learning/
│   └── ReviewScheduler.ts          # Refactor K0.3
└── knowledge/                      # NUEVO
    ├── types.ts                    # K1.1 - Snapshot compuesto + semántica
    ├── KnowledgeProvider.ts        # K1.2 - Interfaz
    ├── KnowledgeProjection.ts      # K1.4 - Implementación (1 query)
    ├── retrievability.ts           # K1.3 - Helper puro
    └── __tests__/
        ├── KnowledgeProjection.test.ts    # K1.5
        └── benchmark.test.ts              # K1.6

mobile/src/hooks/
└── useKnowledgeInsights.ts         # K2.3

mobile/src/components/
└── dashboard/
    ├── KnowledgeHealthCard.tsx      # K2.1
    └── SubjectMiniCard.tsx          # K2.4
```

## Contrato Inquebrantable

```typescript
// ✅ Lo que el Dashboard conoce:
import { KnowledgeProvider } from '../../domain/knowledge/KnowledgeProvider';
// La implementación se inyecta (DI o default)
const provider: KnowledgeProvider = getKnowledgeProvider();
const snapshot = await provider.buildSnapshot(userId);

snapshot.health.score;              // 84
snapshot.health.memoryLevel;        // 'excellent'
snapshot.health.confidence;         // 0.96
snapshot.momentum.momentum;         // 'improving'
snapshot.balance.balance;           // 'excellent'
snapshot.forecast.lossProjection.loss7d;  // 15
snapshot.age;                       // 'fresh'

// ❌ Lo que el Dashboard NO conoce (ni debe importar):
// - KnowledgeProjection (la implementación concreta)
// - FlashcardDomainService
// - ReviewScheduler
// - calculateFSRS
// - calculateRetrievability
// - flashcardRepository
// - syncService
// - databaseService
// - "fsrs_stability", "retrievability", "intervalDays"
// - "flashcard", "deck", "card"

📌 Regla del Value Object:
El snapshot es inmutable. Ningún consumidor lo muta.
Cada buildSnapshot() genera una nueva instancia.
El cache reemplaza snapshots enteros, nunca muta parcialmente.

## Criterio de "Done"

| Fase | Criterio |
|------|----------|
| K0 | Todas las flashcards tienen FSRS data válida. Modo producción activo. ReviewScheduler usa retrievability real. Agregación optimizada lista. |
| K1 | `KnowledgeProjection.buildSnapshot()` implementa `KnowledgeProvider`. 1 query. Snapshot con 6 sub-agregados (health, momentum, balance, forecast, reviews, subjects). Mapeo semántico completo. Tests. |
| K1.5 | Checklist de certificación completo. Snapshot determinista, reproducible, < 50 ms, offline, compatible SyncQueue. |
| K1.6 | Benchmark pasa en los 5 escenarios. Sin leaks. Query < 30%, mapping < 30%, proyección < 40%. |
| K2 | Dashboard consume `KnowledgeProvider`. Muestra Estado de Aprendizaje (score, momentum, riesgo, balance, loss projection, tiempo estimado, confianza). Recomendaciones. Web de materias. |
| K3 | Detalle de materia con salud, memory map, velocity, loss projection. Todo desde el mismo Snapshot. |
| K4 | IA, notificaciones, calendario y notas consumen `KnowledgeProvider`. No hay cálculos duplicados. Knowledge Authority Matrix respetada. |
