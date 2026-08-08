# Reminder System v1 — Contrato Congelado (Notifications v1)

> **Estado**: 🔒 CONGELADO (Ago 2026). Comportamiento validado por la Full Regression Suite (extremo a extremo). Este documento es la **fuente de verdad** del Reminder System v1.1 y de la superficie de Notifications en Settings. Ningún cambio de comportamiento sin nueva evidencia de producto.
>
> **⚠️ AMENDMENT v1.1 RESUELTO (Ago 2026)**: la **semántica** de triggers quedó enmendada y **congelada**. La infraestructura ejecutada en v1 (SessionMerger, reconciler, SequenceFactory, MMKV, quiet hours, invariante `OS === desired plan`) **se mantiene**, y el modelo conceptual "entity + offset" quedó corregido por `REMINDER_SEMANTICS_V1_AMENDMENT.md` — fuente de verdad de semántica: assessment exam→`starts_at` / deadline→`due_at` (sin fallback a `date`), calendar_event timed vs `is_all_day`, y FSRS **due-state** (1 alerta agregada diaria a `checkTime`, identidad `flashcard_deck::<id>::daily`).

> **Alcance**: Este contrato reemplaza, para las secciones que contradigan, los siguientes documentos: `ReminderSettings-DesignBrief.md`, `Reminder_Product_Spec.md`, `Reminder_Architecture.md` (secciones de perfiles/preferencias/digest), `Reminder_Domain_Model.md` (secciones de perfiles/digest), `NOTIFICATION_ARCHITECTURE.md` (secciones de bugs pre-WIRING), `audits/REMINDER_NOTIFICATION.md` (recomendaciones). El motor y su pipeline quedan **congelados**: no se reabre la arquitectura con estos tests como excusa.

---

## 1. Propósito

El Reminder System traduce el estado local del dominio (SQLite) en notificaciones en el OS, sin depender del backend. El estado puede reconstruirse **completamente desde el dispositivo** (local-first / offline-first): SQLite → intents lógicos → preferencias device-local → plan deseado → reconciler → OS.

---

## 2. Pipeline (orden de datos)

```
SQLite / local state
        ↓
ReminderSnapshotBuilder → ReminderSourceSnapshot
        ↓
SessionMerger (solo schedules)          → identidad lógica de sesiones
        ↓
intents lógicos (session id `logical::<key>`)
        ↓
SchedulePlanBuilder + ReminderPreferences (MMKV device-local)
        ↓            ↓
    offset por categoría · quiet hours (OMIT) · categoría disabled → sin secuencia
        ↓
ReminderEngine (policies + SequenceFactory + InterruptionPolicy)
        ↓
Desired Plan (computeCurrentPlan)
        ↓
NotificationReconciler
        ↓
NotificationProvider → OS scheduler (expo-notifications)
```

**Invariante central (validado por tests)**:

```
OS === desired plan
```

El estado materializado en el OS debe ser **exactamente** el plan que el engine cree que debe programar: sin `missing`, sin `orphan`, sin duplicados, sin churn en reconciliaciones repetidas.

---

## 3. ReminderPreferences — Contrato device-local

`mobile/src/services/reminders/ReminderPreferences.ts` (módulo puro) + `ReminderPreferencesService.ts` (IO MMKV síncrono, clave `threshold.reminderPreferences.v1`).

### 3.1 Decisión de sincronización (CRÍTICA)

> **`ReminderPreferences` es DEVICE-LOCAL en v1 y NO participa en el Sync Protocol.**

- No existe tabla SQLite ni entidad sincronizable para preferencias de recordatorios.
- No participa en Initial Sync, Delta Sync ni Push. No tiene `sync_version`, `deleted_at` ni `sync_queue`.
- Se persiste en **MMKV** (device-local), no en AsyncStorage.
- Motivo: son metadatos de configuración del dispositivo, no datos de dominio del usuario. La taxonomía oficial la clasifica como **Entidad Local** (véase `docs/sync/SYNC_ENTITY_SPEC.md`).
- El backend no conoce ni debe conocer estas preferencias. No hay endpoint.

### 3.2 Estructura del contrato

| Campo | Tipo | Semántica |
|---|---|---|
| `notificationsEnabled` | `boolean` | Master switch. `false` → **plan vacío** para todas las entidades (incluye assessments). El reconciler lleva el OS a cero de forma determinista. |
| `defaultOffset` | `number` | Anticipación global en minutos. `15` por defecto. |
| `categories` | 5 categorías | `{ assessment, schedule, calendar_event, flashcard_deck, grading_period }` — exactamente las 5 entidades del engine. Cada categoría: `{ enabled: boolean, offset: number \| null }`. |
| `quietHours` | `{ enabled, start, end }` | `start`/`end` en `HH:MM`. `enabled: false` por defecto (default `22:30`–`07:00`). |

### 3.3 Semánticas congeladas

- **Offset por categoría**: `category.offset ?? defaultOffset`. `offset: null` = "usar predeterminado" (hereda `defaultOffset`). Un solo offset por categoría.
- **Máximo 1 recordatorio por evento lógico** (no por fila física). 3 filas duplicadas de la misma clase → **1 notificación en el OS**.
- **Categoría `enabled=false`** → sin recordatorios de esa categoría; las demás intactas. El reconciler limpia **solo** las de esa categoría.
- **Quiet hours → OMIT, no defer**. Un `scheduledAt` dentro de la ventana **no nace**, no se difiere.
- **Sesión no clasificable** (sin `day_of_week`/`start_time`) → sin secuencia (nada se pierde; ClassPolicy no genera secuencia de todos modos).
- **Sesión con TODAS las filas `cancelled`** → omitida; con ≥1 activa → activa.
- **`initialize` es un rebuild determinista**: limpia `desiredSequences` y `completedScheduleSessions`. El snapshot es la verdad; la memoria de "sesión completada" es efímera. El estado incremental (orden de llegada de eventos) y el estado reconstruido por snapshot convergen a orden idéntico.
- **Defaults centralizados**: `defaultOffset=15`; `assessment`/`grading_period` `offset=1440` (excepción explícita por categoría); `schedule`/`calendar_event`/`flashcard_deck` `offset=null` (heredan el global); quietHours off `22:30–07:00`. Los `15`/`1440` son defaults iniciales, no fallback estructural.
- **Fallback por campo ante corrupción** (JSON inválido, valores imposibles, schema viejo, ausencia de datos) — NUNCA bloquea el arranque (store que lanza → defaults).

### 3.4 Qué NO existe en el contrato

- ❌ Perfiles `minimal` / `standard` / `persistent` / `custom` como concepto de usuario. `ReminderProfile` es **interno** del engine (policies/types/tests). No se exponen en la UI ni en preferencias.
- ❌ "Tareas" como categoría. No es categoría de dominio hasta resolver su correspondencia con assessment/submit_work. No se inventa entidad por la UI.
- ❌ Weekly Digest. No existe en el engine. Es un schedule fijo recurrente independiente (no modelado aquí).

---

## 4. SessionMerger — Identidad lógica de sesiones

`mobile/src/services/reminders/SessionMerger.ts` (módulo puro). Clave de identidad congelada: `subject_id | day_of_week (7→0) | start_time | end_time | name` (normalizada).

- **No distinguen sesiones**: `color` (cosmético) y `status` (estado de la fila).
- **NUNCA se fusionan** filas que difieren en `end_time` (duración distinta) o `name` (Teoría vs Laboratorio) — son sesiones legítimas distintas.
- Salida determinística e independiente del orden de entrada; id estable (`logical::<key>`); `sourceScheduleIds` conserva todas las filas absorbidas (trazabilidad, nunca multiplicador).

---

## 5. Settings UI — Superficie de Notifications v1 (congelada)

Settings = **intención/control**. El usuario configura **qué**, **cuándo** y **cómo** quiere ser notificado. No inspecciona el resultado materializado del scheduler.

```
Settings → Notificaciones
├── Estado / permiso del SO (banner si no hay permiso)
└── Recordatorios → PersonalizeRemindersModal
    ├── Master switch (notificationsEnabled)
    ├── 5 categorías (toggle + offset por categoría)
    ├── Predeterminado vs offset explícito (chip "Predeterminado" → null)
    ├── Anticipación predeterminada (defaultOffset)
    ├── Horario de silencio (quietHours: enabled + inicio + fin)
    └── Restaurar valores predeterminados (confirmación + reset)
```

### Lo que NO aparece en Settings v1

- ❌ Perfiles (minimal/standard/persistent/custom)
- ❌ "Recordatorios activos" (lectura cruda del OS — eliminado Ago 2026)
- ❌ "Próximos recordatorios" (decisión de producto: queda como feature futura *Agenda/Upcoming* independiente de Settings, si el producto demuestra que aporta confianza)
- ❌ Diagnóstico (Schedules Audit, expected/scheduled, duplicates, convergence)
- ❌ IDs técnicos ni conceptos del OS scheduler
- ❌ Botón "Enviar notificación de prueba"

### Frontera de responsabilidades

| Superficie | Orientación |
|---|---|
| **Settings** | intención/control del usuario |
| **Developer Console** (`app/developer.tsx`) | diagnóstico DURANTE desarrollo. Herramienta interna, **NO** forma parte del producto final |
| Futura **Agenda/Upcoming** | información para el usuario, si el producto demuestra que la necesita |

---

## 6. Comportamiento del Reconciler (validado)

| Situación | Acción |
|---|---|
| Plan == OS (idéntico) | Sin churn (0 scheduled, 0 cancelled) |
| Trigger/título/cuerpo cambió (Δ > 1000 ms) | **cancel + reschedule** del mismo id — sin residuo ni duplicados (p.ej. offset 15→30) |
| En plan, no en OS (`missing`) | schedule |
| En OS, no en plan (`orphan`) | cancel (p.ej. categoría deshabilitada, master switch off) |

---

## 7. Contrato de tests / regresión

- **Suite completa**: 34 suites / 466 PASS + 1 skip (el skip es el contrato legacy: 3 filas físicas → 9 reminders por fila, cuando el engine NO recibe `preferencesProvider`; se conserva como frontera).
- **Full Regression E2E** (`mobile/src/services/reminders/__tests__/ReminderEngine.FullRegression.test.ts`): 28 escenarios sobre el pipeline wired completo (store MMKV → service → provider → engine → reconciler → OS) cubriendo la **matriz v1.1**:
  - Cold start — OS vacío → plan exacto; Offline — delta + prefs + cierre/reapertura → convergencia (estado reconstruido ≡ incremental); Duplicados A,A,A → 1 notificación sin churn.
  - Preferencias — offset 15→30 cancel+reschedule; categoría deshabilitada → esa categoría a cero; master switch off → plan vacío; quiet hours → omit; reset → reconverge.
  - **FSRS agregado diario** — N decks con due → exactamente N (`flashcard_deck::<id>::daily`, stagger +5min); card_count=0 → 0; checkTime configurable 08:00 → agenda a esa hora; cambio de checkTime → cancel+reschedule sin residuo; evento de mazo → resync → exactamente 1; due 5→0 / onEntityDeleted / action_completed → cancel; categoría deshabilitada → solo repasos a cero.
  - **Contrato de ancla** — exam→starts_at y deadline→due_at → 5 recordatorios cada uno; sin ancla → 0 (sin fallback a `date`); cambio de ancla runtime → reagenda misma identidad, nuevos tiempos.
  - **Calendar event** — timed → 2 recordatorios [−60, 0]; all-day → 0; timed→all-day runtime → OS converge a cero.
  - **Matriz combinada** — 2 clases + exam + deadline + sin-ancla + deck con due + deck vacío + timed + all-day → 15 exactas; reinicio offline → estado reconstruido ≡ incremental.
- **Invariante por escenario**: `assertConverged` — el estado del OS es EXACTAMENTE `computeCurrentPlan()`.
- **Regresión permanente** (real device snapshot): `ReminderEngine.RealSnapshot.FlashcardRegression.test.ts`.
- **Batería rápida**: `npm run test:regression` (10 tests, 8 escenarios). Suite completa del Reminder System: `npm run test:ci`.

### Cobertura de evidencia del defecto original

```
A A A  →  SessionMerger  →  A  →  1 notification (antes: 9 en el OS)
```

El multiplicador (3 filas físicas × 3 offsets = 9 notificaciones) queda cerrado: la identidad de secuencia es por **intento lógico**, no por fila física.

### Regla de fixtures para decks (válida también en producción)

Un deck **sin tarjetas pendientes** debe representarse SIEMPRE de forma coherente:

```
card_count = 0   y   dueCardsCount = 0
```

`card_count = 0` junto a `dueCardsCount = 5` es un estado internamente contradictorio (no ocurre en el dominio real) y, por el `??` del builder (`dueCardsCount ?? card_count`, donde `dueCardsCount` es el agregado FSRS que manda), produce una notificación fantasma en pruebas. No es un bug del engine — es un problema de fixture. Ningún fixture debe modelar "deck vacío" con `dueCardsCount` distinto de 0.

---

## 8. Fronteras congeladas (no tocar)

- `ReminderEngine.configure()` **NO existe** — el `preferencesProvider` se pasa por constructor (8º parámetro opcional). Sin él, el legado por fila física se conserva intacto.
- NotificationReconciler y SequenceFactory **no se modificaron** durante el WIRING.
- Deeplink de sesión lógica no resalta la fila física (follow-up de UI, no de engine).
- El engine NO consulta el backend en ningún punto de la ruta crítica.
