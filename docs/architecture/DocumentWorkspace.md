# Document Domain & Reading Workspace Specification (Frozen)

*Directiva de Sprint 0: Esta especificación está oficialmente **congelada**. No se modificarán los diagramas ni contratos a menos que una implementación real en código demuestre una limitación insalvable.*

En Threshold, la gestión de documentos se divide en dos esferas estrictamente separadas: el **Document Domain** (que gestiona la ingestión, persistencia y extracción estática) y el **Reading Workspace** (que orquesta la interacción cognitiva). 

## 1. El Pipeline Cognitivo

El sistema funciona como un flujo de transformaciones puras y deterministas.

`Asset → DocumentSource → Parser → ParsedDocument → Builder → DocumentModel → Viewer (Renderer) → DocumentSelection → Workspace → Knowledge Extractor (IA, FSRS, Annotations)`

### 1.1 Entidades Persistidas
La entidad lógica nunca mezcla el estado de lectura ni el archivo físico.
```typescript
interface Document {
    id: string;
    title: string;
    assetId: string; // Apunta al Asset universal
    metadata: DocumentMetadata;
}

// El estado de lectura pertenece al perfil, no al documento.
interface ReadingState {
    documentId: string;
    profileId: string;
    page: number;
    zoom: number;
    scrollOffset: number;
    lastViewedAt: Date;
}
```

### 1.2 Aislamiento de Persistencia (DocumentSource)
El `DocumentParser` NUNCA debe conocer la entidad `Asset` ni rutas físicas.
```typescript
interface DocumentSource {
    mimeType: string;
    hash: string;
    openRead(): Promise<ArrayBuffer | Readable>;
}
```

## 2. Parsing y Modelado (Versionado y Determinismo)

El parser extrae los datos crudos agnósticos de UI; el builder los transforma en un modelo de presentación.

### 2.1 El Parser (Contrato Versionado)
```typescript
interface DocumentParser {
    readonly id: string;
    readonly version: number; // Clave para invalidar cachés
    supports(source: DocumentSource): boolean;
    parse(source: DocumentSource): Promise<ParsedDocument>;
}

// Agnóstico de UI. No sabe qué es una "página" ni un "sidebar".
interface ParsedDocument {
    textBlocks: TextBlock[];
    images: ImageBlock[];
    tables: TableBlock[];
    metadata: Record<string, any>;
}
```
*Invariante de Caché:* `Source.hash` + `Parser.id` + `Parser.version` = Llave única de caché determinista.

### 2.2 El Builder (Hacia el Modelo Visual)
El `DocumentModelBuilder` toma el `ParsedDocument` y construye paginación, TOC y capacidades. *(Nota de evolución: Podría dividirse a futuro en `TOCBuilder`, `PageBuilder`, etc.)*

## 3. Contratos de Interacción (Proyecciones Efímeras)

### 3.1 DocumentCapabilities & DocumentAction
```typescript
enum DocumentAction { Search, Highlight, AskAI, CreateFlashcard, Copy }

class DocumentCapabilities {
    private allowedActions: Set<DocumentAction>;
    supports(action: DocumentAction): boolean { return this.allowedActions.has(action); }
}
```

### 3.2 DocumentSelection (Value Object Identificable)
Contrato central de interacción emitido por el UI.
```typescript
interface DocumentSelection {
    readonly selectionFingerprint: string; // Hash estable para persistir anotaciones
    readonly documentId: string;
    readonly range: SelectionRange;
    readonly content: { text?: string; images?: string[]; tables?: any[]; };
    readonly metadata: SelectionMetadata; 
}
```
*(Nota de evolución: La selección se enviará a un futuro `KnowledgeExtractor` que orquestará si va a IA, FSRS o Notas).*

## 4. Patrón Registry y Orquestación UI

Se eliminan las Factorías rígidas. Todo se inyecta y resuelve vía Registries.

```typescript
interface DocumentRenderer {
    render(model: DocumentModel): ReactNode;
}

class ParserRegistry {
    register(parser: DocumentParser): void;
    resolve(source: DocumentSource): DocumentParser;
}

class RendererRegistry {
    register(renderer: DocumentRenderer): void;
    resolve(model: DocumentModel): DocumentRenderer;
}
```
**Responsabilidad UI:** El `DocumentWorkspace` orquesta los casos de uso cognitivos. El `DocumentViewer` es quien internamente resuelve con el `RendererRegistry` qué pintar, aislando al Workspace del renderizado.

## 5. Tabla Única de Responsabilidad de Cambio (SRP)

Esta es la demostración de madurez del dominio. Cada pieza cambia por **una sola razón**:

| Componente | Motivo de Cambio |
|------------|------------------|
| **Asset** / **AssetService** | Cambia el modelo de almacenamiento físico |
| **Document** | Cambia el dominio general de documentos |
| **DocumentSource** | Cambia la forma de leer archivos binarios |
| **Parser** | Cambia o mejora el formato subyacente (PDF, DOCX) |
| **ParsedDocument** | Cambia lo que se extrae del archivo en bruto |
| **Builder** | Cambia la lógica de cómo se arma la UI a partir de los datos |
| **DocumentModel** | Cambia la representación visual o estructural |
| **Renderer** | Cambia la tecnología o lógica de renderizado visual |
| **Workspace** | Cambian los casos de uso del usuario (Anotar, IA, FSRS) |
| **ReadingState** | Cambia cómo y qué estado persistimos por sesión/usuario |
| **Index** | Cambian las necesidades de búsqueda y tokenización (FTS5) |
| **Selection** | Cambia la forma en que el usuario interactúa o selecciona elementos |

## 6. Hoja de Ruta: Sprint 0 (Foundations)

El primer sprint establecerá puramente el Dominio y los Contratos (cero UI, puro enfoque Local-First).

1. **Entidades Universales:** Adaptar/Crear `Asset` genérico y la entidad `Document` con sus repositorios.
2. **Value Objects y Proyecciones:** Definir `DocumentModel`, `DocumentCapabilities`, `DocumentSelection` e `Index`.
3. **Contratos Interfaces:** Crear interfaces `DocumentSource`, `DocumentParser`, `DocumentRenderer`.
4. **Registries:** Implementar `ParserRegistry` y `RendererRegistry`.
5. **Servicios y Pipelines:** `AssetService` (Gestión física) y `DocumentImporter`.
6. **Testing:** Pruebas unitarias que aseguren la inmutabilidad y resolución determinista sin React.
