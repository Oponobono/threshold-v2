# Document Feature Roadmap

Límites de dominio para funcionalidades del Document Workspace.

## Domain Layer

Puro. Sin dependencias de UI, BD, ni red.

| Feature | Entidad | Descripción |
|---------|---------|-------------|
| Selection | `DocumentSelection` | Rango de texto seleccionado (page, start, end, fingerprint) |
| Highlight | `DocumentHighlight` | Selection + color + persistencia |
| Annotation | `DocumentAnnotation` | Selection + contenido de texto |
| Index | `DocumentIndex` | Búsqueda full-text sobre bloques de texto |
| Capabilities | `DocumentCapabilities` | Acciones disponibles por documento |
| Model | `DocumentModel` | Páginas, TOC, metadata |

## Application Layer

Orquesta Domain + Infrastructure. Casos de uso.

| Feature | Caso de uso | Domínios que toca |
|---------|-------------|-------------------|
| Copy | `CopyTextUseCase` | Document → Clipboard |
| Share | `ShareTextUseCase` | Document → Share API |
| Search | `SearchDocumentUseCase` | Document (index) |
| Create Highlight | `CreateHighlightUseCase` | Document → SQLite |
| Create Annotation | `CreateAnnotationUseCase` | Document → SQLite |
| Create Flashcard | `CreateFlashcardUseCase` | Document → Knowledge |
| Ask Zyren | `AskZyrenUseCase` | Document → AI |

## Knowledge Domain

Recibe datos del Document Domain vía casos de uso.

| Feature | Recibe | Produce |
|---------|--------|---------|
| Flashcard creation | `DocumentSelection` + contenido | `Flashcard` en Knowledge |
| Review scheduling | `Flashcard` | `ReviewSchedule` |

## AI Domain

Recibe contexto del Document Domain.

| Feature | Recibe | Produce |
|---------|--------|---------|
| Ask Zyren | Selection + contexto | Respuesta LLM |
| Summarize | Document completo | Resumen |

## Reglas

1. **Document Domain no conoce Knowledge ni AI.** Se comunican vía casos de uso en Application.
2. **Knowledge no conoce PDFs ni extractors.** Recibe `DocumentSelection` como value object.
3. **UI no importa domain directamente.** Usa hooks que consumen casos de uso.
4. **Cada feature nueva se clasifica antes de implementarse.** Si no sabe a qué capa pertenece, no se implementa.

## Sprint Map

| Sprint | Feature | Capa |
|--------|---------|------|
| 3.1 | Selection + Copy + Share | Domain + Application |
| 3.2 | Search | Domain (Index) + Application |
| 3.3 | Highlight | Domain + Application + SQLite |
| 3.4 | Annotations | Domain + Application + SQLite |
| 3.5 | Flashcards | Application → Knowledge |
| 3.6 | Ask Zyren | Application → AI |
