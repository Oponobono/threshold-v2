Lo que queda (intencionalmente no traducido)
Comentarios de código en español (~60 líneas) — son para desarrolladores, no usuarios
throw Errors en APIs ('No hay sesión activa.') — errores internos, no visibles al usuario
System prompts de IA (VideoDetail, groqHelpers) — van al modelo, no al usuario
transcriptionFormatter.ts — palabras clave técnicas para procesamiento de texto
llmProviderManager.ts — datos de configuración (ventajas/límites de proveedores)
Debug logs (offlineSyncService, [[API_DOCUMENTATION|api]]/client) — solo consola

como podria mejorar o impulsar aun mas mi sistema de [[FLASHCARDS_COMPLETE_DOCUMENTATION|flashcards]]?
+ Thought: 4.7s
Dado lo que ya tienes ([[spaced_repetition_logic|FSRS]], detección de confusiones, IA, múltiples tipos, grupos, import/export), algunas ideas:
Alto impacto:
1. Analíticas de retención — gráfica de curva de olvido por mazo, tasa de acierto semanal
2. Límite diario de revisión — el usuario define cuántas tarjetas nuevas/review por día
3. Tarjetas con imágenes — soporte para img en front/back
4. Leitner Box visual — vista de "cajones" mostrando qué tan dominado está cada mazo
5. Heatmap de racha — similar a GitHub, motivación visual
Mediano:
6. Tarjetas cloze (fill-in-the-blank) — tipo muy popular en Anki
7. Autocompletado/autosugerencia mientras estudias
8. Revisión por voz — grabas la respuesta, la app reconoce si acertaste
9. Tags por tarjeta — filtrar/revisar por tema transversal a mazos

---
**Tags:** #audits
