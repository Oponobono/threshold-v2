# Reminder System — Domain Model

Este documento define las **entidades, objetos de valor, estados y relaciones** del dominio de recordatorios. Emergen directamente de la Product Specification. No se refieren a implementación técnica.

---

## 1. Conceptos del Dominio

### 1.1 Reminder (Recordatorio Individual)

Una **instrucción unitaria** que dice "notifica al usuario en este momento sobre esto".

No es la notificación en sí. Es la **regla** que produce la notificación.

```
Reminder {
    id              →  identificador único determinista (hash(entityType + entityId + ordinal))
    entity_type     →  "assessment" | "schedule" | "flashcard_deck" | "review" | "grading_period" | "weekly_digest"
    entity_id       →  ID de la entidad que originó el recordatorio
    subject_id      →  ID de la materia asociada (para contexto visual)
    scheduled_at    →  timestamp absoluto de disparo (resuelto por SequenceFactory)
    intent          →  ReminderIntent (semántica: qué debe hacer el usuario)
    profile         →  ReminderProfile usado para generar este reminder
    priority        →  InterruptionPriority (asignado por SequenceFactory según urgencia contextual)
    sequence_id     →  ID de la secuencia a la que pertenece
    ordinal         →  posición dentro de la secuencia (0, 1, 2, ...)
    status          →  ReminderStatus (PENDING → SCHEDULED → DELIVERED → ...)
}
```

**Regla**: El ID es determinista. Mismo input → mismo output. Sin UUIDs aleatorios. Esto permite que el Reconciler haga diff eficientemente sin falsos positivos.

**Nota**: `title` y `body` no son parte del Reminder de dominio. Son resueltos por el TemplateResolver en la capa de presentación e incluidos en el DeliveryPlan.

**Es un Value Object**. No tiene identidad persistente. Se crea, se ejecuta, se descarta.

**Nota sobre `status`**: aunque el tipo incluye `status`, este no se almacena dentro del Value Object. El Engine mantiene un mapa externo (`Map<reminderId, ReminderStatus>`) que el Reconciler actualiza. El Reminder como tipo describe el *contrato* del recordatorio (qué, cuándo, hacia dónde); el *estado* es responsabilidad del Engine. Al regenerar una secuencia, los nuevos Reminder nacen con `status` implícito `PENDING`. Si el Engine se reinicia, se regenera desde la Policy.

### 1.2 ReminderSequence (Secuencia de Recordatorios)

Un **conjunto ordenado de Reglas** que se generan a partir de una misma entidad y un mismo contexto.

```
ReminderSequence {
    id              →  identificador único
    entity_type     →  tipo de entidad origen
    entity_id       →  ID de la entidad origen
    reminders       →  Reminder[] (ordenados por scheduled_at)
    created_at      →  timestamp de creación
    expires_at      →  timestamp de expiración (cuando la secuencia deja de ser válida)
    status          →  SequenceStatus
}
```

**Es una Aggregate Root**. Agrupa las reglas y es la unidad que el Engine gestiona.

**Ejemplo visual** (dominio puro, antes de TemplateResolver):

```
ReminderSequence #seq-001 {
    entity_type: "schedule"
    entity_id: "schedule-25"
    reminders: [
        { ordinal: 0, scheduled_at: 16:30, intent: "attend_class" },
        { ordinal: 1, scheduled_at: 16:55, intent: "attend_class" },
        { ordinal: 2, scheduled_at: 17:00, intent: "attend_class" },
        { ordinal: 3, scheduled_at: 17:10, intent: "confirm_attendance" },
        { ordinal: 4, scheduled_at: 17:20, intent: "confirm_attendance" }
    ],
    status: "active",
    expires_at: 18:00,
    created_at: 2026-07-10T00:00:00Z
}
```

**Nota**: Los títulos y cuerpos (ej: "Clase de Cálculo en 30 minutos") no están en el Reminder de dominio. Los resuelve el TemplateResolver.

### 1.3 ReminderPolicy (Política de Recordatorios)

Una **estrategia** que define **cuándo** deben existir recordatorios para un tipo de entidad.

No es una entidad. Es un **comportamiento puro**: recibe una entidad, devuelve offsets en minutos relativos al evento.

```
ReminderPolicy {
    entity_type              →  qué tipo de entidad procesa
    default_profile          →  qué perfil usar por defecto
    getOffsets()             →  (entity, profile) → number[]
    shouldCancel()           →  (sequence, entity) → boolean
    shouldCancelReminder()   →  (reminder, entity) → boolean
    getExpiration()          →  (entity) → Date | null
}
```

**Regla**: Las Polices solo deciden **cuándo**. No generan IDs, titles, bodies ni intents.

`shouldCancelReminder()` permite cancelar reminders individuales dentro de una secuencia activa, sin cancelar la secuencia completa. Ej: los offsets post-evento de una Schedule (+10min, +20min) se cancelan si la clase ya empezó, pero los pre-evento (-30min, -5min) se mantienen. Esas responsabilidades pertenecen al SequenceFactory.

Cada tipo de entidad tiene su propia Policy:

| Policy | Genera secuencias para | Comportamiento clave |
|--------|----------------------|---------------------|
| AssessmentPolicy | assessments, calendarEvents (exam/task) | Momento fijo, reglas pre-evento, expira post-evento |
| ClassPolicy | schedules | Recurrente semanal, reglas pre + post, corte por "iniciada" |
| ReviewPolicy | flashcardDecks, flashcards (FSRS) | Persistente, intervalo creciente, corte por repaso completado |
| GradingPolicy | gradingPeriods | Momento fijo, reglas pre-cierre |
| DigestPolicy | weeklyDigest | Aislada, 1 regla, configurable |

### 1.4 ReminderProfile (Perfil de Intensidad)

Un **objeto de valor** que describe un patrón de intensidad (frecuencia de recordatorios). No incluye prioridad — la prioridad es un eje ortogonal.

```
ReminderProfile {
    name                   →  "minimal" | "standard" | "persistent" | "custom"
    default_offsets        →  number[] (offsets sugeridos para este perfil)
    custom_offsets?        →  number[] (solo cuando name === "custom")
}
```

| Perfil | Uso recomendado |
|--------|-----------------|
| `minimal` | Usuarios que no quieren ser interrumpidos. 2-3 reglas. |
| `standard` | Default. Balance entre alerta y respeto. 4-5 reglas. |
| `persistent` | Insiste hasta que el usuario actúe. 6-7 reglas. |
| `custom` | El usuario define sus props. |

**Nota**: Los `default_offsets` son sugerencias. Cada Policy puede definir sus propios offsets para el mismo perfil (AssessmentPolicy para `standard` usa `[-10080, -4320, -1440, -60, 0]`; ClassPolicy para `standard` usa `[-30, -5, 0, +10, +20]`). El perfil define la **intensidad**, no los offsets exactos.

**Separación de conceptos**: `ReminderProfile` describe cuándo y con qué frecuencia. `InterruptionPriority` (definido en cada Reminder individual) describe la urgencia contextual. Un reminder puede ser "minimal pero critical" (pocos offsets, pero el que hay es urgente) o "persistent pero normal" (muchos offsets, ninguno urgente).

### 1.5 ReminderIntent (Intención del Recordatorio)

Describe **qué quiere lograr** el recordatorio. Es la semántica detrás de la regla. No es un string libre — es un tipo cerrado.

```
type ReminderIntent =
  | "prepare_exam"      →  prepararse para un examen
  | "attend_class"      →  asistir a clase
  | "review_cards"      →  repasar flashcards
  | "submit_work"       →  entregar un trabajo
  | "digest"            →  resumen semanal
  | "follow_up"         →  confirmación post-evento (¿ya empezaste?)
```

**Por qué un tipo cerrado y no un string**: elimina strings mágicos, mejora autocompletado, facilita refactors, elimina errores tipográficos. Cada `intent` tiene una consecuencia específica en navegación y en las templates.

### 1.6 InterruptionPriority (Prioridad de Interrupción)

Define la **urgencia contextual** de un reminder. No depende del perfil, sino del contexto de la entidad.

```
InterruptionPriority = "low" | "normal" | "high" | "critical"
```

| Prioridad | Asignado a | Comportamiento en colisión |
|-----------|-----------|---------------------------|
| `critical` | Assessment a < 24h del evento, cualquier reminder de un perfil persistent con deadline inminente | Siempre se muestra. Desplaza a los demás. |
| `high` | Assessment > 24h, reminders persistentes | Se muestra. Desplazado solo por critical. |
| `normal` | Standard profile | Default. Se desplaza por high o critical. |
| `low` | Minimal profile, digest | Se suprime si hay colisión con 3+ reminders. |

**Es asignado por el SequenceFactory** según la entidad y su contexto (ej: un assessment a 6 horas → critical; una clase normal → normal).

### 1.6 DeliveryPlan (Plan de Entrega)

El **resultado** de aplicar la InterruptionPolicy a las secuencias deseadas. Representa lo que realmente debe estar programado en el sistema operativo.

```
DeliveryPlan {
    plan_id          →  UUID de trazabilidad (único por plan generado)
    version          →  contador incremental (para debugging: "reconciling plan 47")
    deliverables     →  DeliveryReminder[] (entregables resueltos, ordenados)
    generated_at     →  timestamp de generación
}

DeliveryReminder {
    id              →  ID del reminder original (determinista)
    scheduled_at    →  timestamp absoluto (puede estar desplazado por colisión)
    title           →  texto resuelto por TemplateResolver
    body            →  texto resuelto por TemplateResolver
    entity_type     →  tipo de entidad origen
    entity_id       →  ID de la entidad origen
    intent          →  intención del reminder (para navegación)
    priority        →  InterruptionPriority
    deeplink?       →  ruta de navegación
    badge?          →  número de badge
}
```

**Regla**: El DeliveryPlan es inmutable y derivado. No se persiste. No se modifica después de creado. Las secuencias originales nunca cambian; lo que cambia es cómo se entregan.

### 1.8 ReminderOutcome (Resultado de un Recordatorio)

El **estado final** de un reminder después de que el usuario interactúa (o no).

```
ReminderOutcome = "tapped" | "dismissed" | "ignored" | "completed" | "expired" | "superseded"
```

| Outcome | Significado |
|---------|------------|
| `tapped` | El usuario tocó la notificación |
| `dismissed` | El usuario descartó (swipe) |
| `ignored` | La notificación expiró sin interacción |
| `completed` | El usuario realizó la acción sugerida |
| `expired` | La secuencia expiró sin que el usuario hiciera nada |
| `superseded` | Fue reemplazada por una regla posterior de la misma secuencia |

### 1.9 ReminderWindow (Ventana de Disparo)

Define **cuándo es relevante** un recordatorio relativo al evento.

```
ReminderWindow {
    offset_minutes   →  minutos antes/después del evento (-30 = 30 antes, +10 = 10 después)
    reference        →  "event_start" | "event_end" | "now"
}
```

**Por qué existe**: Un Assessment tiene fecha pero no hora exacta. Un Schedule tiene hora de inicio y fin. Una Review FSRS se dispara "cuando vence", que es un timestamp calculado, no una hora fija. El Window encapsula esa diferencia.

### 1.10 SequenceStatus (Estado de la Secuencia)

```
SequenceStatus = "active" | "waiting_feedback" | "completed" | "cancelled" | "expired"
```

| Estado | Significado |
|--------|------------|
| `active` | La secuencia existe, sus reminders están programados o por programar. No se ha disparado ningún reminder aún. |
| `waiting_feedback` | Al menos un reminder se ha disparado. La secuencia espera que el usuario interactúe o complete la acción. |
| `completed` | El usuario realizó la acción (vía `onActionCompleted`). Todas las reglas restantes se cancelan. |
| `cancelled` | El usuario canceló manualmente la secuencia (silenciar por X horas). |
| `expired` | La secuencia pasó su `expires_at` sin completarse. |

---

## 2. Diagrama de Relaciones

```
 Clock               ReminderProfile          ReminderPolicy
   │                       │                       │
   │                       │                       │  getOffsets(entity, profile)
   │                       │                       ▼
   │                       │             number[] (offsets en minutos)
   │                       │                       │
   │                       └───────┬───────────────┘
   │                               │
   │  now()                        ▼
   └──────────────────▶  SequenceFactory
                               │
                               │  buildSequence(entity, offsets, clock)
                               │  → IDs deterministas, timestamps, intents
                               │
                               ▼
                      ReminderSequence (dominio puro)
                               │
                               ▼
                      TemplateResolver
                               │
                               │  enrich(sequence)
                               │  → títulos, cuerpos, deeplinks
                               │
                               ▼
                      ReminderSequence (enriquecida)
                               │
                               ▼
                   InterruptionPolicy.resolve()
                               │
                               ▼
                      DeliveryPlan (inmutable)
                               │
                               │  deliverables[]
                               │
                               ▼
                  NotificationReconciler.sync()
                               │
                               │  diff vs estado real de Expo
                               │
                               ▼
                     NotificationProvider
                               │
                               │  schedule(notification) / cancel(id)
                               │
                               ▼
                       expo-notifications
                               │
                               │  usuario interactúa
                               │
                               ▼
                    ReminderOutcome
                               │
                               │  onReminderTapped() → navegación
                               │  onActionCompleted() → Engine cancela secuencia
                               │
                               ▼
                    Engine actualiza
                    secuencias deseadas
```

---

## 3. Ciclo de Vida de una Secuencia

```
                    Entity cambia / App inicia
                            │
                            ▼
                    (Clock.now() inyectado)
                            │
                            ▼
                    buildDesiredSequence(entity)
                            │
                            ├─ Policy.getOffsets() → number[]
                            ├─ SequenceFactory.buildSequence() → dominio puro
                            └─ TemplateResolver.enrich() → textos, deeplinks
                            │
                            ▼
                    desiredSequences[] actualizado
                            │
                            ▼
                    InterruptionPolicy.resolve()
                            │  → DeliveryPlan (inmutable, colisiones resueltas)
                            │
                            ▼
                    NotificationReconciler.sync(plan)
                            │  diff vs estado real de Expo
                            │
                            ▼
                    ReminderSequence (status: active)
                            │
                            │  primera regla se dispara
                            ▼
                    ReminderSequence (status: waiting_feedback)
                            │
                ┌───────────┼───────────┐
                │           │           │
                ▼           ▼           ▼
           usuario      siguiente    expira
           completa     regla        sin acción
           la acción    se dispara       │
                │           │            ▼
                ▼           │     (status: expired)
          (status:      循环 │
           completed)       │
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
              buildDesired      siguiente
              Sequence()        regla se
              (entity           dispara
               cambió)          ...
```

---

## 4. Reglas de Consistencia

Estas reglas definen los invariantes del dominio. No pueden romperse.

### R1: Toda secuencia pertenece a exactamente una Policy
Una ReminderSequence nunca existe sin una Policy que la haya generado. Si la Policy no existe, la secuencia no se crea.

### R2: Las reglas de una secuencia están estrictamente ordenadas por `scheduled_at`
No pueden existir dos reglas con el mismo timestamp en la misma secuencia. Si dos eventos ocurren a la misma hora, se separan por 1 minuto.

### R3: Una secuencia en estado `completed` o `cancelled` no genera nuevas reglas
El Engine ignora secuencias terminadas. No las reprograma.

### R4: Solo una secuencia activa por (entity_type, entity_id)
No pueden existir dos secuencias activas para la misma entidad. Si se genera una nueva, la anterior se cancela automáticamente.

### R5: Las reglas no pueden dispararse en el pasado
Si `scheduled_at` es anterior al `now` actual, la regla se descarta silenciosamente. No se notifica retroactivamente.

### R6: El feedback del usuario se procesa inmediatamente
Cuando el usuario toca/descarta/marca como hecha, el Engine actualiza el estado de la secuencia en el mismo tick. No hay延迟 entre la interacción y la reacción del Engine.

### R7: Las Reminder Rules son derivadas
No se persisten como fuente de verdad. Se regeneran a partir de las entidades existentes. Si desaparecen, se reconstruyen.

### R8: Una secuencia sin reminders válidos nace EXPIRED
Si `SequenceFactory.buildSequence()` produce 0 reminders (todos descartados por R5), la secuencia se crea directamente en estado `expired`. No pasa por `active`. No participa del DeliveryPlan. El Engine la ignora hasta que la entidad cambie.

---

## 5. Límites del Dominio

### Lo que el Reminder System SÍ hace
- Generar secuencias de recordatorios a partir de entidades (via Policy → SequenceFactory → TemplateResolver).
- Resolver colisiones entre secuencias (via InterruptionPolicy → DeliveryPlan).
- Reconciliar el plan de entrega con el estado real de Expo (via NotificationReconciler).
- Reaccionar a interacciones del usuario (touch → navega, action completed → cancela secuencia).
- Cancelar secuencias cuando la entidad pierde vigencia.
- Respetar preferencias del usuario (perfil por categoría, silenciar temporalmente).

### Lo que el Reminder System NO hace
- **No almacena entidades** (assessments, schedules, etc.). Las lee de dominios existentes.
- **No modifica entidades**. No marca clases como "iniciadas" ni decks como "repasados".
- **No persiste notificaciones**. Son un derivado del Engine, regenerables.
- **No sincroniza**. Las preferencias son locales (MMKV). Las secuencias se regeneran desde las entidades.
- **No gestiona sonido, vibra, canales Android o threads iOS**. Esa es responsabilidad del NotificationProvider (expo-notifications).
- **No calcula FSRS**. Lee `next_review_date` de flashcards que ya existen.
- **No tiene ticks ni loops periódicos**. Es puramente event-driven.

---

## 6. Preguntas Abiertas del Dominio

| # | Pregunta | Impacto | Estado |
|---|----------|---------|--------|
| 1 | ¿Una secuencia puede tener reglas de tipos mixtos (pre-evento + post-evento)? | SequenceStatus transitions | Sí, ClassPolicy lo necesita. Distingue por intent. |
| 2 | ¿El Feedback se acumula entre sesiones? | Engine statefulness | No. Solo durante la sesión actual. Al reiniciar se empieza de cero. |
| 3 | ¿Puede existir una Policy sin entidad asociada? | Policy registration | No. Toda Policy requiere una entity_type. |
| 4 | ¿Cómo maneja la colisión de timestamps entre entidades? | Scheduling | InterruptionPolicy + DeliveryPlan. Las secuencias no se modifican. |
| 5 | ¿El custom profile permite offsets directos? | Custom UX | Sí, con validación (min 1, max 10, ordenados asc). |
| 6 | ¿Quién asigna la prioridad (InterruptionPriority)? | Architecture | El SequenceFactory, según contexto de la entidad (assessment próximo → critical). |
| 7 | ¿El DeliveryPlan se persiste? | Persistence | No. Se regenera cada vez que se necesita sync. Es un derivado. |
| 8 | ¿Cómo se recupera el Engine post-restart? | Recovery | Proveedor como única fuente. El Engine regenera desde entidades. Estado en memoria se pierde. |
| 9 | ¿Manejo de zona horaria / DST? | Environment | `onEnvironmentChanged()`. Clock produce UTC, OS maneja presentación local. |
| 10 | ¿Permisos revocados post-init? | Permissions | Engine sigue, Reconciler detecta fallo, no programa hasta que se reactiven. Sin estado PAUSED global. |
