

## Operation Notifications (Long Running Operations)
- **LRO Isolation:** Any service performing a Long Running Operation (e.g., BackupService, SyncService, DownloadManager) MUST NOT directly import or call notification providers (like expo-notifications or Notifee).
- **LRO Requirement:** Toda operaci脙鲁n superior a 2 segundos debe implementarse como Long Running Operation (LRO) y emitir eventos mediante `OperationProgressEmitter`. Est脙隆 estrictamente prohibido emitir notificaciones directamente desde servicios de dominio. Los servicios de dominio deben desconocer por completo `NotificationProvider` y `Notifee`.
- **Emission Only:** These services must ONLY emit OperationProgress events via the OperationProgressEmitter.
- **Consumer Responsibility:** The OperationNotificationController is the sole responsible entity for listening to these events and bridging them to the NotificationProvider (e.g., Notifee). This preserves the separation of concerns and allows multiple consumers (UI, Telemetry, Notifier) to read the same progress stream.
- **Consumer Responsibility:** The OperationNotificationController is the sole responsible entity for listening to these events and bridging them to the NotificationProvider (e.g., Notifee). This preserves the separation of concerns and allows multiple consumers (UI, Telemetry, Notifier) to read the same progress stream.


## Architectural Rules (August 2026)
- **Principle of Single Responsibility (Threshold):** Ning煤n m贸dulo podr谩 asumir nuevas responsabilidades cuando exista la posibilidad de encapsularlas en un componente independiente. Corolarios: Preferir crear un m贸dulo nuevo antes que ampliar uno existente. Cada componente debe tener una 煤nica raz贸n para cambiar. La comunicaci贸n entre componentes debe hacerse mediante contratos claros. Los componentes no deben conocer detalles internos de otros componentes. Los Engines orquestan; los Processors ejecutan; los Repositories persisten; los Models representan estado.
- **Regla de Saturaci贸n:** Cuando un componente comienza a resolver problemas de dos dominios distintos, debe dividirse.
- **Arquitectura Congelada:** Una vez un subsistema alcanza estabilidad: se documenta, se versiona, se considera congelado. Las nuevas funcionalidades deben extenderlo mediante nuevos m贸dulos. No modificando su comportamiento interno.
- **Colaboraci贸n vs Expansi贸n:** Ning煤n componente debe crecer resolviendo nuevas responsabilidades; debe crecer colaborando con nuevos componentes.

## Subdominios Congelados Oficialmente
- **AI Domain v2.0 (Status: Frozen, 2026-08-06):** Arquitectura estable (Capability Pattern, AIOrchestrator, Threshold Directive Protocol, Domain Services). Invariantes oficiales de la Constituci贸n:
  1. Solo una Capability expone un caso de uso determin铆stico.
  2. Solo un Orchestrator orquesta modelos.
  3. Ning煤n Stage conoce otro Stage.
  4. Solo un Provider puede hablar con el LLM.
  5. Ning煤n Provider es importado fuera del Orchestrator.
  6. Ning煤n Repository conoce IA.
  7. Ning煤n Endpoint devuelve HTML o UI.
  8. Los Domain Services/Aggregates son el l铆mite de persistencia del dominio.
  9. SQLite sigue siendo la 煤nica fuente de verdad del cliente.
  10. Todo cambio determin铆stico debe respetar el patr贸n Capability.
  11. Los modelos de IA nunca producen efectos secundarios; 煤nicamente producen directivas estructuradas o texto.
  12. La ejecuci贸n de directivas (TDP) pertenece exclusivamente a los Coordinators (`AIInteractionCoordinator`) mediante el `DirectiveHandlerRegistry`.
  13. El TDP (Threshold Directive Protocol) es un protocolo estable para intenciones abiertas.
  14. **Toda persistencia de mazos generados por IA (o cualquier entidad de dominio compleja) debe pasar obligatoriamente por un Domain Service (ej. `FlashcardDomainService`). La UI JAM脕S debe instanciar IDs, construir entidades parciales, ni invocar Repositories directamente.**

- **Document Domain v2.0 (Status: Frozen, 2026-08-06):** Espacio de Referencias y Lectura Pasiva. Invariantes constitucionales:
  1. **Inmutabilidad del origen:** DocumentSource, ExtractedDocument y DocumentModel nunca se modifican tras la extracci髇.
  2. **Desacoplamiento absoluto:** El Document Domain no conoce modelos de IA, providers ni l骻ica de aprendizaje (FSRS). Todo sucede fuera de sus fronteras.
  3. **Propiedad exclusiva de las anclas:** DocumentAnchor es el 鷑ico mecanismo oficial para relacionar un documento con artefactos externos.
  4. **Artefactos derivados:** Cualquier resumen, conjunto de flashcards, quiz o mapa mental es un artefacto derivado (KnowledgeArtifact externo), referenciado mediante un ArtifactReference. Nunca forma parte estructural del documento.
  5. **Reproducibilidad:** Todo artefacto derivado debe poder reconstruirse a partir del documento original y sus metadatos; el documento (y sus anclas) permanece como la 鷑ica fuente de verdad inmutable.
  6. **Agnosticismo de Formato:** Las anclas apuntan siempre a una representaci髇 l骻ica (DocumentLocation), nunca al parser o renderer original, garantizando su supervivencia si el extractor cambia.

