# Reminder Settings — Design Brief

**Estado**: Design brief. No implementado.
**Precede a**: Sprint de producto para reemplazar los 3 toggles legacy por la UI del Reminder System v1.0.
**Dependencias**: Reminder System v1.0 (✅ estable), `notificationService.ts` legacy (por eliminar).

---

## 1. Objetivo

Reemplazar la configuración legacy de notificaciones (`settings.tsx`: 3 toggles, AsyncStorage, `notificationService.ts`) por una UI que refleje las capacidades del Reminder System v1.0 sin exponer su implementación interna.

La UI debe responder preguntas de usuario, no preguntas de arquitectura:
- ¿Funcionan mis recordatorios?
- ¿Tengo permisos?
- ¿Con cuánta anticipación quiero que me avisen?
- ¿Quiero que sean discretos o insistentes?
- ¿Cuáles tengo programados ahora mismo?

## 2. Principios

1. **La UI configura el comportamiento del Reminder System, no su implementación.** La pantalla no expone `PolicyRegistry`, `offsets`, `SequenceFactory`, `NotificationProvider` ni ningún concepto interno del Engine.
2. **El Engine permanece inalterado.** Todo cambio ocurre en la capa de UI y en el modelo de datos de preferencias. El Coordinator lee la configuración desde el store y la pasa al Engine como parámetros de perfil.
3. **Las preferencias pertenecen al usuario y son sincronizables.** No son config locales del dispositivo. Se persisten en una tabla `reminder_settings` sincronizable (Local-First), no en AsyncStorage.
4. **Weekly Digest es un subsistema independiente.** El Reminder Engine no genera digests semanales. El digest es un schedule fijo recurrente que no comparte la lógica de políticas por entidad. Se mueve a una sección "Productividad".

## 3. Arquitectura

```
Settings UI
    │
    ▼
DataStore (reminder_settings table)
    │
    ├─ SQLite (local)
    └─ Sync Engine (multi-dispositivo)
    │
    ▼
ReminderCoordinator.initialize()
    │
    ├─ Lee reminder_settings del store
    ├─ Construye ReminderProfile desde la config
    └─ engine.initialize(snapshot, profiles)
         │
         ▼
    Pipeline existente (sin cambios)
```

**Pantalla "Recordatorios activos"**:
```
provider.getAll() → ScheduledNotificationInfo[]
    │
    ▼
Lista agrupada por fecha con acciones:
    └─ Ver recurso (via NavigationContract: parseDeeplink + getTargetRoute)
    └─ Cancelar (via provider.cancel(id))
```

## 4. Modelo de Datos

### Tabla `reminder_settings`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `user_id` | TEXT (FK) | Dueño de la configuración |
| `entity_type` | TEXT | `'assessment'`, `'schedule'`, `'flashcard_deck'`, `'calendar_event'`, `'grading_period'` |
| `enabled` | INTEGER (0/1) | ¿Recordatorios habilitados para este tipo? |
| `profile_name` | TEXT | `'minimal'`, `'standard'`, `'persistent'`, `'custom'` |
| `custom_offsets` | TEXT (JSON) | Opcional. Solo cuando `profile_name = 'custom'`. Ej: `[-10080, -1440, -60]` |
| `sync_version` | INTEGER | Protocolo de sincronización |
| `deleted_at` | TEXT | Soft delete |

La tabla es sincronizable (participa en initial sync, delta sync, push). Los campos `sync_version` y `deleted_at` siguen el protocolo Sync v1.0.

### Valores por defecto (sin configuración → comportamiento actual del Engine)

```ts
const DEFAULT_SETTINGS: ReminderSetting[] = [
  { entity_type: 'assessment',      enabled: true, profile_name: 'standard' },
  { entity_type: 'schedule',        enabled: true, profile_name: 'standard' },
  { entity_type: 'flashcard_deck',  enabled: true, profile_name: 'standard' },
  { entity_type: 'calendar_event',  enabled: true, profile_name: 'standard' },
  { entity_type: 'grading_period',  enabled: true, profile_name: 'standard' },
];
```

## 5. Pantallas

### 5.1 Pantalla Principal: Recordatorios

La pantalla principal dentro de Settings. No existe una pantalla Health separada — el estado del sistema se muestra como un card integrado.

```
┌────────────────────────────────────────────┐
│ Recordatorios                              │
├────────────────────────────────────────────┤
│                                            │
│ 🟢 Activos                                 │
│ 37 recordatorios programados               │
│                                            │
│ Perfil global                              │
│ [ Estándar ▼ ]                             │
│                                            │
│ Personalizar recordatorios        >         │
│                                            │
│ Ver recordatorios activos         >         │
│                                            │
└────────────────────────────────────────────┘
```

**Estado del sistema (card)**:
- 🟢 Activo: permisos OK + Engine inicializado → muestra conteo de `provider.getAll().length`
- 🟡 Permisos denegados: `Notifications.getPermissionsAsync()` false → "Threshold necesita permiso para mostrar recordatorios" + botón "Abrir Ajustes"
- 🔴 Error: Engine no inicializado → "Reiniciar" (re-inicializa Coordinator)

**Perfil global**: dropdown con los 4 perfiles. Cambiar el perfil actualiza `reminder_settings` y reinicializa el Engine vía Coordinator.

**Datos de origen**: `Notifications.getPermissionsAsync()`, `provider.getAll().length`, `engine.getTraceLog()`.

### 5.2 Personalizar por Categoría

```
┌────────────────────────────────────────────┐
│ Personalizar recordatorios                 │
├────────────────────────────────────────────┤
│                                            │
│ Evaluaciones                  Estándar  >  │
│ Horarios                      Estándar  >  │
│ Flashcards                    Estándar  >  │
│ Eventos                       Estándar  >  │
│ Períodos académicos           Estándar  >  │
│                                            │
└────────────────────────────────────────────┘
```

Cada fila muestra el perfil activo para esa categoría. Tap navega al detalle de la categoría.

### 5.3 Detalle de Categoría

```
┌────────────────────────────────────────────┐
│ Evaluaciones                               │
├────────────────────────────────────────────┤
│                                            │
│ Perfil                                     │
│                                            │
│ ○ Mínimo                                   │
│ ● Estándar                                 │
│ ○ Persistente                              │
│ ○ Personalizado                            │
│                                            │
│ Restablecer al perfil global               │
│                                            │
└────────────────────────────────────────────┘
```

Solo si el usuario elige "Personalizado" aparecen los offsets como checkboxes:

```
┌────────────────────────────────────────────┐
│ Evaluaciones                               │
├────────────────────────────────────────────┤
│                                            │
│ Perfil                                     │
│ ● Personalizado                            │
│                                            │
│ Avisar                                     │
│ ☑ 7 días antes                             │
│ ☑ 1 día antes                              │
│ ☑ 2 horas antes                            │
│                                            │
│ Restablecer                                │
│                                            │
└────────────────────────────────────────────┘
```

**Regla**: los offsets no son editables como números. Son checkboxes que activan/desactivan los offsets predefinidos por la Policy. El Engine conserva el control sobre las secuencias válidas — la UI solo elige cuáles aplicar.

**Si el usuario cambia el perfil global**: las categorías con perfil no personalizado heredan automáticamente. Las categorías en modo Personalizado mantienen su configuración independiente.

### 5.4 Recordatorios Activos

Pantalla separada, accesible desde "Ver recordatorios activos >".

```
┌────────────────────────────────────────────┐
│ Recordatorios activos (37)                 │
├────────────────────────────────────────────┤
│                                            │
│ Hoy                                        │
│ 📘 Álgebra                                 │
│   Parcial                                  │
│   8:00 AM                                  │
│                                            │
│────────────────────────────────────────────│
│                                            │
│ 🧠 Química                                 │
│   20 tarjetas pendientes                   │
│   7:00 PM                                  │
│                                            │
│────────────────────────────────────────────│
│                                            │
│ 📅 Laboratorio Física                      │
│   Lunes 6:30 AM                            │
│                                            │
└────────────────────────────────────────────┘
```

**Datos**: `provider.getAll()` agrupado por fecha, ordenado por `triggerDate`.
**Acción al tap**: `parseDeeplink(deeplink)` → `router.push(targetRoute, { entityId })`.
**Acciones secundarias**: swipe para cancelar (`provider.cancel(id)`).

### 5.5 Productividad (Weekly Digest)

Independiente del Reminder Engine. Sección separada en Settings (no dentro de Recordatorios).

```
┌────────────────────────────────────────────┐
│ Productividad                              │
├────────────────────────────────────────────┤
│                                            │
│ Resumen semanal                            │
│ ○ Desactivado                              │
│                                            │
│ (Disponible próximamente)                  │
│                                            │
└────────────────────────────────────────────┘
```

Cuando exista implementación real, se reemplaza el placeholder por la configuración del digest.

## 6. Sprint P1 — Alcance del Primer Sprint de Producto

### 6.1 Qué se construye

| Pantalla | Comportamiento |
|----------|----------------|
| Recordatorios (Settings) | Card de estado + perfil global dropdown + enlaces a subpantallas |
| Personalizar recordatorios | Lista de 5 categorías con perfil activo |
| Detalle de categoría | Selector de perfil (radio buttons). Offsets como checkboxes si es Personalizado |
| Recordatorios activos | Lista agrupada por fecha desde `provider.getAll()` |
| Productividad | Placeholder "Disponible próximamente" para el digest |

### 6.2 Qué se elimina

De `settings.tsx`:
- `notifDeadline` toggle + handler ← se reemplaza por perfil global + personalización por categoría
- `notifWeekly` toggle + `WeeklySummaryPicker` ← se mueve a Productividad (placeholder)
- `notifEmail` toggle ← se elimina (era cosmético, sin implementación real)

Se eliminan también las dependencias muertas:
- `cancelAllDeadlineNotifications()`, `scheduleWeeklyDigest()`, `cancelWeeklyDigest()` de `notificationService.ts`
- `WeeklyDigestConfig` type (si no se usa fuera de los toggles eliminados)

### 6.3 Migración de AsyncStorage → SQLite (reminder_settings)

Una sola vez, al abrir la nueva UI:

```ts
async function migrateLegacySettings(): Promise<void> {
  const deadline = await AsyncStorage.getItem('notif_deadline');
  if (deadline !== null) {
    // Única escritura legacy → SQLite
    await upsertSetting({ entity_type: 'assessment', enabled: 1, profile_name: 'standard' });
    await upsertSetting({ entity_type: 'schedule', enabled: 1, profile_name: 'standard' });
    await upsertSetting({ entity_type: 'flashcard_deck', enabled: 1, profile_name: 'standard' });
    await upsertSetting({ entity_type: 'calendar_event', enabled: 1, profile_name: 'standard' });
    await upsertSetting({ entity_type: 'grading_period', enabled: 1, profile_name: 'standard' });
  }
  await AsyncStorage.multiRemove(['notif_deadline', 'notif_weekly', 'weekly_config', 'notif_email']);
}
```

### 6.4 Sin compatibilidad retroactiva

No se mantienen los toggles legacy durante la transición. La migración ocurre en un único commit:
1. Se eliminan los 3 toggles de `settings.tsx`
2. Se agrega la nueva UI de Recordatorios
3. Se ejecuta `migrateLegacySettings()` una vez
4. Si el usuario nunca usó los toggles legacy, se usan defaults (todos standard, habilitados)

Riesgo mínimo: los toggles legacy solo existían en Settings. No hay consumidores externos.

## 7. Fuera de Alcance (Sprint P1)

| Qué | Por qué |
|-----|---------|
| Cambios en `ReminderEngine` | El Engine está frozen. Lee perfiles desde el Coordinator. |
| Cambios en `NotificationProvider` | Ya expone `getAll()` y `cancel()`. Suficiente para la UI. |
| Cambios en `PolicyRegistry` | Las policies son fijas. La UI solo selecciona perfiles. |
| Nuevas políticas (AssignmentPolicy, etc.) | Son evolución funcional futura, no parte de este sprint. |
| Snooze global | Existe solo para flashcards. Extenderlo a todos los tipos es producto separado. |
| Edición numérica de offsets | Los offsets se activan/desactivan como checkboxes predefinidos. No se escriben números. |
| Weekly Digest funcional | Se deja como placeholder hasta que exista implementación real. |

## 8. Criterios de Aceptación (Sprint P1)

- Los 3 toggles legacy desaparecen de Settings.
- Card de estado muestra estado actual del sistema (🟢/🟡/🔴).
- Usuario puede seleccionar perfil global (Mínimo/Estándar/Persistente/Personalizado).
- Usuario puede navegar a Personalizar recordatorios y ver las 5 categorías.
- Usuario puede cambiar el perfil por categoría (hereda del global si no es Personalizado).
- En modo Personalizado, los offsets se muestran como checkboxes predefinidos.
- Usuario puede ver lista de recordatorios programados desde `provider.getAll()`.
- Tap en un recordatorio navega al recurso vía `NavigationContract`.
- Usuario puede cancelar un recordatorio desde la lista.
- Weekly Digest movido a Productividad con placeholder.
- **No se modifica ni una línea del Reminder Engine, NotificationProvider, ni las policies.**
- **La migración es atómica**: los toggles legacy se eliminan en el mismo commit. No hay compatibilidad retroactiva.

## 9. Estados del Sistema (Health)

| Estado | Condición | Acción para el usuario |
|--------|-----------|------------------------|
| 🟢 Activo | Permisos OK + Engine inicializado + provider.getAll() > 0 | Ver lista de recordatorios |
| 🟡 Permisos denegados | Permisos OS denied | Botón "Abrir Ajustes" → OS settings |
| 🟡 Sin programados | Todo OK pero provider.getAll() = 0 | "No hay recordatorios programados" |
| 🔴 Error de inicialización | Engine.initialize() falló o no se llamó | "Reiniciar" → re-inicializa Coordinator |
| ⚪ No configurado | Usuario nunca abrió la sección | Usa defaults (todos standard, habilitados) |

---

## 10. Principios que no deben romperse

Reglas de diseño vinculantes para cualquier iteración futura de esta UI. No son recomendaciones técnicas — son decisiones de producto que protegen la separación entre el subsistema y su interfaz de usuario.

1. **Las preferencias modifican el comportamiento del Reminder System sin alterar su arquitectura.** Ningún cambio en la UI justifica modificar el Engine, el Provider, el Registry ni las Policies. Si un requisito de producto no puede implementarse sin tocar el núcleo, primero se cuestiona el requisito.

2. **El Reminder Engine permanece ajeno a la UI y al mecanismo de persistencia de preferencias.** El Engine recibe perfiles ya resueltos desde el Coordinator. No sabe si vienen de SQLite, MMKV, AsyncStorage ni de una API remota.

3. **Toda preferencia relevante para el usuario es sincronizable entre dispositivos.** `reminder_settings` participa en el protocolo Sync v1.0. No se almacenan en AsyncStorage preferencias que afecten al comportamiento del sistema de recordatorios.

4. **Las pantallas representan conceptos de producto, no conceptos internos del Engine.** La UI habla de perfiles (Mínimo, Estándar, Persistente), no de políticas, offsets, ni secuencias. El mapeo entre concepto de producto y parámetro del Engine ocurre en el Coordinator, no en la UI.

5. **Los cambios de configuración se aplican a través del ReminderCoordinator y se reflejan tras la sincronización correspondiente.** No se introducen canales paralelos que modifiquen el comportamiento del Engine sin pasar por el Coordinator.

6. **El Weekly Digest no se modela como un reminder de entidad.** Es un schedule recurrente fijo. Su implementación no comparte el Pipeline del Engine ni sus Policies.

7. **La UI de recordatorios no expone el estado interno del Engine.** `EngineTraceEntry`, `desiredSequences`, `planId`, `version` y cualquier otro concepto de trazabilidad interna no se muestran al usuario. La observabilidad es para desarrollo, no para producto.

---

*Este documento no prescribe implementación. Define el comportamiento esperado, las fuentes de datos y las reglas de negocio que la UI debe cumplir. La implementación concreta (componentes, estilos, animaciones) pertenece al sprint de producto.*
