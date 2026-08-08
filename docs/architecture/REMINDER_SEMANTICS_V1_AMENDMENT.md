# Reminder Semantics v1.1 — Amendment del Contrato

> **Estado**: AMENDMENT CERRADO (S0–S4 completas — v1.1 operativo y regresionado). Fuente de verdad de **semántica** de los recordatorios.
>
> **Modifica**: `docs/architecture/REMINDER_SYSTEM_V1_CONTRACT.md` en las secciones de semántica por categoría y en el modelo de offset. La semántica v1.1 queda **congelada** — validada por la Full Regression Suite (34 suites / 466 PASS + 1 skip, `assertConverged` por escenario).
>
> **La infraestructura ejecutada en v1 PERMANECE CONGELADA**: SessionMerger, NotificationReconciler, SequenceFactory, persistencia MMKV, quiet hours, offline-first, invariante `OS === desired plan`, tests de idempotencia/convergencia, separación Settings / diagnóstico. Lo que se reabre es **solo la taxonomía semántica de triggers** — descubrimos que el modelo conceptual es incorrecto, no la ejecución.

---

## 1. Diagnóstico

La fórmula `scheduledAt = eventTime − offset` es técnicamente correcta, pero el **modelo de producto** no lo es para las cinco categorías. Se usó un único concepto ("anticipación antes de un anchor") para categorías con naturalezas semánticas distintas:

| Categoría | ¿Tiene un instante natural? | Modelo actual | Veredicto |
|---|---|---|---|
| Clases | Sí (hora de inicio) | ✅ Muy bueno | Mantener |
| Evaluaciones | Sí, pero el dominio guarda solo `date` | ⚠️ Aceptable | Enmendar granularidad |
| Eventos | Sí (si es timed) | ✅ Bueno | Enmendar: timed vs all-day |
| Sesiones FSRS | No necesariamente | ⚠️ Conceptualmente débil | Rediseñar |
| Periodos académicos | No (es un intervalo) | ❌ Muy discutible | Remover como notificable |

**Problema de fondo**: tratamos `ReminderPreferences` como si todas las categorías fueran eventos temporales equivalentes. No lo son. El offset funciona naturalmente cuando hay un **evento-ancla**; no cuando hay un **estado** (FSRS) o un **intervalo** (periodo académico).

---

## 2. Taxonomía de triggers (3 clases)

```
Reminder Trigger
│
├── Event-based        →  trigger = instante del evento;  timing = antes (offset)
│     ├── Class          →  before(startAt, 15m)
│     ├── Assessment     →  before(dueAt, 24h)
│     └── Calendar Event →  timed: before(startAt, 15m) · all-day: sin offset temporal
│
├── Review-based       →  trigger = estado del conocimiento; timing = "cuando haya due"
│     └── FSRS           →  due-state a hora configurada
│
└── Lifecycle-based    →  trigger = transición de ciclo;  timing = ??
      └── Academic Period →  SIN notificación (decisión: remover como categoría notificable)
```

---

## 3. Contrato de granularidad temporal (DECISIÓN CENTRAL)

La causa raíz de evaluaciones y eventos no pertenece al Reminder Engine. El engine hace `anchor − offset` correctamente; el problema es que el **anchor que le entregamos carece de granularidad**. Threshold distingue ahora tres nociones temporales:

| Noción | Significado | ¿Usable como anchor de offset? |
|---|---|---|
| **`date`** | Fecha calendario, sin hora | ❌ No |
| **`datetime`** | Instante concreto, interpretación local | ✅ Sí |
| **`all-day`** | Ocupa un día pero no tiene instante de inicio utilizable para offsets | ❌ No (necesita semántica propia) |

**Reglas congeladas**:
1. **Los reminders basados en offset solo pueden usar un `datetime` válido.** Un anchor `date`-only no se convierte silenciosamente en medianoche.
2. **Las entidades `date`-only necesitan una semántica de reminder explícita**, distinta de "N minutos antes". No se inventa medianoche como sustituto de una hora real.
3. **Los eventos `all-day` no reciben reminders de offset temporal** basados en `startAt`. Si el producto quiere recordarlos, necesita una semántica distinta (p.ej. "recordar el día anterior"), que **no** es "15 minutos antes".

> **Por qué ahora**: corregir el paradigma mientras está fresco. Si posponemos, otros componentes se construirán sobre la premisa defectuosa (entity + offset) y re-descubriremos el mismo problema en meses.

---

## 4. Modelo de Reminder (nuevo)

Ya no: `Reminder = entity + offset`

Ahora: `Reminder = notification trigger + temporal semantics`

```
Class           → before(startAt, 15m)
Assessment      → before(dueAt, 24h)            (domain debe proveer datetime)
Timed Event     → before(startAt, 15m)
All-day Event   → sin reminder de offset (o semántica explícita de producto)
FSRS            → due-state a hora configurada
AcademicPeriod  → sin reminder
```

---

## 5. Matriz de decisiones por categoría

| Categoría | Clase | Trigger real | Ancla | ¿Offset tiene sentido? | Decisión |
|---|---|---|---|---|---|
| Clases | Event | próxima ocurrencia (`day_of_week` + `start_time`) | `startAt` (datetime) | ✅ Sí | **MANTENER** — sin cambios |
| Evaluaciones | Event / Deadline | tipo de evaluación (`assessmentType`) | `starts_at` (exam) · `due_at` (deadline) | ✅ Sí, con datetime | **ENMENDADA (S1)** — el dominio provee el anchor |
| Eventos (timed) | Event | inicio del evento | `start_at` (datetime) | ✅ Sí | **MANTENER** — con `is_all_day=false` |
| Eventos (all-day) | Event sin instante | — | — | ❌ No | **SIN reminder de offset** — `is_all_day=true` |
| FSRS / repasos | Review | estado due de tarjetas | — | ❌ No | **REDISEÑADO (S1)** — due-state, 1 alerta agregada diaria a `checkTime` |
| Periodo académico | Lifecycle | intervalo `start–end` | — | ❌ Dudoso | **REMOVER** como categoría notificable |

---

## 6. Decisiones de contrato (S1 — resueltas)

### 6.1 Assessment — modelo temporal del dominio

`Assessment` soporta campos **opcionales**: `date` (compatibilidad/día calendario durante la migración — **no** vuelve a usarse como sustituto de datetime para reminders), `starts_at?`, `ends_at?`, `due_at?`.

**La semántica de cuál ancla importa pertenece al dominio de Assessment, no a ReminderPolicy.** `assessmentType` expresa el tipo:

```
assessmentType: exam | deadline
  exam     →  anchor = starts_at     (evaluación presencial/síncrona)
  deadline →  anchor = due_at        (entrega con plazo)
```

Ejemplos:

```
Examen:    assessmentType=exam,    starts_at=2026-08-20 14:00, ends_at=16:00, due_at=null
           → reminder = starts_at − 1 día = 19 ago 14:00
Entrega:   assessmentType=deadline, starts_at=null, ends_at=null, due_at=2026-08-20 23:59
           → reminder = due_at − 1 día = 19 ago 23:59
```

**Regla**: si el anchor requerido por `assessmentType` es `null`, **no hay reminder** (la entidad no tiene instante utilizable; no se inventa medianoche). `date` queda solo como representación de calendario.

### 6.2 CalendarEvent — timed vs all-day (flag explícito)

```
CalendarEvent
├── start_at
├── end_at?
└── is_all_day
```

- **Timed** (`is_all_day=false`): `before(start_at, offset)` — "15 min antes" es inequívoco.
- **All-day** (`is_all_day=true`): **no se genera reminder basado en offset temporal**. No se convierte `2026-08-20` en medianoche para producir `19 ago 23:45`. Un futuro "recordarme el día anterior" sería **otra semántica de trigger**, no reutilizar offset.

**Por qué flag y no derivación**: `2026-08-20 00:00` es ambiguo (evento a medianoche / fecha sin hora / all-day normalizado). El flag elimina la ambigüedad; el Reminder Engine no hace heurísticas sobre strings o timestamps para adivinar la intención del usuario.

### 6.3 FSRS — due-state (alerta agregada diaria)

```
FSRS
 ↓
¿existen tarjetas due (dueCardsCount > 0)?
 ↓ sí
Reminder Scheduler
 ↓
checkTime = 09:00   (preferencia global de repasos)
 ↓
1 notificación agregada: "Tienes 12 repasos pendientes"
```

- **El estado que manda es FSRS**: la condición es `dueCardsCount > 0`. Si es 0 → cero reminders; si es 12 → **exactamente una** notificación (no una por deck: "Expo 5, React 4…" convertiría la recuperación en un generador de interrupciones).
- **`checkTime` es una preferencia propia** (global para repasos), no un offset: ya no se calcula `anchor − offset`, se dice "comprueba si tengo repasos pendientes a esta hora". Sin hora por deck.
- **Re-armado diario**: si el usuario no estudia y siguen vencidas, la alerta se reprograma cada día a `checkTime` (Lun 12 due → 🔔, Mar 12 → 🔔, Mi 7 → 🔔, Jue 0 → —). Al estudiar (`due=0`), el reconciler **cancela** la siguiente alerta.
- **Trigger distinto en el engine**: `ReviewDueTrigger` (`checkTime` + `dueCardsCount`), que **no** pasa por el pipeline `anchor − offset` de schedule/assessment/event.

### 6.4 Migración MMKV de preferencias (v1 → v1.1)

- Se **elimina** `grading_period` de las categorías.
- `flashcard_deck` cambia de forma: `offset` → `checkTime` (HH:MM global).
- `parseReminderPreferences` ya ignora claves desconocidas (forward-compatible para remover `grading_period`); definir el schema v1.1 explícito y su fallback.

---

## 7. Fases de ejecución

| Fase | Entregable | Toca | Estado |
|---|---|---|---|
| **S0** | Audit semántico + decisiones de paradigma | 0 código | ✅ Cerrada |
| **S1** | Contract Amendment: §6 resuelto (Assessment temporal, CalendarEvent all-day, FSRS due-state, migración MMKV) | contrato + preferencias + dominio | ✅ Cerrada |
| **S2** | Engine: `ReviewDuePlanBuilder` (due-state agregado); policies assessment/event consumen datetime + `assessmentType` + `is_all_day`; `flashcard_deck` migra a `checkTime` | engine + registry + snapshot + coordinator + navigation | ✅ Cerrada |
| **S3** | Settings: UI deriva del contrato corregido (sin periodo académico; repasos con `checkTime`; assessment/eventos con hora) | UI | ✅ Cerrada |
| **S4** | Regression: `OS === desired plan` por escenario; nuevos tests por categoría cambiada; contract doc, FEATURE_MATRIX, AGENTS actualizados | tests + docs | ✅ Cerrada |

---

## 8. Registro de decisiones

| Fecha | Decisión | Alcance |
|---|---|---|
| 2026-08-08 | FSRS = **due-state** ("tienes repasos pendientes") a hora configurada; se abandona el ancla "siguiente hora en punto − offset" | Review-based |
| 2026-08-08 | **Periodo académico removido como categoría notificable**; `AcademicPeriod` permanece como entidad académica de dominio (startDate/endDate/subjects) | Lifecycle-based |
| 2026-08-08 | Threshold distingue **`date` / `datetime` / `all-day`**; offsets solo con `datetime`; `date`-only y `all-day` requieren semántica explícita, nunca medianoche sustituta | Granularidad temporal |
| 2026-08-08 | Modelo de reminder = **trigger + temporal semantics** (ya no entity + offset) | Modelo |
| 2026-08-08 | **Assessment**: soporta `starts_at?` / `ends_at?` / `due_at?` + `assessmentType (exam \| deadline)`; el anchor lo decide el dominio, no ReminderPolicy; `date` queda solo como compatibilidad | Assessment |
| 2026-08-08 | **CalendarEvent**: `is_all_day` explícito; timed → `before(start_at, offset)`; all-day → sin reminder de offset | CalendarEvent |
| 2026-08-08 | **FSRS due-state operativo**: 1 alerta agregada diaria a `checkTime` global, condición `dueCardsCount > 0`, re-armado diario mientras haya due, cancel al llegar a 0; `flashcard_deck` migra de `offset` a `checkTime` | FSRS |
