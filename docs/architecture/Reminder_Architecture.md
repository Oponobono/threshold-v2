# Reminder System — Architecture

Este documento traduce el Domain Model a arquitectura técnica. Define las capas, responsabilidades, interfaces y flujo de datos del subsistema.

---

## 1. Responsabilidad Mínima e Irrenunciable de Cada Componente

Cada componente responde una sola pregunta. Si la respuesta cabe en una frase, la arquitectura está lista.

| Componente | Responsabilidad |
|------------|----------------|
| **NotificationProvider** | Traducir operaciones a expo-notifications. |
| **ProgressNotifier** | Notificaciones de progreso (backup, download). No pasa por el Engine. |
| **ReminderPolicy** | Decidir **cuándo** deben existir recordatorios para una entidad. |
| **SequenceFactory** | Crear Reminders de dominio desde entidad + offsets. IDs deterministas. No conoce presentación. |
| **InterruptionPriority** | Valor que expresa la urgencia de interrupción de un recordatorio. |
| **InterruptionPolicy** | Transformar `ReminderSequence[]` en `DeliveryPlan` de dominio resolviendo colisiones. |
| **TemplateResolver** | Enriquecer `DeliveryPlan` de dominio con datos de presentación (title, body, deeplink). |
| **NotificationReconciler** | Mantener sincronizado el `DeliveryPlan` enriquecido con el estado real de Expo. |
| **ReminderEngine** | Coordinar el ciclo de vida. Pipeline interno `buildDesiredSequence()`. Dependencias inyectadas. Sin Expo. |
| **ReminderProfile** | Objeto de valor con la estrategia de offsets para una entidad. |
| **Clock** | Abstracción del tiempo. Permite testear sin fechas reales. |
| **PerformanceObserver** | Interfaz para instrumentar etapas del pipeline sin alterar comportamiento. NullObserver por defecto. |
| **MetricsCollector** | Implementación de PerformanceObserver con ring buffer. summarize() produce avg/p50/p95/max. |
| **NavigationContract** | Contrato entre el Engine y la app para deep links. parseDeeplink() + getTargetRoute(). |

---

## 2. Arquitectura en Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    CONSUMERS                                 │
│  useReminderEngine · Settings · BackupLogic                  │
│  _layout.tsx (notification tap → NavigationContract)        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                  PERFORMANCE OBSERVER (opcional)              │
│                                                              │
│  Pipeline → observer.record(stage, durationMs, meta)         │
│                                                              │
│  Implementaciones:                                           │
│    - NullObserver (default, no-op)                           │
│    - MetricsCollector (ring buffer + summarize)              │
│                                                              │
│  Sin cambios de comportamiento cuando no se inyecta.        │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                  REMINDER ENGINE                             │
│                                                              │
│  Dependencias inyectadas en constructor:                     │
│    - PolicyRegistry, SequenceFactory, InterruptionPolicy     │
│    - TemplateResolver, NotificationReconciler, Clock         │
│                                                              │
│  Pipeline interno (con stage timing):                        │
│    entity.build (policy + factory)                           │
│    collect_sequences (copy desiredSequences)                 │
│    interruption.resolve (timestamps + prioridades)          │
│    templates.enrich (i18n + deeplinks)                      │
│    reconciler.sync (diff + schedule/cancel)                 │
│                                                              │
│  FIFO queue interna:                                         │
│    onEntityChanged, onActionCompleted → cola → process()     │
│    Garantiza: un evento a la vez, orden FIFO                 │
│                                                              │
└───────────────────────────┬─────────────────────────────────┘
│                                                              │
│  Resolve(sequences: readonly ReminderSequence[])             │
│    → DeliveryPlan (dominio, sin presentación)                │
│                                                              │
│  DeliveryPlan.domain:                                        │
│    planId, version, deliverables[] con id, scheduledAt,      │
│    entityType, entityId, intent, priority                    │
│    Sin title, body, deeplink                                 │
│                                                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              TEMPLATE RESOLVER                                │
│                                                              │
│  Enrich(plan: DeliveryPlan) → DeliveryPlan (enriquecido)     │
│                                                              │
│  Agrega: title, body, deeplink, badge                        │
│  No modifica: id, scheduledAt, entityType, entityId          │
│  No necesita Clock                                           │
│                                                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              NOTIFICATION RECONCILER                         │
│                                                              │
│  Sync(plan: DeliveryPlan, provider: NotificationProvider)    │
│                                                              │
│  - provider.getAll() → estado real en Expo                   │
│  - diff: plan vs real                                        │
│  - provider.schedule() × N (solo lo que falta)               │
│  - provider.cancel() × M (solo lo que sobra)                 │
│                                                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              NOTIFICATION PROVIDER                           │
│                                                              │
│  schedule(notification: ScheduledReminder) → Promise<string> │
│  cancel(id)                                                  │
│  cancelAll(prefix?)                                          │
│  getAll()                                                    │
│  requestPermissions()                                        │
│  setupChannels()                                             │
│                                                              │
│  No conoce Assessment, Schedule, ni Flashcard.               │
│  Solo traduce a expo-notifications.                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  expo-notifications (~0.32.16)                         │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PROGRESS NOTIFIER                               │
│                                                              │
│  show(id, title, body, progress)                             │
│  update(id, progress, body)                                  │
│  complete(id, title, body)                                   │
│  cancel(id)                                                  │
│                                                              │
│  No pasa por Engine. Uso directo desde backup, download.     │
│  Puede compartir NotificationProvider internamente.          │
└─────────────────────────────────────────────────────────────┘
```

**Flujo de datos completo**:

```
Evento del dominio (entity created/updated/deleted)
    │
    ▼
Engine FIFO queue → process()
    │
    └─ if entityChanged:
    │    buildDesiredSequence(entity)
    │      → policy.getOffsets()
    │      → factory.buildSequence(entity, entityType, offsets)
    │    → desiredSequences[] actualizado
    │
    └─ if actionCompleted:
         → secuencia marcada como completed
         → desiredSequences[] actualizado
    │
    ▼
Plan de dominio (sin presentación):
    interruption.resolve(desiredSequences)
    → DeliveryPlan { planId, version, deliverables[] }
    │
    ▼
Plan enriquecido (con presentación):
    templates.enrich(plan)
    → DeliveryPlan { planId, ..., deliverables[].{title, body, deeplink} }
    │
    ▼
    reconciler.sync(plan, provider)
    → diff vs Expo → schedule/cancel
```

---

## 3. Tipos del Sistema

Todos los tipos son **inmutables** (`readonly`). Ningún objeto se modifica después de creado.

### 3.1 Clock

```ts
interface Clock {
  now(): Date;
}
```

Inyección obligatoria. `new Date()` y `Date.now()` prohibidos fuera de `Clock.ts`.

- **Producción**: `SystemClock` (delega a `new Date()`)
- **Tests**: `FakeClock(anchorDate: Date, options?: { advanceMs?: number })`

### 3.2 ReminderIntent

```ts
type ReminderIntent =
  | "prepare_exam"
  | "attend_class"
  | "review_cards"
  | "submit_work"
  | "digest"
  | "follow_up";
```

### 3.3 InterruptionPriority

```ts
type InterruptionPriority = 'low' | 'normal' | 'high' | 'critical';
```

Eje ortogonal a `ReminderProfile`. Un reminder puede ser `minimal` (pocos offsets) y `critical` (urgencia alta).

### 3.4 ReminderProfile

```ts
interface ReminderProfile {
  readonly name: 'minimal' | 'standard' | 'persistent' | 'custom';
  readonly defaultOffsets: readonly number[];
  readonly customOffsets?: readonly number[];
}
```

El `priority` vive en cada `Reminder`, no en el Profile.

### 3.5 Reminder (Dominio)

```ts
interface Reminder {
  readonly id: string;                      // Determinista: hash(entityType + entityId + ordinal)
  readonly entityType: string;
  readonly entityId: string;
  readonly subjectId?: string;              // Para contexto visual (TemplateResolver)
  readonly scheduledAt: Date;
  readonly intent: ReminderIntent;
  readonly profile: ReminderProfile;
  readonly priority: InterruptionPriority;
  readonly sequenceId: string;
  readonly ordinal: number;
  readonly status: ReminderStatus;          // Gestionado externamente (Engine Map)
}
```

Sin `title`, `body`, `badge`, `deeplink`. No contiene datos de presentación.

**Nota**: El `status` aparece en la definición del tipo porque describe el contrato del recordatorio, pero el Engine mantiene el estado real en un mapa externo (`Map<reminderId, ReminderStatus>`). El Reminder como Value Object es inmutable; su estado evoluciona fuera de él.

### 3.6 ReminderSequence (Dominio)

```ts
interface ReminderSequence {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly reminders: readonly Reminder[];
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly status: SequenceStatus;
}
```

### 3.7 DeliveryPlan

```ts
interface DeliveryPlan {
  readonly planId: string;                        // UUID para trazabilidad
  readonly version: number;                       // Incremental por plan generado
  readonly generatedAt: Date;
  readonly deliverables: readonly DeliveryReminder[];
}

interface DeliveryReminder {
  readonly id: string;                            // Mismo ID que el Reminder de dominio
  readonly scheduledAt: Date;                     // Puede estar desplazado por colisión
  readonly entityType: string;
  readonly entityId: string;
  readonly subjectId?: string;                    // Para contexto visual
  readonly intent: ReminderIntent;
  readonly priority: InterruptionPriority;

  // Resueltos por TemplateResolver:
  readonly title: string;
  readonly body: string;
  readonly deeplink?: string;
  readonly badge?: number;
}
```

**Regla**: Inmutable. Se genera, se consume, se descarta. No se modifica después de creado.

### 3.8 ReminderStatus y SequenceStatus

```ts
type ReminderStatus = 'pending' | 'scheduled' | 'delivered' | 'tapped' | 'dismissed' | 'ignored' | 'superseded';
type SequenceStatus = 'active' | 'waiting_feedback' | 'completed' | 'cancelled' | 'expired';
```

### 3.9 EnvironmentContext (para cambios externos)

```ts
interface EnvironmentContext {
  readonly timezone?: string;           // Nueva zona horaria si cambió
  readonly locale?: string;             // Nuevo locale si cambió
  readonly permissions?: PermissionState;  // Estado actual de permisos
}
```

`onEnvironmentChanged()` le permite al Engine reaccionar a cambios externos sin necesidad de eventos específicos por cada factor. Si solo cambió la zona horaria, el Engine regenera los `scheduledAt` de las secuencias activas. Si cambiaron los permisos, ajusta el comportamiento del Reconciler.

### 3.10 StageTiming (para PerformanceObserver)

```ts
interface StageTiming {
  readonly name: string;         // 'entity.build' | 'collect_sequences' | 'interruption.resolve' | 'templates.enrich' | 'reconciler.sync'
  readonly durationMs: number;
  readonly entityCount?: number;
  readonly sequenceCount?: number;
  readonly scheduledCount?: number;
  readonly cancelledCount?: number;
}

interface StageMetricsSummary {
  stage: string;
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}
```

El `EngineTraceEntry` incluye `stages?: readonly StageTiming[]` para que cada entrada del trace log contenga el desglose por etapa del pipeline.

### 3.11 ScheduledReminder (para NotificationProvider)

```ts
interface ScheduledReminder {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly scheduledAt: Date;
  readonly priority: InterruptionPriority;
  readonly badge?: number;
  readonly deeplink?: string;
}
```

---

## 4. Capas Detalladas

### 4.1 NotificationProvider

**Responsabilidad**: traducir operaciones a expo-notifications. No conoce Assessment, Schedule ni Flashcard.

**Ubicación**: `mobile/src/services/reminders/NotificationProvider.ts`

```ts
interface NotificationProvider {
  requestPermissions(): Promise<boolean>;
  setupChannels(): Promise<void>;
  schedule(notification: ScheduledReminder): Promise<string>;
  cancel(id: string): Promise<void>;
  cancelAll(prefix?: string): Promise<void>;
  getAll(): Promise<ScheduledNotification[]>;
}
```

### 4.2 ProgressNotifier

**Responsabilidad**: notificaciones de progreso (backup upload/download, modelo IA). No pasa por el Engine.

**Ubicación**: `mobile/src/services/reminders/ProgressNotifier.ts`

```ts
interface ProgressNotifier {
  show(id: string, title: string, body: string, progress: number): Promise<void>;
  update(id: string, progress: number, body: string): Promise<void>;
  complete(id: string, title: string, body: string): Promise<void>;
  cancel(id: string): Promise<void>;
}
```

### 4.3 ReminderPolicy

**Responsabilidad**: decidir cuándo deben existir recordatorios para una entidad. Función pura.

**Ubicación**: `mobile/src/services/reminders/policies/*.ts`

```ts
interface ReminderPolicy {
  readonly entityType: string;
  readonly defaultProfile: ReminderProfile;

  /** Devuelve offsets en minutos relativos al evento.
   *  Negativos = antes, 0 = exacto, Positivos = después. */
  getOffsets(entity: any, profile: ReminderProfile): readonly number[];

  /** ¿Esta secuencia debería cancelarse? */
  shouldCancel(sequence: ReminderSequence, entity: any): boolean;

  /** ¿Este reminder individual debería cancelarse?
   *  Permite cancelar offsets específicos (ej: post-evento si la clase ya empezó)
   *  sin cancelar la secuencia completa. */
  shouldCancelReminder(reminder: Reminder, entity: any): boolean;

  /** ¿Cuándo expira la relevancia? */
  getExpiration(entity: any): Date | null;
}
```

### 4.4 SequenceFactory

**Responsabilidad**: crear Reminders de dominio desde entity + offsets. IDs deterministas.

**Ubicación**: `mobile/src/services/reminders/SequenceFactory.ts`

```ts
class SequenceFactory {
  constructor(private clock: Clock) {}

  buildSequence(
    entity: any,
    entityType: string,
    offsets: readonly number[],
  ): ReminderSequence;
}
```

**Lo que hace**:
1. Calcula timestamps absolutos usando `clock.now()`.
2. Genera IDs deterministas: `hash(entityType + entityId + ordinal)`.
3. Asigna `intent` según offset (negativo → `"prepare_exam"`/`"attend_class"`, positivo → `"follow_up"`).
4. Asigna `priority` según contexto (assessment próximo → `critical`).
5. Calcula `expiresAt`.

**Lo que NO hace**: resolver textos, icons, sounds, deeplinks.

### 4.5 InterruptionPolicy

**Responsabilidad**: transformar `ReminderSequence[]` en `DeliveryPlan` de dominio.

No modifica las secuencias. No conoce presentación.

**Ubicación**: `mobile/src/services/reminders/InterruptionPolicy.ts`

```ts
class InterruptionPolicy {
  private planCounter = 0;

  resolve(sequences: readonly ReminderSequence[]): DeliveryPlan;
}
```

**Reglas**:

| Regla | Comportamiento |
|-------|---------------|
| **Prioridad** | Dos reminders en el mismo minuto → gana el de mayor prioridad. El otro se desplaza +5 min. |
| **Límite simultáneo** | Máximo 3 reminders. Más de 3 → se agrupan por prioridad. |
| **Supresión contextual** | Si hay estudio activo, no se entregan reminders de review. |
| **Agrupación** | Múltiples reminders en ventana de 5 min se agrupan en una notificación. |

**Entrega**: `DeliveryPlan` con `planId` (UUID), `version` (incremental por generación), `generatedAt`, `deliverables[]`.

### 4.6 TemplateResolver

**Responsabilidad**: enriquecer un `DeliveryPlan` de dominio con datos de presentación.

No necesita `Clock`. No modifica `id`, `scheduledAt`, `entityType`, `entityId`, `intent`, `priority`.

**Ubicación**: `mobile/src/services/reminders/TemplateResolver.ts`

```ts
class TemplateResolver {
  constructor(private i18n: I18nService) {}

  enrich(plan: DeliveryPlan): DeliveryPlan;
}
```

**Lo que agrega**:
- `title` y `body` resueltos vía i18n + datos de la entidad.
- `deeplink` según `entityType` e `intent`.
- `badge` count.

### 4.7 NotificationReconciler

**Responsabilidad**: mantener el `DeliveryPlan` sincronizado con el estado real de Expo.

**Ubicación**: `mobile/src/services/reminders/NotificationReconciler.ts`

```ts
interface NotificationReconciler {
  sync(plan: DeliveryPlan, provider: NotificationProvider): Promise<void>;
  clear(provider: NotificationProvider): Promise<void>;
}
```

**Flujo interno**:

```
sync(plan, provider)
    ├─ 1. Recolectar IDs de plan.deliverables
    ├─ 2. provider.getAll() → estado real
    ├─ 3. diff:
    │    ├─ en plan pero no en Expo → provider.schedule(reminder)
    │    ├─ en Expo pero no en plan → provider.cancel(id)
    │    └─ coinciden → noop
    └─ 4. retornar
```

### 4.8 ReminderEngine

**Responsabilidad**: coordinar el ciclo de vida. Pipeline `buildDesiredSequence()`. FIFO queue para eventos.

**Ubicación**: `mobile/src/services/reminders/ReminderEngine.ts`

```ts
class ReminderEngine {
  constructor(
    private registry: PolicyRegistry,
    private factory: SequenceFactory,
    private interruption: InterruptionPolicy,
    private templates: TemplateResolver,
    private reconciler: NotificationReconciler,
    private provider: NotificationProvider,
    private clock: Clock
  );

  async initialize(entities: EntitySnapshot): Promise<void>;
  async onEntityChanged(entityType: string, entityId: string, entity: any): Promise<void>;
  async onEntityDeleted(entityType: string, entityId: string): Promise<void>;
  async onEnvironmentChanged(context: EnvironmentContext): Promise<void>;
  onReminderTapped(reminderId: string): void;  // síncrono, solo navega
  async onActionCompleted(entityType: string, entityId: string): Promise<void>;
  async cancelAll(): Promise<void>;
  getDesiredSequences(): readonly ReminderSequence[];
  destroy(): void;

  // Pipeline interno
  private buildDesiredSequence(entity: any, entityType: string): ReminderSequence;
  private async process(event: EngineEvent): Promise<void>;  // FIFO queue consumer
}
```

**Pipeline `buildDesiredSequence()`**:

```ts
private buildDesiredSequence(entity: any, entityType: string): ReminderSequence {
  const policy = this.registry.get(entityType);
  const profile = this.getProfileFor(entityType);
  const offsets = policy.getOffsets(entity, profile);
  return this.factory.buildSequence(entity, entityType, offsets);
}
```

**FIFO queue**:

```
onEntityChanged(type, id, entity)
    │
    └─ eventQueue.push({ type: 'entity_changed', entityType, entityId, entity })
         │
         ▼
    (microtask/setTimeout) → process()
         │
         ├─ Toma primer evento de la cola
         ├─ buildDesiredSequence(entity)
         ├─ desiredSequences[] actualizado
         ├─ plan = interruption.resolve(desiredSequences)
         ├─ enriched = templates.enrich(plan)
         ├─ reconciler.sync(enriched, provider)
         └─ Si hay más eventos en cola → process() again

onActionCompleted(type, id)
    │
    └─ Mismo flujo FIFO
```

**Reglas**:
- Un evento a la vez. El siguiente evento no se procesa hasta que el anterior completó `reconciler.sync()`.
- `onReminderTapped()` no pasa por la cola porque es síncrono y no modifica estado.

### 4.9 PerformanceObserver

**Responsabilidad**: instrumentar etapas del pipeline sin alterar comportamiento funcional.

**Ubicación**: `mobile/src/services/reminders/PerformanceObserver.ts`

```
Pipeline → observer.record(stage, durationMs, meta) → MetricsCollector → ring buffer → summarize()
```

```ts
interface PerformanceObserver {
  record(stage: StageName, durationMs: number, meta?: object): void;
}

class NullObserver implements PerformanceObserver {
  // no-op — default para tests y producción sin instrumentación
}

class MetricsCollector implements PerformanceObserver {
  // ring buffer por stage
  summarize(): StageMetricsSummary[]  // avg, p50, p95, max, count
  clear(): void
  getTotalSamples(): number
}
```

**StageNames** instrumentados en `Engine._runPipeline()` y `_buildDesiredSequence()`:

| Stage | Dónde se mide | Qué incluye |
|---|---|---|
| `snapshot_builder.build` | Coordinator.initialize/resync | Duración total de buildSnapshot() |
| `entity.build` | Engine._buildDesiredSequence() | policy.getOffsets + factory.buildSequence |
| `collect_sequences` | Engine._runPipeline() inicio | Copy de desiredSequences a array |
| `interruption.resolve` | Engine._runPipeline() | Resolución de colisiones |
| `templates.enrich` | Engine._runPipeline() | i18n lookups + deeplinks |
| `reconciler.sync` | Engine._runPipeline() | diff + schedule/cancel real en Expo |

**Principios**:
1. **Pasivo**: el observer nunca modifica el flujo del pipeline. Solo registra.
2. **Desactivable**: NullObserver por defecto. Sin coste cuando no se inyecta.
3. **Zero imports de infraestructura**: la interfaz y NullObserver son dominio puro.
4. **Agregación fuera del Engine**: MetricsCollector es un consumidor — no forma parte del Engine.

### 4.10 NavigationContract

**Responsabilidad**: contrato explícito entre el ReminderEngine y la aplicación para deep links. Traduce `threshold://...` URIs a rutas de navegación.

**Ubicación**: `mobile/src/services/reminders/NavigationContract.ts`

```ts
type ReminderEntityType = 'assessment' | 'schedule' | 'flashcard_deck' | 'grading_period' | 'calendar_event';

interface ReminderNavigationPayload {
  readonly deeplink: string;
  readonly entityType: ReminderEntityType;
  readonly entityId: string;
}

// Extrae entityType + entityId de un deep link
function parseDeeplink(deeplink: string): ReminderNavigationPayload | null;

// Mapea entityType a ruta Expo Router
function getTargetRoute(entityType: ReminderEntityType): string;
```

**Formato de deep links**:

| EntityType | URI |
|---|---|
| assessment | `threshold://assessments/{id}` |
| schedule | `threshold://schedules/{id}` |
| flashcard_deck | `threshold://decks/{id}` |
| grading_period | `threshold://grades/{id}` |
| calendar_event | `threshold://events/{id}` |

**Flujo de integración**:

1. **TemplateResolver** genera `deeplink` en el DeliveryPlan enriquecido.
2. **NotificationProvider** lo incluye en `content.data.deeplink` al scheduler en Expo.
3. **`_layout.tsx`** recibe la notificación. Lee `data.deeplink` primero:
   - Si se parsea correctamente → navega a `getTargetRoute(entityType)` con `{ entityId, entityType }` como params.
   - Si no hay deeplink válido → fallback a legacy `data.type` (`deadline`, `duedeck`, etc.).

**Edge cases**:
- **Recurso eliminado**: la navegación llega a la pantalla genérica (calendar, flashcards). El target screen maneja el ID no encontrado.
- **Formato inválido**: `parseDeeplink` retorna null. Se usa fallback legacy.
- **Deep link de sesión anterior**: el Engine regenera el plan desde entidades actuales. El deep link queda obsoleto pero la navegación es inofensiva (entity ID no encontrado → pantalla vacía).

---

## 5. Directorio de Archivos

```
mobile/src/services/reminders/
├── NotificationProvider.ts          # Expo wrapper (solo reminder notifications)
├── ProgressNotifier.ts              # Progress notifications (backup, download)
├── ReminderEngine.ts                # Coordinador + FIFO queue
├── NotificationReconciler.ts        # Diff engine
├── SequenceFactory.ts               # Offsets → Reminders (IDs deterministas)
├── TemplateResolver.ts              # DeliveryPlan → DeliveryPlan enriquecido
├── InterruptionPolicy.ts            # Colisiones → DeliveryPlan
├── PolicyRegistry.ts                # entityType → Policy
├── Clock.ts                         # SystemClock + FakeClock
├── types.ts                         # Tipos inmutables del dominio
├── PerformanceObserver.ts           # PerformanceObserver interface + NullObserver + MetricsCollector
├── NavigationContract.ts            # parseDeeplink() + getTargetRoute() — contrato app↔Engine
├── ReminderCoordinator.ts           # Adaptador Engine ↔ DataStore/EventBus
├── ReminderSnapshotBuilder.ts       # Builds EntitySnapshot desde repositorios
├── ReminderSystemFactory.ts         # Composition root (wirea todo)
├── index.ts                         # Barrel exports
│
├── policies/
│   ├── AssessmentPolicy.ts
│   ├── ClassPolicy.ts
│   ├── EventPolicy.ts
│   ├── ReviewPolicy.ts
│   └── GradingPolicy.ts
│
├── __tests__/
│   ├── NavigationContract.test.ts   # 15 tests (parseDeeplink, getTargetRoute)
│   ├── PerformanceObserver.test.ts  # MetricsCollector: summarize, ring buffer
│   ├── ReminderEngine.test.ts
│   ├── ReminderCoordinator.test.ts
│   ├── ReminderSnapshotBuilder.test.ts
│   ├── ReminderRegression.test.ts   # 10 tests, 8 escenarios críticos (CI gate)
│   ├── Fase3Integration.test.ts
│   ├── DeltaSyncConvergence.test.ts
│   ├── SessionIsolation.test.ts
│   ├── ValidationSprint.test.ts
│   ├── NotificationReconciler.test.ts
│   ├── SequenceFactory.test.ts
│   ├── TemplateResolver.test.ts
│   ├── Clock.test.ts
│   ├── NotificationProvider.test.ts
│   ├── ProgressNotifier.test.ts
│   ├── subscribeToEventBus.test.ts
│   ├── interruption/
│   │   └── InterruptionPolicy.test.ts
│   └── policies/
│       ├── AssessmentPolicy.test.ts
│       ├── ClassPolicy.test.ts
│       ├── EventPolicy.test.ts
│       ├── GradingPolicy.test.ts
│       ├── PolicyRegistry.test.ts
│       ├── ReviewPolicy.test.ts
│       └── Integration.test.ts
│
├── CI gate (GitHub Actions):
│   └── .github/workflows/reminder-regression.yml
│       - Se activa en PRs contra mobile/src/services/reminders/**
│       - regression suite primero (fallo rápido)
│       - full suite después (24 suites, 290 tests)
│
└── **Estado**: Stable v1.0 (Jul 2026)
    - 24 suites, 290 tests, 0 failures
    - Core, integración, validación, observabilidad, contrato navegación
    - Próximo trabajo: producto (UX, permisos, configuración, validación dispositivos)
```

---

## 6. Flujo Completo

### 6.1 App inicia

```
Bootstrap READY
    │
    └─ engine.initialize(entities)
         │
         ├─ buildDesiredSequence(assessment)
         │    → policy.getOffsets() → [-10080, -4320, -1440, -60, 0]
         │    → factory.buildSequence(assessment, offsets, profile, clock)
         │    → ReminderSequence (sin textos)
         │
         ├─ buildDesiredSequence(schedule)
         │    → [-30, -5, 0, +10, +20]
         │
         ├─ interruption.resolve(desiredSequences)
         │    → DeliveryPlan { planId, version, deliverables[] } (dominio)
         │
         ├─ templates.enrich(plan)
         │    → DeliveryPlan con title, body, deeplink
         │
         └─ reconciler.sync(plan, provider)
              ├─ provider.getAll()
              ├─ diff
              ├─ provider.schedule() × N
              └─ provider.cancel() × M
```

### 6.2 Usuario crea un Assessment

```
UI → createAssessment(data)
    │
    ├─ SQLite persiste
    ├─ EventBus: "created:assessments"
    │
    └─ engine.onEntityChanged("assessment", id, assessment)
         │
         └─ FIFO queue → process()
              └─ buildDesiredSequence → interruption → templates → reconciler
```

### 6.3 Se dispara una notificación

```
Expo trigger → notificación visible
    │
    └─ Usuario:
         │
         ├─ Toca → engine.onReminderTapped(reminderId)
         │    └─ Navega según intent (síncrono, no modifica estado)
         │
         ├─ Descarta → SO maneja (no llega al Engine)
         │
         └─ Marca acción completa → engine.onActionCompleted(type, id)
              └─ FIFO queue → process()
                   ├─ sequence.status = "completed"
                   ├─ interruption.resolve()
                   ├─ templates.enrich()
                   └─ reconciler.sync() → cancela notifs restantes
```

### 6.4 Entity cambia

```
UI → updateSchedule(id, { start_time: "18:00" })
    │
    ├─ SQLite actualiza
    ├─ EventBus: "updated:schedules"
    │
    └─ engine.onEntityChanged("schedule", id, updated)
         └─ FIFO queue → process()
              └─ buildDesiredSequence → interruption → templates → reconciler
```

### 6.5 Ráfaga de eventos (concurrencia)

```
50ms:   onEntityChanged("schedule", "s1", updated1)
60ms:   onEntityChanged("assessment", "a1", updated1)
70ms:   onEntityChanged("schedule", "s1", updated2)

FIFO queue: [s1-updated1, a1-updated1, s1-updated2]

process():
    ├─ s1-updated1 → buildDesiredSequence(s1) → reconciler.sync(plan1)
    ├─ a1-updated1 → buildDesiredSequence(a1) → reconciler.sync(plan2)
    └─ s1-updated2 → buildDesiredSequence(s1) → reconciler.sync(plan3)
       (el plan3 refleja el estado final de s1, no el intermedio)
```

---

## 7. Relación con el Dominio Existente

El Reminder System consume de dominios existentes pero no los modifica:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Knowledge       │     │  Study           │     │  Calendar        │
│  Domain          │     │  Domain          │     │  Domain          │
│  (FSRS, decks)   │     │  (sessions)      │     │  (events)        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                         ┌───────▼───────┐
                         │  Reminder      │
                         │  System        │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │  Notificaciones│
                         │  del SO        │
                         └───────────────┘
```

El Reminder System:
- **Lee** de: assessments, schedules, calendarEvents, flashcardDecks, flashcards (FSRS), gradingPeriods, studySessions.
- **No escribe** en ninguna de esas entidades.
- **No modifica** el Knowledge Domain, el Study Domain ni el Calendar Domain.
- **Solo produce** notificaciones en el sistema operativo.

## 8. Integración con el Sistema Actual

### 7.1 notificationService.ts → se divide en:

| Función actual | Destino |
|---------------|---------|
| `requestPermissions()` | NotificationProvider |
| `setupChannels()` | NotificationProvider |
| `scheduleDeadlineNotification()` | AssessmentPolicy + Engine |
| `scheduleClassNotification()` | ClassPolicy + Engine |
| `scheduleUrgentReviewNotification()` | ReviewPolicy + Engine |
| `scheduleWeeklyDigest()` | (DigestPolicy + Engine) |
| `scheduleDueDeckNotification()` | ReviewPolicy + Engine |
| `show*Notification()` (backup/dl) | ProgressNotifier |
| `update*Notification()` (backup/dl) | ProgressNotifier |
| `cancel*Notification()` (backup/dl) | ProgressNotifier |
| `getScheduledNotifications()` | NotificationProvider.getAll() |

### 7.2 useNotifications.ts → se reemplaza por:

```ts
function useReminderEngine(): ReminderEngineState {
  // Crea Engine con dependencias inyectadas
  // Suscribe a EventBus
  // Expone: desiredSequences, stats, acciones
}
```

### 7.3 Preferencias → AsyncStorage → MMKV

| Key actual | Key nueva (MMKV) | Tipo | Default |
|-----------|-----------------|------|---------|
| `notif_deadline` | `reminder_profile_assessment` | `string` | `"standard"` |
| `notif_weekly` | `reminder_profile_digest` | `string` | `"standard"` |
| `notifEmail` | (se elimina) | — | — |
| `weekly_config` | `reminder_digest_day/h` | `string` | `"1"`, `"9"` |
| (nueva) | `reminder_profile_schedule` | `string` | `"standard"` |
| (nueva) | `reminder_profile_review` | `string` | `"standard"` |
| (nueva) | `reminder_profile_grading` | `string` | `"standard"` |
| (nueva) | `reminder_profile_event` | `string` | `"standard"` |
| (nueva) | `reminder_silence_until` | ISO string o null | `null` |

---

## 9. Estrategia de Testing

### 8.1 Tests con FakeClock

```ts
const clock = new FakeClock(new Date('2026-07-10T12:00:00Z'));
const factory = new SequenceFactory(clock);
const seq = factory.buildSequence(assessment, 'assessment', offsets, profile);
expect(seq.reminders[0].scheduledAt).toEqual(new Date('2026-07-03T12:00:00Z'));
```

### 8.2 Tests de IDs deterministas

```ts
it('mismo input produce mismo ID', () => {
  const seq1 = factory.buildSequence(assessment, 'assessment', offsets, profile);
  const seq2 = factory.buildSequence(assessment, 'assessment', offsets, profile);
  expect(seq1.reminders[0].id).toEqual(seq2.reminders[0].id);
});
```

### 8.3 Tests de InterruptionPolicy → DeliveryPlan

```ts
it('DeliveryPlan tiene planId y version únicos', () => {
  const plan1 = interruption.resolve([seq]);
  const plan2 = interruption.resolve([seq]);
  expect(plan1.planId).not.toEqual(plan2.planId);
  expect(plan2.version).toBe(plan1.version + 1);
});

it('desplaza reminder de menor prioridad', () => {
  const plan = interruption.resolve([highSeq, lowSeq]);
  expect(plan.deliverables[1].scheduledAt - plan.deliverables[0].scheduledAt)
    .toBe(5 * 60 * 1000); // +5 min
});
```

### 8.4 Tests de TemplateResolver

```ts
it('enriquece DeliveryPlan con title y body', () => {
  const resolver = new TemplateResolver(mockI18n);
  const enriched = resolver.enrich(domainPlan);
  expect(enriched.deliverables[0].title).toBeDefined();
  expect(enriched.deliverables[0].body).toBeDefined();
});

it('no modifica scheduledAt', () => {
  const enriched = resolver.enrich(domainPlan);
  expect(enriched.deliverables[0].scheduledAt)
    .toEqual(domainPlan.deliverables[0].scheduledAt);
});
```

### 8.5 Tests del Reconciler

```ts
it('diff: programa solo lo que falta', async () => {
  provider.getAll.mockResolvedValue([{ id: 'existing-1' }]);
  const plan = new DeliveryPlan(/* deliverables: [existing-1, new-1] */);
  await reconciler.sync(plan, provider);
  expect(provider.schedule).toHaveBeenCalledTimes(1);
  expect(provider.cancel).not.toHaveBeenCalled();
});
```

---

## 10. Presupuesto de Performance

| Operación | Budget | Notas |
|-----------|--------|-------|
| Engine.initialize() con 30 entidades | < 200ms | buildDesiredSequence × 5 + interruption + templates + reconciler |
| onEntityChanged() | < 50ms | 1 buildDesiredSequence + interruption + templates + reconciler |
| InterruptionPolicy.resolve() | < 20ms | Comparación de timestamps + prioridades |
| TemplateResolver.enrich() | < 10ms | i18n lookups, sin I/O |
| Reconciler.sync() | < 100ms | provider.getAll() + diff |

---

## 11. Orden de Implementación

### Fase 1: Foundation (3-4 días)
1. `types.ts` — todos los tipos inmutables
2. `Clock.ts` — SystemClock + FakeClock
3. `NotificationProvider.ts` — Expo wrapper (solo reminders)
4. `ProgressNotifier.ts` — progreso (backup, download)
5. Tests

### Fase 2: Policies + Factory (3-4 días)
6. `PolicyRegistry.ts`
7. `ReminderPolicy` interfaz
8. `SequenceFactory.ts` (IDs deterministas, dominio puro)
9. Policies: Assessment, Class, Event, Review, Grading
10. Tests

### Fase 3: Interruption + Templates + Reconciler (3-4 días)
11. `InterruptionPolicy.ts` → `DeliveryPlan` con planId/version
12. `TemplateResolver.ts` (sin Clock)
13. `NotificationReconciler.ts`
14. Tests

### Fase 4: Engine + Integración (3-4 días)
15. `ReminderEngine.ts` (buildDesiredSequence, FIFO queue)
16. `useReminderEngine.ts` — hook React
17. Migrar preferencias AsyncStorage → MMKV
18. Reemplazar hooks legacy
19. Eliminar `notificationService.ts`

### Fase 5: Polish (1-2 días)
20. Edge cases
21. Logging con planId

**Total estimado**: 13-18 días.

---

## 12. Architectural Invariants

Estas reglas son vinculantes. Cualquier cambio que las viole requiere justificación explícita.

1. **ReminderPolicy nunca genera objetos Reminder.** Solo produce `readonly number[]` (offsets).
2. **SequenceFactory nunca genera datos de presentación.** No produce `title`, `body`, `badge`, `deeplink`.
3. **TemplateResolver nunca modifica información temporal.** No toca `scheduledAt`, `id`, `ordinal`.
4. **TemplateResolver no necesita Clock.** No tiene dependencias temporales.
5. **InterruptionPolicy nunca consulta Expo.** Trabaja solo con `ReminderSequence[]` y produce `DeliveryPlan`.
6. **NotificationReconciler nunca modifica ReminderSequence ni DeliveryPlan.** Lee del plan, reconcilia contra Expo.
7. **NotificationProvider es la única capa que conoce expo-notifications.** Ninguna otra capa importa `expo-notifications`.
8. **ReminderEngine nunca llama NotificationProvider directamente.** Delega al Reconciler.
9. **Todo el sistema es event-driven.** Sin ticks, loops periódicos, ni `setInterval`.
10. **Los IDs de Reminder son deterministas.** Mismo input → mismo output. Sin UUIDs aleatorios.
11. **Todo acceso al tiempo se hace mediante Clock.** `new Date()` y `Date.now()` prohibidos fuera de `Clock.ts`.
12. **DeliveryPlan es inmutable.** Se genera, se consume, se descarta. Nunca se modifica.
13. **ReminderSequence es inmutable.** `readonly` en todos sus campos.
14. **El Engine procesa un evento a la vez.** FIFO queue interna. El siguiente evento no comienza hasta que el anterior completó `reconciler.sync()`.
15. **Una secuencia sin reminders válidos nace EXPIRED.** Si `SequenceFactory` produce 0 reminders, el Engine no la incorpora al DeliveryPlan. Se descarta inmediatamente.

---

## 13. Decisiones Técnicas Pendientes

| # | Decisión | Opciones | Recomendación |
|---|----------|---------|---------------|
| 1 | ¿Post-event rules (+10, +20) se programan en Expo? | Sí / No | Sí. Expo trigger normal. Sin tick. |
| 2 | ¿Engine se inicializa antes o después de READY? | Before / After | Después de READY. Necesita datos del store. |
| 3 | ¿Snooze en fase 1? | Sí / No | No. Agregar después. |
| 4 | ¿TemplateResolver accede a i18n directo o inyectado? | Directo / Inyectado | Inyectado. Para testear sin i18n. |
| 5 | ¿InterruptionPolicy necesita estado de estudio activo? | Sí / No | Sí. Ese estado se pasa al `resolve()`. |
| 6 | ¿Web support? | Sí / No | No. Provider mock para tests. |
| 7 | ¿Cómo se recupera el Engine post-restart? | Persistir estado / Proveedor como fuente | **Proveedor como única fuente**. El Engine regenera desiredSequences desde entidades y usa `provider.getAll()` como estado real. El estado DELIVERED/TAPPED/DISMISSED en memoria se pierde — el Engine asume que todo reminder no encontrado en el proveedor fue descartado/ignorado. |
| 8 | ¿Cómo maneja cambios de zona horaria / DST? | onTimeZoneChanged() / onEnvironmentChanged() | **`onEnvironmentChanged()`**. La app llama al Engine con el nuevo contexto. El Engine regenera `scheduledAt` para secuencias activas y el Reconciler reconcilia. No se requiere lógica horaria especial — Clock produce UTC, el OS maneja la presentación local. |
| 9 | ¿Qué ocurre si se revocan permisos post-init? | Estado PAUSED / Engine sigue | **Engine sigue**. El Reconciler detecta que `provider.schedule()` falla y registra el motivo. Las desiredSequences siguen actualizándose. Cuando el usuario reactive permisos, el Reconciler programa lo pendiente. Sin estado global PAUSED. |
| 7 | ¿FIFO queue usa microtask o macrotask? | microtask / macrotask | Macrotask (setTimeout 0) para no bloquear el event loop de React. |
