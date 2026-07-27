# Notification Architecture — Threshold

> Evidencia histórica: `docs/audits/REMINDER_NOTIFICATION.md` (926 líneas, auditoría completa de dominio + infraestructura, Jul 2026).

---

## 1. Diagrama de Componentes

```
ReminderEngine
  ↓
NotificationScheduler          ← interfaz intermedia (nuevo)
  ↓
ExpoNotificationProvider       ← implementación concreta
  ↓
NotificationDiagnosticsService ← observabilidad desacoplada (nuevo)
  ↓
expo-notifications
```

### Por qué NotificationScheduler

El Reminder Engine no debería saber que existe Expo. Él solo dice: "Programa este recordatorio." El Scheduler decide la implementación:

| Backend | Cuándo |
|---------|--------|
| `ExpoNotificationProvider` | Producción actual |
| `NotificationSchedulerMock` | Tests unitarios |
| `AlarmManager nativo` | Futuro si se sale de Expo |
| `Push notification` | Futuro si hay backend push |

```typescript
interface NotificationScheduler {
  schedule(reminder: ScheduledReminder): Promise<string>;
  cancel(identifier: string): Promise<void>;
  cancelAll(prefix: string): Promise<void>;
  getAll(): Promise<ScheduledNotification[]>;
  setupChannels(): Promise<void>;
  requestPermissions(): Promise<boolean>;
  setForegroundHandler(handler: NotificationHandler): void;
}
```

`ExpoNotificationProvider` implementa esta interfaz. El Engine depende de `NotificationScheduler`, no de `ExpoNotificationProvider`.

---

## 2. Criterios de Éxito

Una implementación se considera correcta cuando:

| # | Criterio | Cómo verificar |
|---|----------|----------------|
| S1 | La aplicación solicita permisos exactamente una vez durante onboarding o bootstrap | `requestPermissions()` se ejecuta 1 vez; resultado registrado en Diagnostics |
| S2 | El canal "reminders" existe antes de programar la primera notificación | `setupChannels()` ejecutado antes de cualquier `schedule()`; Diagnostics confirma canal |
| S3 | Una notificación programada para 2 minutos llega con app abierta | Prueba manual: crear assessment con offset -2min, no tocar teléfono |
| S4 | Una notificación programada para 2 minutos llega con app en background | Prueba manual: crear assessment, pulsar Home, esperar |
| S5 | Una notificación programada para 2 minutos llega con app cerrada | Prueba manual: crear assessment, force-stop, esperar |
| S6 | Una notificación programada para 24 horas permanece registrada tras reiniciar teléfono | Programar, reiniciar, verificar con `getAllScheduledNotificationsAsync()` |
| S7 | Modificar la fecha de un reminder cancela únicamente la afectada y programa la nueva | Cambiar fecha de assessment, verificar en Diagnostics: 1 cancel, 1 schedule |
| S8 | El sistema de diagnóstico refleja exactamente el estado del SO | Comparar Diagnostics vs `adb shell dumpsys notification` |
| S9 | Un fallo de schedule no deja estado inconsistente | Simular error, verificar que la notificación anterior no se canceló |

---

## 3. Matriz de Pruebas

| Escenario | Esperado | Fase |
|-----------|----------|------|
| App abierta, notificación para 2min | Llega con sonido y banner | 1 |
| App background, notificación para 2min | Llega en notification tray | 1 |
| App cerrada (force-stop), notificación para 2min | Llega | 1 |
| Reboot del teléfono, notificación pendiente | Sigue programada, llega a tiempo | 1 |
| Cambio de hora (adelantar 1h) | Notificación se adelanta proporcionalmente | 3 |
| Cambio de zona horaria | Próxima notificación recalcula correctamente | 3 |
| Permiso denegado | Diagnostics muestra ✗, schedule falla con error registrado | 2 |
| Canal inexistente | Diagnostics detecta y reporta | 2 |
| battery saver agresivo (Xiaomi) | Comportamiento documentado, usuario instruido | Post-4 |
| 5+ notificaciones simultáneas | Se entregan las 5 (no limitado a 3) | Post-4 |
| Schedule falla → reconciler | Notificación anterior NO se cancela | 4 |
| Resync rápido (2 en 1s) | No duplica ni pierde notificaciones | Post-4 |

---

## 4. NotificationDiagnosticsService

### Interface

```typescript
interface NotificationDiagnosticsService {
  // Logging
  logSchedule(entry: ScheduleLogEntry): void;
  logCancel(entry: CancelLogEntry): void;
  logPermissionCheck(granted: boolean): void;
  logChannelCheck(channelId: string, exists: boolean): void;
  logDelivery(notificationId: string): void;
  logError(context: string, error: Error): void;

  // Lectura
  getState(): DiagnosticsState;
  getRecentLogs(limit: number): LogEntry[];

  // Export
  exportDiagnostics(): Promise<DiagnosticsExport>;
}
```

### Tipos

```typescript
interface ScheduleLogEntry {
  notificationId: string;
  entityType: string;
  entityId: string;
  targetDate: Date;
  triggerType: 'TIME_INTERVAL' | 'DATE';
  triggerValue: number;
  channelId: string;
  permissionsGranted: boolean;
  result: 'OK' | 'FAILED';
  expoIdentifier?: string;
  error?: string;
  timestamp: Date;
}

interface CancelLogEntry {
  identifier: string;
  result: 'OK' | 'FAILED';
  reason: 'reconciler' | 'action_completed' | 'entity_deleted' | 'expired';
  timestamp: Date;
}

interface DiagnosticsState {
  channels: ChannelInfo[];
  permissions: { granted: boolean; lastChecked: Date };
  scheduledCount: number;
  lastSchedule: ScheduleLogEntry | null;
  lastCancel: CancelLogEntry | null;
  lastPermissionCheck: Date | null;
  lastReconciliation: { timestamp: Date; scheduled: number; cancelled: number } | null;
  lastError: { context: string; message: string; timestamp: Date } | null;
}
```

### Implementación

```typescript
class InMemoryNotificationDiagnostics implements NotificationDiagnosticsService {
  private logs: LogEntry[] = [];
  private state: DiagnosticsState = { /* defaults */ };

  logSchedule(entry: ScheduleLogEntry): void {
    this.logs.push({ type: 'schedule', ...entry });
    this.state.lastSchedule = entry;
  }

  logCancel(entry: CancelLogEntry): void {
    this.logs.push({ type: 'cancel', ...entry });
    this.state.lastCancel = entry;
  }

  logPermissionCheck(granted: boolean): void {
    this.state.permissions = { granted, lastChecked: new Date() };
    this.state.lastPermissionCheck = new Date();
  }

  logChannelCheck(channelId: string, exists: boolean): void {
    const idx = this.state.channels.findIndex(c => c.id === channelId);
    if (idx >= 0) this.state.channels[idx] = { id: channelId, exists };
    else this.state.channels.push({ id: channelId, exists });
  }

  logDelivery(notificationId: string): void {
    this.logs.push({ type: 'delivery', notificationId, timestamp: new Date() });
  }

  logError(context: string, error: Error): void {
    this.state.lastError = { context, message: error.message, timestamp: new Date() };
    this.logs.push({ type: 'error', context, message: error.message, timestamp: new Date() });
  }

  getState(): DiagnosticsState { return { ...this.state }; }
  getRecentLogs(limit: number): LogEntry[] { return this.logs.slice(-limit); }

  async exportDiagnostics(): Promise<DiagnosticsExport> {
    return {
      state: this.getState(),
      logs: this.logs,
      exportedAt: new Date(),
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version,
    };
  }
}
```

### Pantalla de Diagnóstico

```
╔══════════════════════════════════════╗
║  Notification Diagnostics            ║
╠══════════════════════════════════════╣
║  Canal reminders    ✓ / ✗           ║
║  Permisos           ✓ / ✗           ║
║  Notificaciones     18              ║
║  Último schedule    07:31:15 OK     ║
║  Último cancel      07:30:22 OK     ║
║  Último error       none            ║
║  Última reconciliación  07:31:15    ║
╠══════════════════════════════════════╣
║  [Export Diagnostics]               ║
╚══════════════════════════════════════╝
```

---

## 5. Plan de Implementación

### Fase 1 — Inicialización (sin cambiar comportamiento)

**Objetivo**: Los 3 métodos de inicialización se ejecutan durante arranque.

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| Crear `NotificationScheduler` interface | `NotificationScheduler.ts` | Interfaz con los 6 métodos |
| `ExpoNotificationProvider` implementa `NotificationScheduler` | `NotificationProvider.ts` | Agregar `implements NotificationScheduler` |
| `setupChannels()` en factory | `ReminderSystemFactory.ts` | Llamar antes de crear el engine |
| `requestPermissions()` en bootstrap | `BootstrapManager.ts` | En DB phase, antes de ReminderCoordinator.initialize() |
| `setForegroundHandler()` en factory | `ReminderSystemFactory.ts` | Registrar handler para notifications en foreground |
| Registrar handler desde el Engine | `ReminderEngine.ts` | Usar `provider.setForegroundHandler()` si existe |

**Criterio de salida**: Los 3 métodos se ejecutan al menos una vez durante arranque. Verificable con logs.

### Fase 2 — Observabilidad + Verificación

**Objetivo**: Tener evidencia antes de cambiar el trigger.

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| Crear `NotificationDiagnosticsService` | `NotificationDiagnostics.ts` | Servicio desacoplado con logging completo |
| Integrar en `ExpoNotificationProvider` | `NotificationProvider.ts` | Llamar a `diagnostics.logSchedule()` en cada schedule/cancel |
| Integrar en `NotificationReconciler` | `NotificationReconciler.ts` | Log de cada reconciliación |
| Integrar en `BootstrapManager` | `BootstrapManager.ts` | Log de permission check y channel check |
| Crear `DiagnosticsScreen` | `DiagnosticsScreen.tsx` | Pantalla de diagnóstico accesible desde Settings |
| Ejecutar prueba de 2 minutos | Manual | Verificar que todo llega con app cerrada |
| Ejecutar prueba de 24 horas | Manual | Verificar persistencia tras reboot |
| Guardar evidencia | Docs | Screenshot + logs del diagnóstico |

**Criterio de salida**:
- Al ejecutar notificación de prueba, todos los campos aparecen en Diagnostics
- Prueba de 2 minutos PASS con app cerrada
- Prueba de 24 horas PASS tras reboot
- Evidencia guardada en docs

**Solo entonces proceder a Fase 3.**

### Fase 3 — Migrar trigger

**Objetivo**: TIME_INTERVAL → DATE con evidencia de que la inicialización funciona.

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| Cambiar trigger a DATE | `NotificationProvider.ts` | `trigger: { type: DATE, date: triggerDate }` |
| Verificar comportamiento | Diagnostics | Comparar antes/después |
| Agregar `SCHEDULE_EXACT_ALARM` si necesario | `AndroidManifest.xml` | Solo si DATE trigger lo requiere |

**Criterio de salida**: Notificación de prueba llega exactamente a la hora prevista con app cerrada. Comparación con Fase 2 muestra mejora.

### Fase 4 — Robustecer reconciler

**Objetivo**: Manejo correcto de errores y concurrencia.

| Cambio | Archivo | Descripción |
|--------|---------|-------------|
| Try-catch individual | `NotificationReconciler.ts` | Cada schedule/cancel con try-catch propio |
| Cancel→schedule secuencial | `NotificationReconciler.ts` | Reemplazar `Promise.all` por secuencial |
| Retry con backoff | `NotificationReconciler.ts` | Reintentar schedules fallidos (1 retry, 1s delay) |
| Métricas en Diagnostics | `NotificationDiagnostics.ts` | Integrar métricas de reconciliación |
| Eliminar `Promise.all` paralelo | `NotificationReconciler.ts` | Secuencial: cancel todos → schedule todos |

**Criterio de salida**: Un fallo de schedule no deja estado inconsistente. Verificable con tests + Diagnostics.

---

## 6. Bugs de Dominio (orden de prioridad)

Estos bugs existen independientemente de la infraestructura. Se atienden después de Fase 4.

| # | Bug | Impacto | Esfuerzo |
|---|-----|---------|----------|
| D1 | `shouldCancel` nunca se invoca | Cancelación por status no funciona | Bajo |
| D2 | UI settings no conectados al engine | Perfil siempre es 'standard' | Medio |
| D3 | `EventPolicy.getEventTime` no implementado | Offsets de calendar_event desde `now`, no desde evento | Medio |
| D4 | `calendar_event` usa intent `follow_up` para todo | Títulos incorrectos | Bajo |
| D5 | `_applySimultaneousLimit` descarta sin razón | Solo 3 notificaciones simultáneas | Medio |
| D6 | `activeStudy` flag nunca se activa | Supresión de review nunca ocurre | Bajo |
| D7 | `ReminderSnapshot.statistics` nunca se pobla | Templates sin contexto de urgencia | Bajo |
| D8 | Configuración se pierde al reiniciar | Settings en useState, no persistidos | Medio |
| D9 | `resync()` sin protección de concurrencia | Race condition en syncs rápidos | Medio |

---

## 7. Eliminación de Código Legacy

| Archivo | Líneas | Acción |
|---------|--------|--------|
| `notificationService.ts` funciones de deadline/class/weekly | ~150 | Eliminar |
| `useNotifications.ts` | 101 | Eliminar |
| `notificationService.ts` funciones de backup/download | ~120 | Mantener (se usan) |
| `_layout.tsx:21` comentario muerto | 1 | Eliminar referencia |

---

## 8. Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                        BOOTSTRAP                             │
├─────────────────────────────────────────────────────────────┤
│  BootstrapManager.start()                                    │
│    ↓                                                         │
│  [DB Phase]                                                  │
│    notificationDiagnostics.logChannelCheck('reminders', ?)   │
│    notificationScheduler.setupChannels()                     │
│    notificationScheduler.requestPermissions()                │
│    notificationScheduler.setForegroundHandler(handler)        │
│    ↓                                                         │
│  [Fire-and-forget]                                           │
│    getReminderCoordinator().initialize()                     │
│      → snapshotBuilder.build()                               │
│      → engine.initialize(snapshot)                           │
│        → pipeline → reconciler → scheduler.schedule()        │
│          → diagnostics.logSchedule({ ... })                  │
│    getReminderCoordinator().subscribeToEventBus()            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ENTITY CHANGED                            │
├─────────────────────────────────────────────────────────────┤
│  RepositoryEventBus → subscribeToEventBus                    │
│    → coordinator.handleEntityChanged()                       │
│      → repo.getById()                                       │
│      → engine.onEntityChanged()                              │
│        → _buildDesiredSequence()                             │
│        → _runPipeline()                                      │
│          → interruption.resolve()                            │
│          → templates.enrich()                                │
│          → reconciler.sync(plan, scheduler)                  │
│            → scheduler.cancel(id)  → diagnostics.logCancel() │
│            → scheduler.schedule(r) → diagnostics.logSchedule()│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    RESYNC (post-sync)                         │
├─────────────────────────────────────────────────────────────┤
│  syncManager.subscribe('complete')                           │
│    → coordinator.resync()                                    │
│      → snapshotBuilder.build()                               │
│      → engine.initialize(snapshot)                           │
│        → pipeline → reconciler → scheduler                   │
│          → diagnostics.logReconciliation({ ... })            │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Notas para Futuro

### OEM Restrictions (post-Fase 4)

Documentar instrucciones específicas por fabricante:
- Xiaomi: Settings → Apps → Threshold → Battery → No restringir
- Samsung: Settings → Battery → Background usage limits → Excluir Threshold
- Huawei: Settings → Battery → App launch → Threshold → Gestionar manualmente

### Badge Count

Calcular total de notificaciones pendientes y reflejar en badge del ícono.

### Supresión Nocturna

Configurable por usuario: no notificar entre horas definidas.

### Notificación Recurrente Nativa

Para clases semanales, considerar `repeat: true` en Expo en vez de regenerar cada resync.
