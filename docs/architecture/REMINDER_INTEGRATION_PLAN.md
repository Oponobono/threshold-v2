# Reminder Integration Plan v1.0

**Estado**: ✅ Completo — el Reminder System v1.0 está estable. Este documento describe la integración existente y queda como referencia histórica.

---

## 1. Arquitectura de Integración

```
Frontend (UI, Hooks) → DataStore / Sync
                              │
                              ▼
                        Domain Events
                              │
                              ▼
                    ┌──────────────────────┐
                    │ ReminderCoordinator   │ ← Único punto de integración
                    │ (adaptador)           │
                    └──────────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │    ReminderEngine     │ ← Core frozen, sin cambios
                    └──────────────────────┘
```

**Regla**: El frontend nunca habla directamente con el Engine. Solo el Coordinator conoce DataStore, EventBus y Engine simultáneamente.

---

## 2. Fuentes de Datos (EntitySnapshot)

Cada repositorio provee entidades para el snapshot que consume `engine.initialize()`:

| Repositorio | EntityType | Campos usados por Policy |
|---|---|---|
| `AssessmentRepository` | `assessment` | `id`, `date`, `status` |
| `ScheduleRepository` | `schedule` | `id`, `endTime`, `status` |
| `FlashcardDeckRepository` | `flashcard_deck` | `id`, `dueCardsCount`, `status` |
| `GradingPeriodRepository` | `grading_period` | `id`, `closeDate`, `status` |
| `CalendarRepository` | `calendar_event` | `id`, `endDate`, `status` |

**Estado**: ✅ `ReminderSnapshotBuilder` existe y está integrado en `ReminderCoordinator`.

---

## 3. Ciclo de Vida

### Bootstrap (después de READY)

```
BootstrapManager (fase READY)
    │
    ├─ repos → ReminderSnapshotBuilder.build()
    │
    └─ coordinator.initialize(snapshot)
         │
         ├─ engine.initialize(snapshot)
         └─ engine.getTraceLog() → log
```

- **No antes de READY**. El Engine necesita datos del store, igual que el Dashboard.
- **Después de Initial Sync**: llamar `initialize()` de nuevo con snapshot fresco.
- **Después de Delta Sync**: propagar eventos individuales vía `onEntityChanged()` / `onEntityDeleted()`.

### Logout

```
Logout
    │
    ├─ coordinator.stop()
    │    ├─ engine.destroy()
    │    └─ provider.cancelAll()
    │
    └─ DataStore.clear()
```

### Login

```
Login → Bootstrap → coordinator.initialize(snapshot)
```

---

## 4. Eventos del Dominio

Cada mutación en repositorios debe propagarse al Coordinator:

| Evento de Dominio | Traducción Coordinator |
|---|---|
| `assessment.created` / `assessment.updated` | `engine.onEntityChanged('assessment', id, entity)` |
| `assessment.deleted` | `engine.onEntityDeleted('assessment', id)` |
| `schedule.created` / `schedule.updated` | `engine.onEntityChanged('schedule', id, entity)` |
| `schedule.deleted` | `engine.onEntityDeleted('schedule', id)` |
| `flashcard_deck.created` / `flashcard_deck.updated` | `engine.onEntityChanged('flashcard_deck', id, entity)` |
| `flashcard_deck.deleted` | `engine.onEntityDeleted('flashcard_deck', id)` |
| `grading_period.created` / `grading_period.updated` | `engine.onEntityChanged('grading_period', id, entity)` |
| `grading_period.deleted` | `engine.onEntityDeleted('grading_period', id)` |
| `calendar_event.created` / `calendar_event.updated` | `engine.onEntityChanged('calendar_event', id, entity)` |
| `calendar_event.deleted` | `engine.onEntityDeleted('calendar_event', id)` |
| `review.completed` | `engine.onActionCompleted('flashcard_deck', deckId)` |
| `exam.completed` | `engine.onActionCompleted('assessment', id)` |

---

## 5. Permisos

- `NotificationProvider.requestPermissions()` en Bootstrap (después de READY).
- Si el usuario revoca permisos: `coordinator.onPermissionRevoked()` → detener Engine (no reintentar).
- Banner en Settings → Notificaciones si permisos denegados.

---

## 6. Puntos de No-Integración (lo que NO debe ocurrir)

- ❌ La UI NO importa `ReminderEngine` directamente.
- ❌ Los repositorios NO llaman al Engine.
- ❌ El Engine NO se convierte en fuente de estado para la UI.
- ❌ NO hay `useReminderEngine()` hooks en pantallas.
- ❌ NO hay `engine.initialize()` después de cada mutación individual.
- ❌ NO se crean notificaciones para el usuario anterior tras logout.

---

## 7. Contrato de Navegación (NavigationContract)

La integración entre el ReminderEngine y la navegación de la app está definida explícitamente en `mobile/src/services/reminders/NavigationContract.ts`:

```
TemplateResolver → NotificationProvider → Expo → _layout.tsx handler
     │                    │                         │
     └─ deeplink ─────────┘                         │
              data.deeplink = "threshold://assessments/{id}" ──┘
                                                     │
                                              parseDeeplink()
                                                   │
                                          getTargetRoute(entityType)
                                                   │
                                          router.push(route, { entityId, entityType })
```

**Regla**: el handler de `_layout.tsx` lee `data.deeplink` primero. Si el formato no es válido o no existe, cae a legacy `data.type` (`deadline`, `duedeck`, `urgent_review`, `class`, `weekly_digest`). Esto mantiene compatibilidad con notificaciones del sistema anterior (`notificationService.ts`).

**Estabilidad**: 15 tests cubren parseDeeplink (5 entity types, edge cases, query params, formato inválido) y getTargetRoute (mapeo correcto por tipo).

---

## 8. Checklist de Integración

### Fuentes de datos
- [x] `ReminderSnapshotBuilder` — orquesta repos → `EntitySnapshot`
- [x] Mapping entity → `{ id, date/endTime/dueDate/closeDate, status }` por tipo

### Eventos
- [x] Coordinator suscrito a EventBus
- [x] Cada evento de mutación traducido a llamada Engine
- [x] `onActionCompleted` conectado desde review/exam completion flows

### Bootstrap
- [x] `coordinator.initialize()` llamado después de READY
- [x] `initialize()` repetido tras Initial Sync
- [x] Eventos individuales tras Delta Sync

### Shutdown
- [x] `coordinator.destroy()` en logout
- [x] `provider.cancelAll()` en logout
- [x] No notificaciones huérfanas tras cambio de usuario

### Permisos
- [x] `requestPermissions()` en Bootstrap
- [ ] Manejo de revocación de permisos *(producto)*
- [ ] Banner en Settings *(producto)*

### Deep Links (NavigationContract)
- [x] TemplateResolver genera deeplink por entityType
- [x] NotificationProvider incluye deeplink en data del trigger
- [x] `parseDeeplink()` extrae entityType + entityId
- [x] `getTargetRoute()` mapea a ruta Expo Router
- [x] Handler en `_layout.tsx` lee `data.deeplink` primero, fallback legacy
- [ ] Pantallas destino consumen `entityId` de params *(producto)*

### Testing
- [x] Smoke: Bootstrap + snapshot → notificaciones programadas
- [x] CRUD: crear/editar/eliminar assessment → notif actualizadas
- [x] Logout/Login: sin notif del usuario anterior
- [x] Permisos denegados: Engine no falla
- [x] 500 entidades en snapshot → initialize() < 200ms
- [x] 24 suites, 290 tests, 0 failures
- [x] CI gate: regression suite + full suite en PRs contra reminders/**
