# Auditoría Completa: Sistema de Reminders y Notificaciones

## 1. Arquitectura General

El sistema tiene **dos arquitecturas paralelas**:

| Sistema | Estado | Archivos |
|---------|--------|----------|
| **Reminder Engine** (nuevo) | Activo, inicializado en bootstrap | `mobile/src/services/reminders/` (21 archivos) |
| **Legacy Notification Service** | Código muerto / obsoleto | `notificationService.ts` (368 líneas), `useNotifications.ts` (101 líneas) |

### Pipeline del Reminder Engine

```
BaseRepository._emit()
    → RepositoryEventBus (debounce 50ms)
    → subscribeToEventBus (traduce tablas → engine types)
    → ReminderCoordinator.handleEntityChanged()
    → repo.getById() → engine.onEntityChanged()
    → ReminderEngine._buildDesiredSequence()
    → Pipeline:
        1. collect_sequences (desiredSequences → array)
        2. interruption.resolve (colisiones + límite simultáneos)
        3. templates.enrich (i18n → título/body/deeplink)
        4. reconciler.sync (diff vs expo-notifications → schedule/cancel)
```

### Lifecycle

- **Bootstrap**: `BootstrapManager` llama `coordinator.initialize()` → `snapshotBuilder.build()` (lee 5 repos de SQLite) → `engine.initialize(snapshot)` → genera todas las secuencias → pipeline → notificaciones programadas.
- **Tiempo real**: `subscribeToEventBus()` escucha `repositoryEventBus` → cada mutación regenera la secuencia afectada y re-ejecuta el pipeline completo.
- **Resync post-sync**: Después de cada ciclo de sincronización exitoso, `coordinator.resync()` regenera todo desde cero.
- **Logout**: `resetReminderCoordinator()` → `engine.destroy()` → cancela todas las notificaciones de expo.
- **Acción completada**: `handleActionCompleted(entityType, entityId)` → elimina la secuencia del mapa `desiredSequences` → pipeline cancela las notificaciones pendientes.

---

## 2. Tipos de Eventos y Cómo Se Notifican

### 2.1 Evaluaciones (Assessments)

**Policy**: `AssessmentPolicy.ts:14`
**Entidad**: `assessment`
**Tiempo base**: `entity.date` → `entity.startDate` → `entity.dueDate` (fallback en cascada)

| Perfil | Offsets | Descripción |
|--------|---------|-------------|
| Mínimo | `-1440, 0` | 24h antes, al momento del evento |
| Estándar | `-10080, -4320, -1440, -60, 0` | 7d, 3d, 24h, 1h, al momento |
| Persistente | `-10080, -4320, -1440, -60, 0, 60, 1440` | 7d, 3d, 24h, 1h, al momento, +1h, +24h |

**Intent**: `prepare_exam` (offsets ≤ 0), `follow_up` (offsets > 0)
**Prioridad**: `critical` si quedan ≤ 24h hasta el evento; `high` en caso contrario
**Cancelación**: Cuando `status === 'cancelled' || 'completed'`
**Expiración**: +1h después de la fecha del evento

### 2.2 Clases (Schedules)

**Policy**: `ClassPolicy.ts:13`
**Entidad**: `schedule`
**Tiempo base**: Calculado desde `day_of_week` + `start_time`. Calcula la **próxima ocurrencia** de la clase desde ahora (líneas 57-79).

| Perfil | Offsets | Descripción |
|--------|---------|-------------|
| Mínimo | `-5` | 5 min antes |
| Estándar | `-30, -5, 0` | 30min, 5min, al inicio |
| Persistente | `-60, -30, -5, 0, 10, 20` | 1h, 30min, 5min, al inicio, +10min, +20min |

**Intent**: `attend_class` (offsets ≤ 0), `follow_up` (offsets > 0)
**Prioridad**: `normal`
**Cancelación**: Cuando `status === 'cancelled'`
**Expiración**: `end_time` de la clase, o +1h si no hay `end_time`

**Cálculo del próximo horario** (`ClassPolicy.getEventTime`):
1. Obtiene el `day_of_week` (1=Lunes...7=Domingo) y `start_time` ("HH:MM")
2. Calcula cuántos días faltan hasta ese día de la semana
3. Si es el mismo día pero la hora ya pasó, avanza 7 días
4. Retorna un `Date` con la fecha/hora exacta de la próxima clase

### 2.3 Eventos del Calendario (Calendar Events)

**Policy**: `EventPolicy.ts:13`
**Entidad**: `calendar_event`
**Tiempo base**: `entity.endDate` → `entity.end_date` → `entity.end`

| Perfil | Offsets | Descripción |
|--------|---------|-------------|
| Mínimo | `-15` | 15 min antes |
| Estándar | `-60, 0` | 1h antes, al momento |
| Persistente | `-1440, -60, -15, 0` | 24h, 1h, 15min, al momento |

**Intent**: `follow_up` (para todos los offsets — ver bug abajo)
**Prioridad**: `normal`
**Cancelación**: Cuando `status === 'cancelled'`
**Expiración**: +30min después de la fecha de fin

### 2.4 Flashcards / Repasos (Reviews)

**Policy**: `ReviewPolicy.ts:13`
**Entidad**: `flashcard_deck`
**Tiempo base**: `now` (el momento en que el engine ejecuta, ya que los repasos son basados en urgencia, no en eventos)

| Perfil | Offsets | Descripción |
|--------|---------|-------------|
| Mínimo | `0` | Al momento (inmediato) |
| Estándar | `0` | Al momento (inmediato) |
| Persistente | `0, 60, 1440` | Ahora, +1h, +24h |

**Mecanismo**: Cuando `dueCardsCount > 0`, el engine programa un recordatorio inmediato. Al completar una sesión de repaso, `handleActionCompleted('flashcard_deck', deckId)` elimina la secuencia → cancela notificaciones pendientes.
**Intent**: `review_cards`
**Prioridad**: `normal`
**Cancelación**: Cuando `dueCardsCount <= 0`
**Expiración**: `null` (nunca expira — persiste hasta completarse)

### 2.5 Períodos Académicos (Grading Periods)

**Policy**: `GradingPolicy.ts:13`
**Entidad**: `grading_period`
**Tiempo base**: `entity.closeDate` → `entity.close_date` → `entity.endDate`

| Perfil | Offsets | Descripción |
|--------|---------|-------------|
| Mínimo | `-1440, 0` | 24h antes, al cierre |
| Estándar | `-10080, -1440, 0` | 7d, 24h, al cierre |
| Persistente | `-10080, -4320, -1440, -60, 0` | 7d, 3d, 24h, 1h, al cierre |

**Intent**: `submit_work`
**Prioridad**: `normal`
**Cancelación**: Cuando `status === 'closed' || 'cancelled'`
**Expiración**: +1 día después de la fecha de cierre

---

## 3. InterruptionPolicy — Gestión de Colisiones

**Archivo**: `InterruptionPolicy.ts`

1. **Supresión de review_cards**: Cuando `_activeStudy === true`, se omiten todos los recordatorios de tipo `review_cards` (líneas 69-71). Nunca se activa desde producción — solo existe para testing.
2. **Agrupación por ventana de 5 minutos** (líneas 106-116): Recordatorios dentro de la misma ventana de 5min se agrupan. Solo se conservan los de mayor prioridad.
3. **Desplazamiento de colisiones** (líneas 130-148): Dentro de un grupo, el de mayor prioridad se queda en su hora original. Los demás se desplazan +5min cada uno.
4. **Límite simultáneo** (línea 154): Solo se entregan **3 notificaciones máximo** por pipeline execution. Las demás se descartan.

---

## 4. Perfiles de Notificación — UI y Configuración

### 4.1 Perfiles Disponibles

Definidos en `useReminderSettings.ts:7`:

| Perfil | Descripción |
|--------|-------------|
| `minimal` | Solo recordatorios críticos |
| `standard` (default) | Recordatorios escalonados |
| `persistent` | Múltiples avisos con seguimiento |
| `custom` | El usuario elige offsets específicos |

### 4.2 Arquitectura de Configuración

```
UI (PersonalizeRemindersModal)
  → useReminderSettings (hook con useState — SIN persistencia)
    → globalProfile: ReminderProfileName
    → categories: CategorySetting[] (5 categorías)
    → effectiveCategories (resuelve herencia global→categoría)
```

**Cada categoría puede**:
- Heredar del perfil global (`inheritsFromGlobal: true`)
- Tener su propio perfil (`inheritsFromGlobal: false`, `profileName` definido)
- Tener offsets custom cuando el perfil es `custom`

**Offsets disponibles para custom** (line 10 del modal):
`[5, 15, 30, 60, 120, 1440]` minutos

### 4.3 Visor de Recordatorios Activos

`ActiveRemindersModal.tsx` — lee directamente `expo-notifications.getAllScheduledNotificationsAsync()` y agrupa por fecha. Es una vista de observabilidad pura (read-only).

---

## 5. Legacy Notification Service — Código Muerto

### `notificationService.ts` (368 líneas)

Funciones legacy: `scheduleDeadlineNotification`, `scheduleClassNotification`, `scheduleWeeklyDigest`, plus funciones de progreso de backup/download.

### `useNotifications.ts` (101 líneas)

Hook marcado como `TEMPORARY` (línea 1). **Nunca es importado** por ningún componente. El archivo `_layout.tsx:21` tiene un comentario que dice "gestionadas por useNotifications" pero el hook no se invoca.

---

## 6. Incongruencias, Errores Lógicos y Problemas Encontrados

### BUG CRÍTICO 1: `shouldCancel` y `shouldCancelReminder` nunca se invocan

**Archivos afectados**: Todos los 5 policies + `ReminderPolicy.ts` (interface)

Los métodos `shouldCancel()` y `shouldCancelReminder()` están definidos en la interface `ReminderPolicy` e implementados en las 5 políticas, pero **jamás son llamados** desde el ReminderEngine, Coordinator, ni ningún código de producción. Solo se usan en tests.

**Consecuencia**: Las condiciones de cancelación por status (`cancelled`, `completed`, `closed`) **nunca se evalúan** en runtime. Si un usuario crea una evaluación, la cancella, y luego la re-crea con el mismo ID, el engine no cancela las notificaciones antiguas basándose en el status. Solo las cancela por:
- `entity_deleted` event (línea 156 del engine)
- `action_completed` event (línea 161 del engine)
- Expiración por tiempo
- Reconciliación por diff de contenido

### BUG CRÍTICO 2: UI settings no están conectados al engine

**El ciclo está roto**:
1. `useReminderSettings` gestiona perfil global y por categoría en `useState` (in-memory)
2. `ReminderEngine._getProfileFor()` (línea 114-116) **siempre retorna `policy.defaultProfile`** (hardcoded `'standard'`)
3. No existe ningún puente que pase las preferencias del usuario al engine
4. La tabla `reminder_settings` planificada en el Design Brief **nunca se implementó**

**Consecuencia**: El usuario puede cambiar el perfil en la UI (Minimal/Persistente/Custom) y la app muestra los controles, pero **el engine siempre usa Standard**. Los cambios son puramente cosméticos.

### BUG 3: `enabled` de categoría no se verifica

`CategorySetting.enabled` se muestra en la UI (con Switch toggle), pero:
- El engine no lo lee
- El coordinator no lo lee
- `ReminderEngine._buildDesiredSequence()` no verifica si la categoría está habilitada

**Consecuencia**: Desactivar una categoría en la UI no tiene efecto real.

### BUG 4: `calendar_event` siempre usa intent `follow_up`

En `SequenceFactory._determineIntent()` (líneas 78-97), cuando `entityType === 'calendar_event'` con `offsetMinutes <= 0`, no hay case que lo maneje explícitamente — cae al `default: return 'follow_up'`.

Un evento de calendario que empieza en 1 hora debería tener un intent como `upcoming_event` o similar, no `follow_up`. El título de la notificación dice "Follow up on..." para todos los eventos de calendario, incluso los que están por empezar.

### BUG 5: `_resolveCollisions` usa grouping relativo vs absoluto

`InterruptionPolicy._resolveCollisions()` agrupa por `Math.floor(minutesFromEarliest / 5)`, donde `earliestTime` es el reminder más temprano del plan actual. Esto significa que la agrupación es **relativa al plan**, no a una hora fija. Si el plan se regenera en un momento diferente, los mismos reminders pueden agruparse diferente → resultado no determinista en edge cases.

### BUG 6: `EventPolicy.getEventTime` no está implementado

`EventPolicy` no override `getEventTime()` (es opcional en la interface). El engine hace `policy.getEventTime?.(entity, now) ?? null` (línea 209). Para `calendar_event`, `eventTime` será siempre `null`, por lo que `baseTime = now` en `SequenceFactory` (línea 31).

**Consecuencia**: Los offsets de eventos de calendario se calculan desde **ahora**, no desde la hora del evento. Un evento que empieza en 3 días con offset `-60` se programa para 59 minutos desde ahora, no para 1 hora antes del evento.

Esto es un **bug significativo** — los offsets de calendar_event deberían ser relativos a la hora del evento, pero `getEventTime` no existe en `EventPolicy`.

### BUG 7: `useNotifications` hook nunca se invoca pero tiene dependencias rotas

`_layout.tsx:21-22` declara `const { assessments, schedules: allSchedules } = useDataStore()` con un comentario que dice "gestionadas por useNotifications", pero `useNotifications` no se llama. Las variables `assessments` y `allSchedules` se extraen pero no se usan en el layout para notificaciones.

### BUG 8: `ReminderCoordinator.resync()` no tiene protección de concurrencia

`resync()` (líneas 48-53) se llama después de cada sync cycle. No tiene protección contra concurrencia — si dos syncs completan casi simultáneamente, dos `resync()` se ejecutan en paralelo, generando un race condition sobre `desiredSequences`.

### BUG 9: `InterruptionPolicy._applySimultaneousLimit` descarta recordatorios sin razón

Después de resolver colisiones y desplazar, `_applySimultaneousLimit` simplemente hace `.slice(0, 3)` (línea 154). Si hay 5 reminders no colisionantes programados para horas diferentes, solo se entregan 3. Los otros 2 se pierden permanentemente hasta el próximo pipeline run.

### BUG 10: `activeStudy` flag nunca se activa

`InterruptionPolicy.setActiveStudy(true)` existe (línea 16) pero no hay código en producción que lo llame. La supresión de `review_cards` durante estudio nunca ocurre.

### BUG 11: `ReminderSnapshotAssembler` no enriquece `statistics`

`ReminderSnapshotAssembler.build()` crea `ReminderSnapshot` sin `statistics` (línea 17-21). El tipo `ReminderStatisticsSnapshot` existe en `types.ts` con `dueCount`, `totalCards`, `overdueDays`, pero nunca se pobla. La información de urgencia no viaja al template resolver ni a la UI.

### BUG 12: `notificationService.ts` crea canal `default` vs Engine crea canal `reminders`

El legacy service crea un canal Android llamado `'default'` (línea 208). El Reminder Engine crea `'reminders'` (línea 29 de NotificationProvider). Si ambos sistemas estuvieran activos, las notificaciones irían a canales diferentes. Como el legacy está muerto, esto no causa problemas actualmente, pero es una inconsistencia.

### BUG 13: `EventPolicy.getExpiration` usa `endDate` pero la UI puede enviar `startDate`

`EventPolicy` busca `entity.endDate ?? entity.end_date ?? entity.end` para expiración. Pero si el evento solo tiene `startDate` (sin endDate), expiración es `null` → el recordatorio nunca expira.

### BUG 14: `ReminderCoordinator.handleEntityChanged` es async pero `subscribeToEventBus` no awaitza

En `subscribeToEventBus.ts:25`, `coordinator.handleEntityChanged()` retorna Promise que se `.catch()` pero no se awaitza. Esto es correcto para fire-and-forget, pero significa que si hay un error en el repositorio (línea 78), el error se silencia con un `console.warn` y la secuencia no se actualiza.

---

## 7. Lo que el Sistema NO Hace

1. **No hay notificaciones de tareas/trabajos** (homework/tasks) — La UI usa `calendar_event` para esto, que es genérico.
2. **No hay digest semanal** en el Reminder Engine — Solo existía en el legacy `notificationService.ts`.
3. **No hay notificaciones push remotas** — Todo es local via `expo-notifications`.
4. **No hay recordatorios recurrentes para schedules** — El engine calcula la próxima ocurrencia y genera offsets desde ahí. Si el usuario tiene clase todos los lunes, se genera una secuencia nueva cada vez que el engine corre (via resync), no una notificación recurrente nativa.
5. **No hay persistencia de configuración** — Los settings se pierden al reiniciar la app.
6. **No hay supresión nocturna** — Las notificaciones pueden llegar a cualquier hora.
7. **No hay badge count management** — Solo se asigna `badge: 1` para `critical` priority, no se calcula el total.

---

## 8. Resumen de Diferencias entre Perfiles

| Característica | Minimal | Standard | Persistent | Custom |
|---|---|---|---|---|
| Cantidad de avisos por evento | 1-2 | 3-5 | 5-7 | Variable |
| Avisos post-evento | No | No | Sí (+1h, +24h) | Si el usuario los elige |
| Horas de anticipación | 5min-24h | 5min-7d | 5min-7d | El usuario define |
| ¿Cuándo usar? | Poca importancia | Uso diario | Exámenes críticos | Control total |

---

## 9. Mejoras Recomendadas

### Prioridad Crítica (funcionalidad rota)

1. **Conectar UI settings al engine**: Implementar la tabla `reminder_settings` (SQLite, sincronizable), leer en `ReminderCoordinator.initialize()`, y pasar el perfil efectivo a `_getProfileFor()`. Sin esto, toda la UI de configuración es cosmética.

2. **Invocar `shouldCancel` en el engine**: Agregar verificación en `_buildDesiredSequence()` para que si `policy.shouldCancel(seq, entity)` retorna true, no se genere la secuencia. Esto habilita cancelación automática por status.

3. **Implementar `getEventTime` en `EventPolicy`**: Para que los offsets de calendar_event sean relativos a la hora del evento, no a `now`.

4. **Verificar `enabled` en el pipeline**: Si una categoría está deshabilitada, no generar secuencias para ella.

### Prioridad Alta

5. **Corregir `_applySimultaneousLimit`**: No descartar reminders que están a horas significativamente diferentes. Solo limitar los que están en la misma ventana temporal.

6. **Corregir intent para calendar_event**: Agregar un intent específico (ej: `upcoming_event`) para offsets negativos de eventos de calendario.

7. **Persistir configuración**: Migrar de `useState` a MMKV o SQLite. Los settings se pierden en cada restart.

8. **Proteger `resync()` contra concurrencia**: Agregar un debounce o mutex para evitar que dos resyncs se ejecuten simultáneamente.

### Prioridad Media

9. **Poblar `ReminderSnapshot.statistics`**: Enriquecer el snapshot con `dueCount`/`totalCards` para que los templates puedan incluir contexto (ej: "Tienes 12 cards para repasar").

10. **Eliminar código legacy**: `notificationService.ts` funciones de deadline/class/weekly + `useNotifications.ts`. Mantener solo las funciones de backup/download progress que sí se usan.

11. **Activar `setActiveStudy(true)`** cuando el usuario está en `FlashcardStudyScreen` para suprimir notificaciones de review durante la sesión.

12. **Corregir el comentario muerto** en `_layout.tsx:21` que referencia `useNotifications`.

### Prioridad Baja

13. **Agregar notificación recurrente nativa** para schedules en vez de regenerar cada resync.

14. **Gestión de badge count**: Calcular el total de notificaciones pendientes y reflejarlo en el badge.

15. **Supresión nocturna configurable**: No notificar entre horas definidas por el usuario.

16. **Tests de integración end-to-end** que validen el flujo completo: UI → settings → engine → notificación programada.

---

## 10. Preguntas Frecuentes — Análisis Técnico

### ¿Quién llama a `scheduleNotificationAsync`?

La cadena de llamadas es:

```
RepositoryEventBus (evento created/updated)
  → subscribeToEventBus → coordinator.handleEntityChanged()
  → engine.onEntityChanged() → _enqueue()
  → _handleEvent() → _buildDesiredSequence() + _runPipeline()
  → interruption.resolve() → templates.enrich()
  → NotificationReconciler.sync(plan, provider)
  → ExpoNotificationProvider.schedule(reminder)
  → ExpoNotifications.scheduleNotificationAsync()  ← aquí se agenda realmente
```

**Llamadores directos a `scheduleNotificationAsync`**:

| Llamador | Contexto | Uso |
|----------|----------|-----|
| `ExpoNotificationProvider.schedule()` | Pipeline del Reminder Engine | Notificaciones de reminder (assessment, schedule, etc.) |
| `NotificationReconciler.sync()` | Pipeline del Reminder Engine | Reconciliación diff → schedule/cancel |
| `showDownloadProgressNotification()` | Descarga de modelos IA | Progreso de descarga |
| `updateDownloadProgressNotification()` | Descarga de modelos IA | Actualización de progreso |
| `completeDownloadNotification()` | Descarga de modelos IA | Descarga completada |
| `showBackupUploadNotification()` | Backup upload | Progreso de subida |
| `updateBackupUploadNotification()` | Backup upload | Actualización de progreso |
| `showBackupDownloadNotification()` | Backup download | Progreso de descarga |
| `scheduleDeadlineNotification()` | Legacy (no invocado) | Recordatorio 15min antes de fecha límite |
| `scheduleClassNotification()` | Legacy (no invocado) | Recordatorio semanal de clase |
| `scheduleWeeklyDigest()` | Legacy (no invocado) | Digest semanal |
| `ExpoProgressNotifier._schedule()` | Progreso genérico | Notificaciones de progreso |

Los notificadores de backup/download y progress se usan activamente. Los de deadline/class/weekly **no se invocan** (legacy muerto).

### ¿Se agenda la notificación inmediatamente cuando se crea o modifica un recordatorio?

**Sí, inmediatamente.** El flujo es en tiempo real:

1. El usuario crea/modifica un assessment, schedule, calendar_event, etc.
2. `BaseRepository._emit()` dispara un evento en `repositoryEventBus`
3. `subscribeToEventBus` lo recibe y llama a `coordinator.handleEntityChanged()`
4. El coordinator hace `repo.getById()` para obtener la entidad completa
5. El engine genera la nueva secuencia y ejecuta el pipeline completo
6. `NotificationReconciler.sync()` diff el plan contra las notificaciones existentes de expo
7. Las notificaciones se schedule/cancelan **en ese momento**

**No depende de**:
- Un proceso de sincronización con el servidor
- Abrir la app (se ejecuta aunque la app esté en background, siempre que el evento de repo se haya disparado)
- Un timer o cron job

**Excepción**: El `resync()` completo se ejecuta después de cada sync cycle exitoso (`BootstrapManager` línea 211-216), lo que regenera **todas** las secuencias desde cero. Esto es un safety net, no el mecanismo primario.

### ¿Las notificaciones quedan realmente registradas en el sistema operativo?

**Sí.** `expo-notifications` agenda las notifications a nivel del sistema operativo:

- **Android**: Las notificaciones se registran en el `AlarmManager` del sistema. Se persisten en la base de datos interna de expo-notifications.
- **iOS**: Las notificaciones se registran en el `UNUserNotificationCenter`. Se persisten en el sistema.

**Verificación**: `ActiveRemindersModal.tsx` llama a `getAllScheduledNotificationsAsync()` y muestra todas las notificaciones programadas. Esta función consulta directamente al SO por las notificaciones que realmente están agendadas.

**Flujo de verificación**:
```
ActiveRemindersModal.visible = true
  → getAllScheduledNotificationsAsync()  ← consulta al SO
  → setScheduled(all)                    ← guarda en estado React
  → renderiza lista agrupada por fecha
```

El contador en la sección de settings (`reminderCtx.health.scheduledCount`) también usa `getAllScheduledNotificationsAsync()` para mostrar cuántas notificaciones tiene el SO registrando realmente.

### ¿Qué ocurre si reinicias el teléfono? ¿Se reprograman?

**Las notificaciones sobreviven al reinicio.** `expo-notifications` almacena las notificaciones programadas en almacenamiento persistente del SO (no solo en memoria). Al reiniciar:

1. El SO reprograma automáticamente las notificaciones que estaban agendadas
2. Se disparan en el momento exacto original (usando `TIME_INTERVAL` trigger, que es relativo al momento del schedule)
3. **No se reprograman desde la app** — el SO las maneja independientemente

**Flujo post-reinicio**:
```
Teléfono reinicia
  → SO lee notificaciones pendientes de expo-notifications
  → Las reprograma en AlarmManager (Android) / UNNotificationCenter (iOS)
  → Cuando llega el momento → se disparan normalmente
```

**Nota sobre `resync()`**: Cuando la app vuelve a abrirse después del reinicio, `BootstrapManager` ejecuta `coordinator.initialize()` → `resync()`. Esto regenera las secuencias desde SQLite y las reconcilia contra las notificaciones existentes. Si algo cambió (ej: el usuario modificó un assessment mientras el teléfono estaba apagado), la reconciliación lo detecta y ajusta.

### ¿Qué pasa si cambias la hora del dispositivo o la zona horaria?

**El sistema es parcialmente resiliente, con matices:**

**Relojes `TIME_INTERVAL` (el Reminder Engine usa estos)**:
- Son **relativos** al momento del schedule: `seconds = Math.max(1, Math.floor((triggerDate - now) / 1000))`
- Si el usuario adelanta la hora 1 hora, la notificación se adelanta proporcionalmente (porque `now` avanzó)
- Si el usuario retrocede la hora 1 hora, la notificación se retrasa proporcionalmente
- **No se reprograman automáticamente** cuando cambia la zona horaria

**Clases recurrentes (`ClassPolicy.getEventTime`)**:
- Calcula la próxima ocurrencia basándose en la hora **local del dispositivo**
- Si el usuario cambia de zona horaria, el `getEventTime()` calcula la próxima clase en la nueva zona
- El `resync()` post-sync detecta el cambio y reconcilia (cancela notificación antigua, agenda nueva)

**Flujo de cambio de zona horaria**:
```
Usuario cambia de zona horaria (ej: viaje)
  → La notificación de clase programada anteriormente ya no es correcta
  → Cuando la app corre el próximo resync() o engine event:
    → ClassPolicy.getEventTime() recalcula en la nueva zona
    → NotificationReconciler detecta diff en scheduledAt
    → Cancela la notificación vieja, agenda la nueva
  → Las notificaciones de assessment/event (un punto en el tiempo) se afectan
    por el cambio de hora del dispositivo, no de zona horaria
```

**Edge case problemático**: Si el usuario cambia la zona horaria **sin abrir la app** y ocurre un evento (ej: crea un assessment), el `getEventTime` usa la zona actual pero el `TIME_INTERVAL` se calcula desde `now()` que está en la zona correcta. En este caso funciona bien. El problema es con notificaciones **ya agendadas** antes del cambio de zona — esas quedan con el valor en segundos original y no se recalculan hasta el próximo resync.

### ¿Se cancelan correctamente las notificaciones antiguas cuando un recordatorio cambia de fecha?

**Sí, mediante el `NotificationReconciler`.** El reconciler compara el plan actual contra las notificaciones existentes en expo:

**Archivo**: `NotificationReconciler.ts:5-42`

```typescript
// Lógica de cancelación:
toCancel = existing.filter((e) => {
  const d = planMap.get(e.identifier);
  if (!d) return true;                                    // No está en el plan → cancelar
  const timeDiff = d.scheduledAt - e.triggerDate;
  if (Math.abs(timeDiff) > 1000) return true;            // Cambió la hora → cancelar
  if (d.title !== e.title) return true;                   // Cambió el título → cancelar
  if (d.body !== e.body) return true;                     // Cambió el body → cancelar
  return false;                                           // Todo igual → mantener
});

// Lógica de re-agendado:
toSchedule = plan.deliverables.filter((d) => {
  const e = existingMap.get(d.id);
  if (!e) return true;                                    // No existía → agendar
  const timeDiff = d.scheduledAt - e.triggerDate;
  if (Math.abs(timeDiff) > 1000) return true;            // Cambió la hora → re-agendar
  if (d.title !== e.title) return true;                   // Cambió el título → re-agendar
  if (d.body !== e.body) return true;                     // Cambió el body → re-agendar
  return false;
});
```

**Escenarios cubiertos**:

| Escenario | ¿Se cancela la vieja? | ¿Se agenda la nueva? |
|-----------|----------------------|---------------------|
| Assessment cambia de fecha | Sí (diff en scheduledAt > 1s) | Sí |
| Assessment se renombra | Sí (diff en title/body) | Sí |
| Se cancela una entidad | Sí (entity_deleted elimina del mapa) | No (no hay nueva) |
| Se completa una acción | Sí (action_completed elimina del mapa) | No |
| Calendar event sin getEventTime | Problemático (ver abajo) | Problemático |

**Caso problemático con `calendar_event`**: Como `EventPolicy` no implementa `getEventTime()`, el `baseTime` es siempre `now()`. Cada vez que el engine corre, los offsets se recalculan desde ahora. Esto significa que si el engine corre a las 10:00 y hay un evento a las 14:00, agenda un offset `-60` para las 13:00. Si el engine corre a las 11:00, agenda el mismo offset para las 13:00 (la misma hora porque el evento es fijo). **Pero** si el engine corre después de las 13:00 (offset ya pasó), esa notificación se descarta en `_collect()` línea 65: `if (reminder.scheduledAt.getTime() < now.getTime()) continue`.

**Caso problemático con `schedule` (clases)**: `ClassPolicy.getEventTime()` recalcula la próxima ocurrencia. Si el engine corre dos veces en el mismo día, la misma clase obtiene la misma próxima fecha → la reconciliación detecta `scheduledAt` igual → no cancela ni re-agenda → **correcto**. Pero si el engine corre después de que la clase pasó, calcula la próxima semana → la notificación de la semana pasada se cancela (ya pasó y `_collect()` la descarta) y se agenda la nueva para la próxima semana → **correcto**.

---

# PARTE 2: Auditoría de Infraestructura de Notificaciones

## 11. ExpoNotificationProvider — Análisis del Trigger Real

### Código exacto del schedule

```typescript
// NotificationProvider.ts:45-81
async schedule(reminder: ScheduledReminder): Promise<string> {
  const triggerDate = reminder.scheduledAt.getTime();
  const now = Date.now();
  const seconds = Math.max(1, Math.floor((triggerDate - now) / 1000));

  const identifier = await ExpoNotifications.scheduleNotificationAsync({
    identifier: reminder.id,
    content: {
      title: reminder.title,
      body: reminder.body,
      data: {
        reminderId: reminder.id,
        deeplink: reminder.deeplink,
        priority: reminder.priority,
      },
      sound: true,
      ...(Platform.OS === 'android'
        ? {
            priority: reminder.priority === 'critical'
              ? ExpoNotifications.AndroidNotificationPriority.MAX
              : reminder.priority === 'high'
                ? ExpoNotifications.AndroidNotificationPriority.HIGH
                : ExpoNotifications.AndroidNotificationPriority.DEFAULT,
            channelId: 'reminders',
          }
        : {}),
      ...(reminder.badge !== undefined ? { badge: reminder.badge } : {}),
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: 'reminders',
    },
  });

  return identifier;
}
```

### Trigger usado

| Propiedad | Valor | Análisis |
|-----------|-------|----------|
| **type** | `TIME_INTERVAL` | Disparador relativo: "ejecutar en X segundos desde ahora" |
| **seconds** | `Math.max(1, Math.floor((triggerDate - now) / 1000))` | Calculado dinámicamente. Mínimo 1 segundo |
| **repeats** | **NO especificado** | Default de expo: `false` — notificación de **una sola vez** |
| **channelId** | `'reminders'` | Canal Android (HIGH importance, sound, vibration) |

### Consecuencias de `TIME_INTERVAL` sin `repeats`

- Cada notificación es un **one-shot**: se dispara una vez y se elimina del SO
- **No hay recurrencia nativa**: Para una clase semanal, el engine genera una notificación para la próxima ocurrencia. La siguiente se agenda cuando el engine vuelve a correr (resync o entity_changed)
- `TIME_INTERVAL` es **timezone-agnostic**: el valor en segundos es absoluto, no depende de zona horaria
- Si el usuario cambia la hora del dispositivo, la notificación se afecta proporcionalmente (porque `seconds` se calculó desde el `now` original)

### `channelId` duplicado

`channelId: 'reminders'` aparece en **dos lugares**: dentro de `content` (línea 68, para Android) y dentro de `trigger` (línea 76). Esto es redundante pero no causa error — expo lo ignora en `content` cuando ya está en `trigger`.

---

## 12. NotificationReconciler — Ventana de Race Condition

### Código exacto del sync

```typescript
// NotificationReconciler.ts:5-41
async sync(plan: DeliveryPlanResolved, provider: NotificationProvider) {
  const planIds = new Set(plan.deliverables.map((d) => d.id));
  const existing = await provider.getAll();           // ← Paso 1: lee existentes

  const toCancel = existing.filter(...);              // ← Paso 2: calcula qué cancelar
  const toSchedule = plan.deliverables.filter(...);   // ← Paso 3: calcular qué agendar

  const cancelPromises = toCancel.map((e) => provider.cancel(e.identifier));
  const schedulePromises = toSchedule.map((d) => provider.schedule({...}));

  await Promise.all([...cancelPromises, ...schedulePromises]);  // ← Paso 4: ejecuta TODO en paralelo

  return { scheduled: toSchedule.length, cancelled: toCancel.length };
}
```

### ¿Existe ventana entre cancel y schedule?

**Sí, hay una ventana potencial.** El reconciler ejecuta cancels y schedules **en paralelo** via `Promise.all`:

```typescript
await Promise.all([...cancelPromises, ...schedulePromises]);
```

Esto significa que:
1. Se lanzan todos los cancels **simultáneamente** con todos los schedules
2. No hay garantía de orden — el schedule puede completarse **antes** que el cancel
3. Si el SO procesa el schedule antes del cancel, hay un momento con **duplicados**
4. Si el SO procesa el cancel antes del schedule, hay un momento **sin notificación**

**En la práctica**: `expo-notifications` internamente serializa estas operaciones (todas llegan al mismo NATS module), así que la ventana es de microsegundos. No es un problema real, pero es un **code smell** — el patrón correcto sería `cancelAll` → `scheduleAll` secuencial.

### ¿Qué pasa si `scheduleNotificationAsync` falla?

**No hay manejo de errores.** El reconciler no tiene try/catch individual:

```typescript
const schedulePromises = toSchedule.map((d) =>
  provider.schedule({...}),  // ← si falla, Promise.all rechaza
);
await Promise.all([...cancelPromises, ...schedulePromises]);  // ← si 1 falla, TODOS fallan
```

Si `scheduleNotificationAsync` falla (ej: SO rechaza por límite de notificaciones, permiso revocado):
- `Promise.all` rechaza → el error sube a `_runPipeline()` → llega a `_handleEvent()` → `queued.reject(error)`
- El evento se marca como fallido en la cola del engine
- **Las notificaciones que ya se cancelaron no se restauran** — hay un estado inconsistente
- No hay retry para las notificaciones que fallaron

---

## 13. Android Manifest — Permisos

### Permisos declarados en `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.VIBRATE"/>
```

### Permisos **NO declarados**

| Permiso | Android Version | Estado | Impacto |
|---------|----------------|--------|---------|
| `POST_NOTIFICATIONS` | Android 13+ (API 33) | **NO declarado** | En Android 13+, las notificaciones requieren este permiso runtime. Expo lo maneja via `requestPermissionsAsync()`, pero si el usuario lo deniega, no hay fallback |
| `SCHEDULE_EXACT_ALARM` | Android 12+ (API 31) | **NO declarado** | No se necesita porque se usa `TIME_INTERVAL` (no `DATE` trigger exacto). Si se migrara a triggers de fecha exacta, sería requerido |
| `USE_EXACT_ALARM` | Android 12+ (API 31) | **NO declarado** | Mismo caso que arriba |

### Permisos en `app.json` (declarados por Expo)

```json
"permissions": [
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.WAKE_LOCK",
  "android.permission.FOREGROUND_SERVICE"
]
```

**Nota**: `expo-notifications` agrega automáticamente `POST_NOTIFICATIONS` al manifest generado en Android 13+ vía su plugin. No necesita declararse manualmente en `app.json`.

### Receivers registrados

**No hay receivers custom registrados.** Expo-notifications registra internamente:
- `ExpoNotificationReceiver` — recibe intents de notificaciones
- `NotificationService` (BOOT_COMPLETED receiver) — reprograma notificaciones al reiniciar

Estos se agregan automáticamente por el plugin `expo-notifications`.

---

## 14. Configuración de Expo — Canales y Prioridad

### Canales de notificación

```typescript
// NotificationProvider.ts:27-43
// Canal 1: Recordatorios (el activo)
await ExpoNotifications.setNotificationChannelAsync('reminders', {
  name: 'Recordatorios',
  importance: ExpoNotifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 100, 100, 100],
  sound: 'default',
});

// Canal 2: Progreso (backup/download)
await ExpoNotifications.setNotificationChannelAsync('progress', {
  name: 'Progreso',
  importance: ExpoNotifications.AndroidImportance.LOW,
  sound: null,
  vibrationPattern: undefined,
});
```

### Prioridad por tipo de reminder

```typescript
// NotificationProvider.ts:63-67
priority: reminder.priority === 'critical'
  ? ExpoNotifications.AndroidNotificationPriority.MAX      // assessments < 24h
  : reminder.priority === 'high'
    ? ExpoNotifications.AndroidNotificationPriority.HIGH    // assessments > 24h
    : ExpoNotifications.AndroidNotificationPriority.DEFAULT  // todo lo demás
```

### Handler de notificaciones en foreground

```typescript
// notificationService.ts:189-197
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

**Problema**: Este handler está en `notificationService.ts` (legacy), no en el Reminder Engine. Se ejecuta al importar el módulo, así que funciona. Pero si se elimina el legacy, se pierde este handler. Debería migrarse al Engine.

---

## 15. Background Behavior

### ¿Qué pasa cuando la app está en background?

**Las notificaciones se disparan correctamente.** `expo-notifications` usa el sistema de alarmas del SO:
- **Android**: `AlarmManager.setExactAndAllowWhileIdle()` internamente
- **iOS**: `UNUserNotificationCenter` (manejado por el SO)

La app **no necesita estar abierta** para que la notificación se dispare.

### ¿Qué pasa cuando la app está killed?

- Las notificaciones **siguen programadas** en el SO
- Se disparan en el momento correcto
- Al abrir la app, el notification handler maneja el tap
- `expo-notifications` persiste las notificaciones en SQLite interna

### Background fetch (no relacionado con reminders)

El proyecto usa `expo-background-fetch` para backups programados (`scheduledBackupService.ts`), **no** para reminders. Los reminders no dependen de background fetch — usan el mecanismo de alarmas del SO directamente.

---

## 16. Riesgos por Fabricante (OEM)

### Problema conocido

Algunos fabricantes Android restringen alarmas en background:

| Fabricante | Restricción | Impacto en Threshold |
|-----------|-------------|---------------------|
| **Xiaomi (MIUI)** | Battery saver desactiva alarmas en background | Notificaciones pueden no dispararse si el usuario activa "Battery saver" o "App battery saver: Restricted" |
| **Samsung (OneUI)** | Deep sleeping apps no reciben alarmas | Si el usuario pone Threshold en "Deep optimization", las notificaciones se pierden |
| **Huawei (EMUI)** | Protected apps bloqueadas en background | Similar a Xiaomi — requiere que el usuario agregue Threshold a "Protected apps" |
| **OnePlus (OxygenOS)** | Aggressive battery management | Similar a Xiaomi |
| **OPPO (ColorOS)** | Auto-launch desactivado por defecto | Las notificaciones pueden no llegar si auto-launch no está habilitado |

### Mitigaciones disponibles

1. **`WAKE_LOCK`** (declarado en manifest) — Mantiene el CPU activo brevemente para ejecutar la notificación
2. **`RECEIVE_BOOT_COMPLETED`** (declarado) — Reprograma notificaciones al reiniciar
3. **Canal HIGH importance** — Los canales HIGH bypassan algunas restricciones de battery
4. **`setNotificationHandler`** — Muestra notificación en foreground

### Mitigaciones NO implementadas

1. **No hay instrucciones al usuario** para desactivar battery optimization en OEMs agresivos
2. **No hay verificación** de si el dispositivo tiene restricciones activas
3. **No hay fallback** a notificaciones in-app si el SO bloquea las push
4. **No se usa `setNotificationChannelAsync` con `lockscreenVisibility: PUBLIC`** — las notificaciones pueden no aparecer en lockscreen en algunos OEMs

---

## 17. Resumen de Hallazgos de Infraestructura

### Críticos

| # | Hallazgo | Impacto |
|---|----------|---------|
| I-1 | `Promise.all` en reconciler ejecuta cancels y schedules en paralelo | Race condition teórica (microsegundos en la práctica) |
| I-2 | Sin manejo de errores en `scheduleNotificationAsync` | Si 1 notificación falla, todas las del batch se pierden y los cancels ya ejecutados dejan un estado inconsistente |
| I-3 | `channelId` duplicado en content y trigger | Redundancia menor, no causa error |

### Altos

| # | Hallazgo | Impacto |
|---|----------|---------|
| I-4 | Handler de foreground en legacy `notificationService.ts` | Si se elimina el legacy, se pierde el handler y las notificaciones en foreground dejan de mostrarse |
| I-5 | No hay instrucciones para OEMs agresivos | En Xiaomi/Samsung/Huawei, los usuarios pueden no recibir notificaciones sin saber por qué |
| I-6 | `TIME_INTERVAL` sin `repeats` | Cada notificación es one-shot. Si el engine no corre a tiempo (app killed + sin sync), se pierde la notificación |

### Medios

| # | Hallazgo | Impacto |
|---|----------|---------|
| I-7 | No se verifica `POST_NOTIFICATIONS` permission en runtime | En Android 13+ si el usuario deniega, no hay feedback claro |
| I-8 | **`setupChannels()` NUNCA se llama en producción** | CRÍTICO: El canal 'reminders' con importance: HIGH no existe en Android. Todas las notificaciones caen al canal default con importance: DEFAULT → sin sonido, sin heads-up, sin vibración. Solo se llama en tests mock. `ExpoNotificationProvider` se crea en la factory pero nadie invoca sus métodos de inicialización. |
| I-8b | **`requestPermissions()` NUNCA se llama en producción** | El engine nunca solicita permiso `POST_NOTIFICATIONS`. Si el usuario no lo concedió explícitamente (Settings de Android), las notificaciones se silenciosamente descartan. |
| I-8c | **`setNotificationHandler()` del legacy nunca se ejecuta** | `notificationService.ts` solo es importado por `useNotifications.ts` (nunca importado). El handler foreground (línea 189) nunca se registra. Las notificaciones en primer plano del Engine no tienen handler — Expo las muestra con comportamiento default pero no hay lógica de respuesta. |
| I-9 | No hay `lockscreenVisibility: PUBLIC` en el canal | Las notificaciones pueden no aparecer en lockscreen |

### Bajos

| # | Hallazgo | Impacto |
|---|----------|---------|
| I-10 | Badge count es binario (`1` o `undefined`) | No refleja el número real de notificaciones pendientes |
| I-11 | `progress` channel tiene `importance: LOW` | Las notificaciones de progreso pueden no ser visibles en el panel de notificaciones |
| I-12 | `cancelAll(prefix)` hace `getAll()` + filter + cancel individual | Ineficiente comparado con `cancelAllScheduledNotificationsAsync()` |

---

## 18. Diagnóstico Final: Por qué solo funcionan notificaciones en foreground

### Lo que está demostrado

| Hallazgo | Evidencia | Certeza |
|----------|-----------|---------|
| `setupChannels()` nunca se ejecuta | Búsqueda de código: 0 llamadas en producción, solo en tests mock | **100%** |
| `requestPermissions()` nunca se ejecuta | Búsqueda de código: 0 llamadas en producción | **100%** |
| `setNotificationHandler()` del legacy nunca se ejecuta | `notificationService.ts` solo importado por `useNotifications.ts`, nunca importado | **100%** |
| El ReminderEngine asume éxito sin verificar | `NotificationReconciler` no tiene try-catch, no verifica resultado de `scheduleNotificationAsync` | **100%** |
| El usuario no tiene feedback de fallo | No hay telemetría, no hay pantalla de diagnóstico, no hay logs | **100%** |

### Lo que es una hipótesis fuerte (no confirmada)

| Hipótesis | Por qué no está confirmada | Cómo confirmarla |
|-----------|---------------------------|------------------|
| "Android ignora silenciosamente cuando el canal no existe" | El comportamiento depende de: versión de Android, versión de Expo, implementación interna de `expo-notifications`. En algunos casos falla el schedule, en otros crea canal automáticamente, en otros usa default, en otros devuelve error | Corregir `setupChannels()`, programar notificación para 2 min, cerrar app, verificar si llega |
| "Expo crea un canal 'default' automáticamente" | Puede ocurrir, pero no está documentado como comportamiento garantizado | Verificar con `adb shell dumpsys notification` después de schedule sin canal explícito |
| "TIME_INTERVAL causa churn en alarmas" | Teóricamente sólido pero no medido en Threshold | Instrumentar y comparar con DATE trigger |

### Cadena de fallo (versión precisa)

```
Usuario crea assessment
  → Engine calcula trigger DATE (correcto)
  → SequenceFactory genera Date object
  → NotificationReconciler recibe snapshot
  → Compara con scheduled: "1 notificación nueva"
  → ExpoNotificationProvider.schedule() ejecuta:
    → scheduleNotificationAsync({ trigger: { seconds: 1799 }, channelId: 'reminders' })
    → Canal 'reminders' no fue creado por setupChannels() (nunca se llamó)
    → Comportamiento depende de Android/Expo/version → NO CONFIRMADO
    → Expo retorna identifier (o falla silenciosamente)
    → Reconciler: asume éxito (no hay try-catch)
  → App entra background
  → El resultado es impredecible porque faltan canal + permisos + trigger absoluto
```

### Fix plan — 4 fases (orden revisado)

**Fase 1 — Inicialización (sin cambiar comportamiento)**
- `setupChannels()` antes de cualquier schedule
- `requestPermissions()` durante bootstrap
- Registrar `setNotificationHandler()` para foreground
- **Criterio de salida**: los 3 métodos se ejecutan al menos una vez durante arranque

**Fase 2 — Observabilidad (antes de cambiar anything)**
- Cada `schedule` registra: ID, tipo, fecha objetivo, trigger enviado, resultado, identifier Expo, canal, permisos, hora actual
- Cada `cancel` registra: identifier, resultado
- Pantalla de diagnóstico: canal, permisos, notificaciones registradas, última reconciliación, último error
- **Criterio de salida**: al ejecutar una notificación de prueba, todos los campos aparecen en diagnóstico

**Fase 3 — Migrar trigger (con evidencia)**
- TIME_INTERVAL → DATE
- Comparar comportamiento antes/después con la instrumentación de Fase 2
- **Criterio de salida**: notificación de prueba llega exactamente a la hora prevista con app cerrada

**Fase 4 — Robustecer reconciler**
- Try-catch individual en cada `scheduleNotificationAsync`
- Cancel→schedule secuencial (no `Promise.all`)
- Retry con backoff en fallos
- Métricas integradas en el sistema de diagnóstico
- **Criterio de salida**: un fallo de schedule no deja estado inconsistente

### Componente propuesto: Notification Diagnostics

```
Reminder Engine
  ↓
Notification Provider
  ↓
Notification Diagnostics
```

Estado mantenido:
- Último schedule ( timestamp + resultado )
- Último cancel ( timestamp + resultado )
- Último error ( timestamp + detalle )
- Último permission check ( timestamp + granted )
- Canales existentes ( channelId + importance )
- Notificaciones registradas ( count + lista )
- Última reconciliación ( timestamp + stats )
- Último resync ( timestamp + duration )

Pantalla de diagnóstico:
```
Canal reminders     ✓ / ✗
Permisos            ✓ / ✗
Notificaciones      18
Última reconciliación  07:31:15
Último error         none
```

### Prueba empírica para confirmar o descartar el diagnóstico

1. Corregir únicamente `setupChannels()` y `requestPermissions()`
2. Crear una notificación para dentro de 2 minutos
3. Cerrar completamente la aplicación
4. Bloquear el teléfono
5. Verificar si llega exactamente a la hora prevista

Si llega de forma fiable → el problema principal era la inicialización.
Si sigue fallando → el siguiente sospechoso es TIME_INTERVAL, y ahí migrar a DATE trigger.
