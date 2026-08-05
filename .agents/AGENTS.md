

## Operation Notifications (Long Running Operations)
- **LRO Isolation:** Any service performing a Long Running Operation (e.g., BackupService, SyncService, DownloadManager) MUST NOT directly import or call notification providers (like expo-notifications or Notifee).
- **LRO Requirement:** Toda operaciÃ³n superior a 2 segundos debe implementarse como Long Running Operation (LRO) y emitir eventos mediante `OperationProgressEmitter`. EstÃ¡ estrictamente prohibido emitir notificaciones directamente desde servicios de dominio. Los servicios de dominio deben desconocer por completo `NotificationProvider` y `Notifee`.
- **Emission Only:** These services must ONLY emit OperationProgress events via the OperationProgressEmitter.
- **Consumer Responsibility:** The OperationNotificationController is the sole responsible entity for listening to these events and bridging them to the NotificationProvider (e.g., Notifee). This preserves the separation of concerns and allows multiple consumers (UI, Telemetry, Notifier) to read the same progress stream.
- **Consumer Responsibility:** The OperationNotificationController is the sole responsible entity for listening to these events and bridging them to the NotificationProvider (e.g., Notifee). This preserves the separation of concerns and allows multiple consumers (UI, Telemetry, Notifier) to read the same progress stream.


## Architectural Rules (August 2026)
- **Principle of Single Responsibility (Threshold):** Ningún módulo podrá asumir nuevas responsabilidades cuando exista la posibilidad de encapsularlas en un componente independiente. Corolarios: Preferir crear un módulo nuevo antes que ampliar uno existente. Cada componente debe tener una única razón para cambiar. La comunicación entre componentes debe hacerse mediante contratos claros. Los componentes no deben conocer detalles internos de otros componentes. Los Engines orquestan; los Processors ejecutan; los Repositories persisten; los Models representan estado.
- **Regla de Saturación:** Cuando un componente comienza a resolver problemas de dos dominios distintos, debe dividirse.
- **Arquitectura Congelada:** Una vez un subsistema alcanza estabilidad: se documenta, se versiona, se considera congelado. Las nuevas funcionalidades deben extenderlo mediante nuevos módulos. No modificando su comportamiento interno.
- **Colaboración vs Expansión:** Ningún componente debe crecer resolviendo nuevas responsabilidades; debe crecer colaborando con nuevos componentes.

## Subdominios Congelados Oficialmente
- **AI Domain v1.0 (Status: Frozen, 2026-08-04):** Arquitectura estable (Capability Pattern, InferenceRouter, KnowledgeEngine, Engine/Pipeline, Aggregate/Repository). Las nuevas capacidades (Quiz, Summary, StudyPlan) deben construirse sobre esta base reutilizando la infraestructura, sin reescribir ni romper la coherencia (ver `docs/architecture/AI_DOMAIN.md`). Invariantes oficiales de la Constitución:
  1. Solo una Capability expone un caso de uso.
  2. Solo un Engine orquesta.
  3. Ningún Stage conoce otro Stage.
  4. Solo un Stage puede hablar con el LLM.
  5. Ningún Provider es importado fuera del InferenceRouter.
  6. Ningún Repository conoce IA.
  7. Ningún Stage devuelve HTTP.
  8. Los Aggregates son el límite del dominio.
  9. SQLite sigue siendo la única fuente de verdad del cliente.
  10. Todo cambio debe respetar el patrón Capability.
