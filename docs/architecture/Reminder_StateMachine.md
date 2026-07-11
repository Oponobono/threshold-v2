# Reminder System — State Machines

Este documento describe las máquinas de estado del subsistema de recordatorios. Todo sistema reactivo se define por sus transiciones. Aquí están todas las válidas e inválidas.

---

## 1. Sequence State Machine

Cada `ReminderSequence` (secuencia de recordatorios para una entidad) recorre estos estados:

```
            ┌──────────┐
    ┌──────►│  ACTIVE  │─────────────┐
    │       └──────────┘             │
    │            │                   │
    │            │                   │
    │            ▼                   │
    │    ┌──────────────┐           │
    │    │   WAITING    │           │
    │    │   FEEDBACK   │────┐      │
    │    └──────────────┘    │      │
    │            │           │      │
    │            │           │      │
    │            ▼           ▼      ▼
    │     ┌──────────┐ ┌──────────┐ ┌──────────┐
    │     │COMPLETED │ │CANCELLED │ │ EXPIRED  │
    │     └──────────┘ └──────────┘ └──────────┘
    │           │           │          │
    └───────────┴───────────┴──────────┘
          (todos terminales)
```

### 1.1 Estados

| Estado | Significado |
|--------|-------------|
| **ACTIVE** | La secuencia existe, sus reminders están programados o por programar. No se ha disparado ningún reminder aún. |
| **WAITING_FEEDBACK** | Al menos un reminder se ha disparado. La secuencia espera que el usuario interactúe o complete la acción. |
| **COMPLETED** | El usuario realizó la acción asociada (ej: marcó la clase como iniciada, repasó el mazo). Se cancelan los reminders restantes. |
| **CANCELLED** | Cancelación manual (usuario silencia por X horas, o desactiva la categoría). |
| **EXPIRED** | La secuencia superó su `expires_at` sin que el usuario completara la acción. |

### 1.2 Transiciones Válidas

| Desde | Hasta | Trigger | Descripción |
|-------|-------|---------|-------------|
| _(ninguno)_ | ACTIVE | `initialize()` o `onEntityChanged()` | Se crea la secuencia y se programan sus reminders. |
| _(ninguno)_ | EXPIRED | `buildSequence()` produce 0 reminders | Todos los reminders cayeron en pasado (R5). Secuencia inviable desde el inicio. |
| ACTIVE | WAITING_FEEDBACK | Primer reminder se dispara | El SO muestra la primera notificación de la secuencia. |
| ACTIVE | COMPLETED | `onActionCompleted()` | Usuario completa la acción antes de que se dispare el primer reminder (ej: repasa el mazo antes de la notificación). |
| ACTIVE | CANCELLED | Usuario desactiva categoría o silencia | Cancelación manual. |
| ACTIVE | EXPIRED | `expires_at` alcanzado sin interacción | La secuencia perdió vigencia (ej: el examen pasó). |
| WAITING_FEEDBACK | COMPLETED | `onActionCompleted()` | Usuario realiza la acción. Se cancelan reminders restantes. |
| WAITING_FEEDBACK | CANCELLED | Usuario desactiva categoría | Cancelación manual durante la ventana de feedback. |
| WAITING_FEEDBACK | EXPIRED | `expires_at` alcanzado | La ventana de feedback se cerró sin acción. |
| WAITING_FEEDBACK | ACTIVE | `onEntityChanged()` | La entidad cambió y se regeneró la secuencia. La anterior se descarta, la nueva empieza en ACTIVE. |
| COMPLETED | _(ninguno)_ | — | Estado terminal. La secuencia ya no participa. Si la entidad cambia, se genera una nueva. |
| CANCELLED | _(ninguno)_ | — | Estado terminal. Similar a COMPLETED. |
| EXPIRED | _(ninguno)_ | — | Estado terminal. Similar a COMPLETED. |

### 1.3 Transiciones Inválidas

| Desde | Hasta | Razón |
|-------|-------|-------|
| COMPLETED | WAITING_FEEDBACK | Una secuencia completada no revive. Si la entidad cambia, se crea una nueva. |
| COMPLETED | ACTIVE | Misma razón. Un `onEntityChanged()` no revive una secuencia completada; genera una nueva. |
| EXPIRED | ACTIVE | Misma razón. Lo expirado no se reactiva. |
| EXPIRED | WAITING_FEEDBACK | Misma razón. |
| CANCELLED | ACTIVE | Misma razón. |

---

## 2. Reminder State Machine

Cada `Reminder` individual (una regla dentro de una secuencia) recorre su propio ciclo:

```
                    ┌──────────┐
            ┌──────►│ PENDING  │
            │       └────┬─────┘
            │            │
            │            │ scheduled_at alcanzado
            │            ▼
│       ┌───────────┐
│       │ SCHEDULED │ (programado)
│       └─────┬─────┘
│             │
│             │ scheduled_at alcanzado
            │             ▼
            │       ┌───────────┐
            │       │ DELIVERED │
            │       └─────┬─────┘
            │             │
            │    ┌────────┼────────┐
            │    │        │        │
            │    ▼        ▼        ▼
            │ ┌──────┐ ┌────────┐ ┌────────┐
            │ │TAPPED│ │DISMISS │ │IGNORED │
            │ └──────┘ └────────┘ └────────┘
            │
            └───────────────────────────┐
                                        │
                                   ┌────────────┐
                                   │ SUPERSEDED │
                                   └────────────┘
```

### 2.1 Estados

| Estado | Significado |
|--------|-------------|
| **PENDING** | El reminder fue creado pero aún no se ha programado en el sistema de notificaciones. |
| **SCHEDULED** | El reminder fue registrado en el sistema de notificaciones. |
| **DELIVERED** | El sistema operativo entregó la notificación. Está visible (o fue visible) para el usuario. |
| **TAPPED** | El usuario tocó la notificación. |
| **DISMISSED** | El usuario descartó la notificación (swipe). |
| **IGNORED** | La notificación fue entregada pero expiró sin interacción del usuario. |
| **SUPERSEDED** | El reminder fue reemplazado antes de dispararse (ej: la secuencia se regeneró porque la entidad cambió). |

### 2.2 Transiciones Válidas

| Desde | Hasta | Trigger | Descripción |
|-------|-------|---------|-------------|
| _(ninguno)_ | PENDING | `SequenceFactory.buildSequence()` | El reminder se crea como parte de una secuencia. |
| PENDING | SCHEDULED | `Reconciler.sync()` | El Reconciler programa el reminder en el proveedor de notificaciones. |
| PENDING | SUPERSEDED | `onEntityChanged()` o `onActionCompleted()` | La secuencia se regeneró o completó antes de programar el reminder. |
| SCHEDULED | DELIVERED | scheduled_at alcanzado | El sistema operativo entrega la notificación. |
| SCHEDULED | SUPERSEDED | `onEntityChanged()` o `onActionCompleted()` | La secuencia se regeneró o completó. El Reconciler cancela el reminder. |
| DELIVERED | TAPPED | Usuario toca la notificación | `onReminderTapped()` se dispara. |
| DELIVERED | DISMISSED | Usuario descarta (swipe) | El SO reporta el descarte. |
| DELIVERED | IGNORED | Ventana de visibilidad expira | La notificación se retiró del centro de notificaciones sin que el usuario interactuara. |
| TAPPED | _(ninguno)_ | — | Estado terminal. El reminder cumplió su función. |
| DISMISSED | _(ninguno)_ | — | Estado terminal. |
| IGNORED | _(ninguno)_ | — | Estado terminal. |
| SUPERSEDED | _(ninguno)_ | — | Estado terminal. |

### 2.3 Transiciones Inválidas

| Desde | Hasta | Razón |
|-------|-------|-------|
| TAPPED | DISMISSED | Una vez tocado, no puede ser descartado. |
| DISMISSED | TAPPED | Una vez descartado, no puede ser tocado. |
| SUPERSEDED | SCHEDULED | Un reminder reemplazado no revive. Si se necesita, se crea uno nuevo. |
| IGNORED | DELIVERED | No se puede re-entregar. |

---

## 3. Transiciones Agregadas (Engine → Reconciler → Provider)

### 3.1 `initialize(entities)` produce:

```
Para cada entity:
  ACTIVE (Sequence) → PENDING (Reminder) × N
```

Luego Reconciler.sync():

```
PENDING (Reminder) → SCHEDULED (Reminder) × N (los que se programan)
PENDING (Reminder) → SUPERSEDED (Reminder) × M (los que expiraron antes de programar)
```

### 3.2 `onEntityChanged()` produce:

```
Secuencia anterior completa → SUPERSEDED (para cada reminder no disparado)
Nueva secuencia → ACTIVE (Sequence) → PENDING (Reminder) × N
```

Luego Reconciler:

```
SCHEDULED → SUPERSEDED (para cada reminder de la secuencia anterior que estaba programado)
PENDING → SCHEDULED (para cada reminder de la nueva secuencia)
```

### 3.3 `onActionCompleted()` produce:

```
WAITING_FEEDBACK → COMPLETED (Sequence)
SCHEDULED → SUPERSEDED (para cada reminder restante)
DELIVERED → SUPERSEDED (para cada reminder ya disparado pero no interactuado)
```

Luego el Reconciler cancela en el proveedor los reminders SUPERSEDED.

### 3.4 `onReminderTapped()` produce:

```
DELIVERED → TAPPED (Reminder)
```

No cambia el estado de la secuencia. Secuencia se mantiene en WAITING_FEEDBACK.

### 3.5 `onEntityDeleted()` produce:

```
Cualquier estado → EXPIRED (Sequence)
SCHEDULED → SUPERSEDED (para cada reminder programado)
DELIVERED → SUPERSEDED (para cada reminder entregado pero no interactuado)
```

Luego el Reconciler cancela en el proveedor los reminders SUPERSEDED.

### 3.6 `onEnvironmentChanged()` produce:

```
Por cada secuencia activa:
  → scheduledAt se recalcula (zona horaria, locale)
  → Si algún scheduledAt quedó en pasado, ese reminder → SUPERSEDED
```

Luego Reconciler.sync() reconcilia con el proveedor. No cambia estados de secuencia ni reminder directamente — solo recalcula timestamps.

---

## 4. Reglas de Consistencia de la Máquina de Estados

### SM-R1: Una secuencia COMPLETED, CANCELLED o EXPIRED no vuelve a ACTIVE
No existe transición de regreso. Si la entidad cambia, se genera una nueva secuencia con un nuevo ID.

### SM-R2: Un reminder SUPERSEDED no se programa
El Reconciler ignora reminders con estado SUPERSEDED. `sync()` nunca los envía a `provider.schedule()`.

### SM-R3: El estado de un reminder solo avanza, nunca retrocede
PENDING → SCHEDULED → DELIVERED → {TAPPED, DISMISSED, IGNORED}. No hay caminos de regreso.

### SM-R4: El Reconciler no espera confirmación del proveedor
Cuando el NotificationReconciler programa un reminder en el proveedor, asume que la operación fue exitosa. Si el proveedor falla, el error se maneja en su capa. El Reconciler no reintenta.

### SM-R5: La InterruptionPolicy se ejecuta antes de cada sync
No puede haber un sync sin pasar por InterruptionPolicy.resolve(). Garantiza que el estado deseado siempre esté resuelto antes de reconciliar.

---

## 5. Correlación Reminder → Secuencia

El estado del reminder individual y el estado de la secuencia que lo contiene están relacionados pero no son equivalentes. Esta tabla muestra cómo cada interacción del usuario afecta ambas máquinas:

```
DELIVERED (Reminder)
    │
    ├── tapped ──────────────► Sequence: WAITING_FEEDBACK (no cambia)
    │
    ├── dismissed ───────────► Sequence: WAITING_FEEDBACK (no cambia)
    │
    ├── ignored ─────────────► Sequence: WAITING_FEEDBACK (no cambia)
    │
    └── actionCompleted ─────► Sequence: WAITING_FEEDBACK → COMPLETED
                              Reminders restantes: → SUPERSEDED
```

| Evento | Efecto en Reminder | Efecto en Secuencia |
|--------|-------------------|---------------------|
| scheduled_at alcanzado | PENDING → SCHEDULED | ACTIVE (sin cambio) |
| Notificación visible | SCHEDULED → DELIVERED | ACTIVE → WAITING_FEEDBACK (primera vez) |
| Usuario toca | DELIVERED → TAPPED | WAITING_FEEDBACK (sin cambio) |
| Usuario descarta | DELIVERED → DISMISSED | WAITING_FEEDBACK (sin cambio) |
| Usuario ignora | DELIVERED → IGNORED | WAITING_FEEDBACK (sin cambio) |
| Usuario completa acción | _(no aplica, reminder previo)_ | → COMPLETED |
| Entidad cambia | SCHEDULED/PENDING → SUPERSEDED | Secuencia actual → EXPIRED, nueva → ACTIVE |
| expires_at alcanzado | PENDING/SCHEDULED → SUPERSEDED | → EXPIRED |

---

## 6. Diagrama de Flujo del Engine (Completo)

```
Evento externo
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ReminderEngine                                              │
│                                                              │
│  1. PolicyRegistry.get(entityType)                           │
│  2. Policy.getOffsets(entity, profile) → offsets             │
│  3. SequenceFactory.buildSequence(entity, offsets, now)      │
│     → ReminderSequence[] (dominio, sin presentación)         │
│  4. desiredSequences[] ← actualizado                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
    │  desiredSequences[]
    ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  InterruptionPolicy.resolve(desiredSequences)                │
│  → DeliveryPlan (dominio, colisiones resueltas)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
    │  DeliveryPlan (dominio)
    ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  TemplateResolver.enrich(plan)                               │
│  → DeliveryPlan (con textos, deeplinks, badges)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
    │  DeliveryPlan enriquecido
    ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  NotificationReconciler.sync(enrichedPlan, provider)         │
│                                                              │
│  ├─ provider.getAll()  → estado real                         │
│  ├─ diff: desired - real                                     │
│  ├─ provider.schedule(reminder) × N                          │
│  └─ provider.cancel(id) × M                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  NotificationProvider (sistema de notificaciones del SO)     │
│                                                              │
│  → DELIVERED (timer dispara, notificación visible)            │
│  → TAPPED (usuario toca)                                     │
│  → DISMISSED (usuario descarta)                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Escenarios de Estado (Ejemplos)

### 7.1 Ciclo normal de una clase

```
1. Engine.initialize({ schedules: [clase] })
   → Sequence ACTIVE, 5 reminders PENDING
   → Reconciler.sync → 5 SCHEDULED

2. Llega 16:30 (primer reminder)
   → SCHEDULED → DELIVERED
   → Sequence: ACTIVE → WAITING_FEEDBACK

3. Usuario toca la notificación a las 16:35
   → DELIVERED → TAPPED
   → Engine.onReminderTapped() → navega a la clase
   → Sequence: WAITING_FEEDBACK (no cambia, solo navegó)

4. Usuario marca la clase como iniciada a las 16:40
   → Engine.onActionCompleted("schedule", "sched-25")
   → Sequence: WAITING_FEEDBACK → COMPLETED
   → Reminders restantes (16:55, 17:00, 17:10): SCHEDULED → SUPERSEDED
    → Reconciler cancela en el proveedor
```

### 7.2 Secuencia expira sin interacción

```
1. Secuencia creada con expires_at = 17:30
   → Sequence ACTIVE

2. Primer reminder se dispara a las 16:30
   → Sequence: ACTIVE → WAITING_FEEDBACK

3. Llegan las 17:30 (expires_at)
   → Al reconstruir el estado del sistema, las secuencias vencidas pasan a EXPIRED
   → Los reminders restantes se eliminan.
```

### 7.3 Entity cambia durante la ventana de feedback

```
1. Secuencia activa en WAITING_FEEDBACK para schedule con 5 reminders.
   → reminders[0] está en DELIVERED
   → reminders[1-4] están en SCHEDULED

2. Usuario mueve la clase de 17:00 a 18:00
   → Engine.onEntityChanged("schedule", "sched-25", updated)
   → Secuencia anterior completa:
        reminders[0] (DELIVERED): no cambia (ya se disparó)
        reminders[1-4] (SCHEDULED): → SUPERSEDED
   → Nueva secuencia: ACTIVE, 5 nuevos reminders PENDING
   → Reconciler: cancela los 4 viejos, programa los 5 nuevos
```

### 7.4 Colisión entre dos secuencias

```
1. Assessment con prioridad "high" y Schedule con prioridad "normal"
   → Ambos reminders coinciden a las 16:30

2. InterruptionPolicy.resolve():
   → Assessment: se mantiene a las 16:30 (high priority)
   → Schedule: se desplaza a las 16:35 (+5 min, normal priority)

3. Reconciler recibe el estado ya resuelto
   → Programa assessment a las 16:30
   → Programa schedule a las 16:35
```
