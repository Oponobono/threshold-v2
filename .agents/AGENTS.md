

## Operation Notifications (Long Running Operations)
- **LRO Isolation:** Any service performing a Long Running Operation (e.g., BackupService, SyncService, DownloadManager) MUST NOT directly import or call notification providers (like expo-notifications or Notifee).
- **LRO Requirement:** Toda operación superior a 2 segundos debe implementarse como Long Running Operation (LRO) y emitir eventos mediante `OperationProgressEmitter`. Está estrictamente prohibido emitir notificaciones directamente desde servicios de dominio. Los servicios de dominio deben desconocer por completo `NotificationProvider` y `Notifee`.
- **Emission Only:** These services must ONLY emit OperationProgress events via the OperationProgressEmitter.
- **Consumer Responsibility:** The OperationNotificationController is the sole responsible entity for listening to these events and bridging them to the NotificationProvider (e.g., Notifee). This preserves the separation of concerns and allows multiple consumers (UI, Telemetry, Notifier) to read the same progress stream.
