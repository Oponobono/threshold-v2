# Document Domain & Reading Workspace Specification (Frozen)

*Directiva de Sprint 0: Esta especificación está oficialmente **congelada**. No se modificarán los diagramas ni contratos a menos que una implementación real en código demuestre una limitación insalvable.*

En Threshold, la gestión de documentos se divide en dos esferas estrictamente separadas: el **Document Domain** (que gestiona la ingestión, persistencia y extracción de contenido) y el **Reading Workspace** (que orquesta la interacción cognitiva). La integración con otros dominios (Knowledge, AI) se realiza exclusivamente mediante casos de uso en la capa de aplicación.

## 1. El Pipeline Cognitivo

El sistema funciona como un flujo de transformaciones puras y deterministas.

`Asset → DocumentSource → DocumentExtractor → ExtractedDocument → DocumentModelBuilder → DocumentModel → DocumentRenderer → DocumentSelection → DocumentWorkspace`

*El alcance del Document Domain termina en `DocumentWorkspace`. La integración con Knowledge, AI y otros dominios se realiza mediante casos de uso en la capa de aplicación (ver §7).*

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
El `DocumentExtractor` NUNCA debe conocer la entidad `Asset` ni rutas físicas.
```typescript
interface DocumentSource {
    mimeType: string;
    hash: string;
    openRead(): Promise<ArrayBuffer | Readable>;
}
```

## 2. Extracción y Modelado (Versionado y Determinismo)

El extractor interpreta el formato y obtiene contenido; el builder lo transforma en un modelo de presentación.

### 2.1 El DocumentExtractor (Contrato Versionado)

El extractor responde a una sola pregunta: *¿Qué contiene este archivo?*

No transforma el documento para guardarlo. No calcula páginas ni TOC. No sabe qué es un sidebar. Simplemente lee el formato binario y devuelve todo lo que logró extraer.

```typescript
interface DocumentExtractor {
    readonly id: string;
    readonly version: number; // Clave para invalidar cachés
    supports(source: DocumentSource): boolean;
    extractDocument(source: DocumentSource): Promise<ExtractedDocument>;
}

// Invariante: ExtractedDocument representa únicamente el contenido obtenido
// de la fuente. No contiene decisiones de presentación ni información
// específica del renderer. No conoce páginas visuales, zoom, sidebar,
// TOC renderizable ni overlays.
interface ExtractedDocument {
    textBlocks: TextBlock[];
    images: ImageBlock[];
    tables: TableBlock[];
    metadata: Record<string, any>;
}
```

*Invariante de Determinismo:* Para un mismo `DocumentSource.hash`, `DocumentExtractor.id` y `DocumentExtractor.version`, el `ExtractedDocument` generado debe ser idéntico. Esta garantía es la base de la caché determinista.

*Invariante de Caché:* `Source.hash` + `Extractor.id` + `Extractor.version` = Llave única de caché.

### 2.2 El Builder (Hacia el Modelo Visual)
El `DocumentModelBuilder` toma el `ExtractedDocument` y construye paginación, TOC y capacidades. *(Nota de evolución: Podría dividirse a futuro en `TOCBuilder`, `PageBuilder`, etc.)*

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
*(Nota de evolución: `DocumentSelection` es el punto de conexión entre el Document Domain y la capa de aplicación. Ver §7 para la integración con Knowledge Domain).*

## 4. Patrón Registry y Orquestación UI

Se eliminan las Factorías rígidas. Todo se inyecta y resuelve vía Registries.

```typescript
interface DocumentRenderer {
    render(model: DocumentModel): ReactNode;
}

class ExtractorRegistry {
    register(extractor: DocumentExtractor): void;
    resolve(source: DocumentSource): DocumentExtractor;
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
| **DocumentExtractor** | Cambia o mejora el formato subyacente (PDF, DOCX, imagen, audio) |
| **ExtractedDocument** | Cambia lo que se extrae del archivo en bruto |
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
3. **Contratos Interfaces:** Crear interfaces `DocumentSource`, `DocumentExtractor`, `DocumentRenderer`.
4. **Registries:** Implementar `ExtractorRegistry` y `RendererRegistry`.
5. **Servicios y Pipelines:** `AssetService` (Gestión física) y `DocumentImporter`.
6. **Testing:** Pruebas unitarias que aseguren la inmutabilidad y resolución determinista sin React.

## 7. Integración Futura con Knowledge Domain

El alcance del Document Domain termina en `DocumentWorkspace`. El conocimiento no nace del documento — nace de la interacción del usuario con el documento.

La conexión con Knowledge se implementará mediante casos de uso en la capa de aplicación:

```
DocumentSelection
    ↓
UseCase (CreateFlashcard / AskZyren / Annotate)
    ↓
Knowledge Domain
```

Esto mantiene ambos dominios completamente desacoplados. El Document Domain no conoce la existencia de Knowledge.

**Principio:** No es Documento → Knowledge. Es Documento → Usuario interactúa → Caso de uso → Knowledge.

El conocimiento aparece porque el usuario hizo algo con el documento: seleccionó un párrafo, creó una flashcard, pidió una explicación a Zyren, añadió una anotación. No porque exista un PDF.

*Cuando existan 2-3 fuentes de conocimiento reales (PDF, audio, YouTube, web), emergerá naturalmente un dominio superior (LearningPipeline) que consume selecciones de múltiples fuentes. Ese diseño no es anticipación — es evolución orgánica cuando las implementaciones lo demanden.*
