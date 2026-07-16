# Document Platform — Renderer & Extractor Contract

> Referencia de arquitectura. Documento vivo: actualizar cuando se modifique cualquier contrato.  
> Última revisión: Jul 2026

---

## 1. Filosofía

Threshold no es un visor de archivos. Es una **Document Platform**: cualquier documento, independientemente de su formato de origen, debe ofrecer las mismas capacidades (búsqueda, selección, highlights, anotaciones, flashcards, Ask Zyren) dentro del mismo `DocumentWorkspace`.

Para lograrlo, el pipeline está estrictamente separado en dos capas:

```
DocumentSource
      ↓
DocumentExtractor       ← produce datos; nunca genera UI
      ↓
ExtractedDocument
      ↓
DocumentModelBuilder
      ↓
DocumentModel
      ↓
DocumentRenderer        ← genera UI; nunca reparsea el archivo
      ↓
DocumentWorkspace       ← orquesta capacidades; no sabe qué formato tiene
```

---

## 2. Contrato del Extractor (`DocumentExtractor`)

### Interfaz requerida

```typescript
interface DocumentExtractor {
  readonly id: string;           // identificador único, ej: 'xlsx-extractor'
  readonly version: number;      // incrementar si cambia el modelo de salida

  supports(source: DocumentSource): boolean;
  extractDocument(source: DocumentSource): Promise<ExtractedDocument>;
}
```

### Invariantes

| # | Regla |
|---|-------|
| E1 | El extractor **nunca importa componentes React** ni genera HTML. |
| E2 | El extractor **no lee archivos directamente** por path. Recibe un `DocumentSource` y llama `openRead()`. |
| E3 | El extractor **no cachea nada internamente**. El cache es responsabilidad de la capa de carga (`[documentUri].tsx`). |
| E4 | El valor `raw: false` (o equivalente) se usa siempre: el extractor devuelve lo que el usuario vería, no fórmulas ni valores internos. |
| E5 | Si el archivo está corrupto o vacío, el extractor devuelve un `ExtractedDocument` vacío, nunca lanza un error que rompa el pipeline. |
| E6 | Los metadatos específicos del formato (ej: `SpreadsheetMetadata`, `sheetNames`) se incluyen en `ExtractedDocument.metadata` para que el renderer los consuma. El dominio no los conoce directamente. |

### Extractores registrados

| Extractor | Formatos | Notas |
|-----------|---------|-------|
| `PdfDocumentExtractor` | `application/pdf` | Usa módulo nativo `ThresholdPdfExtractor` |
| `TextDocumentExtractor` | `text/plain`, `application/json` | Divide TXT en párrafos; JSON en bloque único pretty-printed |
| `XlsxExtractor` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv` | Produce `TableBlock[]` + `TextBlock[]` por fila; metadata contiene `SpreadsheetSheet[]` |

---

## 3. Contrato del Renderer (`DocumentRenderer`)

### Interfaz requerida

```typescript
interface DocumentRenderer {
  // Resolución: RendererRegistry llama supports() para encontrar el renderer correcto.
  supports(model: DocumentModel): boolean;

  // Renderizado principal.
  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: OnDocumentReady,
    onSelection?: OnTextSelection,
    highlightedBlockId?: string,
    searchRef?: MutableRefObject<RendererSearchRef | null>,
    onSearchResult?: OnSearchResult,
    highlightsRef?: MutableRefObject<RendererHighlightRef | null>,
    onHighlightTapped?: (id: string) => void,
  ): unknown;
}
```

### Interfaz de búsqueda (cuando la capacidad está disponible)

```typescript
interface RendererSearchRef {
  search(query: string): void;
  next(): void;
  prev(): void;
  clear(): void;
}
```

### Interfaz de highlights (cuando la capacidad está disponible)

```typescript
interface RendererHighlightRef {
  set(highlights: readonly DocumentHighlight[]): void;
}
```

### Invariantes

| # | Regla |
|---|-------|
| R1 | El renderer **nunca reparsea el archivo** original. Trabaja exclusivamente con el `DocumentModel` recibido. |
| R2 | El renderer **nunca importa SheetJS, PDF.js ni ningún parser**. Esos pertenecen al extractor. |
| R3 | El HTML generado por un renderer (ej: `SpreadsheetRenderer`) **nunca entra al dominio**. Es un detalle de implementación interno al renderer. |
| R4 | El renderer notifica `onDocumentReady(totalPages)` exactamente una vez, cuando el contenido es visible para el usuario. |
| R5 | Los parámetros `searchRef`, `highlightsRef` y `onHighlightTapped` son opcionales. Si el renderer no soporta esa capacidad, los ignora silenciosamente. |
| R6 | El estado interno del renderer (página activa, hoja activa, zoom) es local. `DocumentWorkspace` no lo persiste. |
| R7 | `supports()` es la única fuente de verdad sobre qué renderer maneja qué modelo. `RendererRegistry` nunca usa índices, switches ni condiciones hardcodeadas. |

### Renderers registrados

| Renderer | Formatos | Búsqueda | Highlights | Selección |
|----------|---------|----------|------------|-----------|
| `NativePdfRenderer` | PDF | ✅ | ✅ | ✅ |
| `NativeTextRenderer` | TXT, JSON, MD | 🔜 | 🔜 | 🔜 |
| `SpreadsheetRenderer` | XLSX, XLS, CSV | 🔜 | 🔜 | 🔜 |

---

## 4. Matriz de Capacidades

| Capacidad | PDF | TXT | JSON | XLSX |
|-----------|-----|-----|------|------|
| Abrir | ✅ | ✅ | ✅ | ✅ |
| Renderizar | ✅ | ✅ | ✅ | ✅ |
| Búsqueda | ✅ | 🔜 | 🔜 | 🔜 |
| Selección de texto | ✅ | 🔜 | 🔜 | 🔜 |
| Copiar / Compartir | ✅ | 🔜 | 🔜 | 🔜 |
| Highlights persistentes | ✅ | 🔜 | 🔜 | 🔜 |
| Anotaciones | 🔲 | 🔲 | 🔲 | 🔲 |
| Flashcards desde selección | 🔲 | 🔲 | 🔲 | 🔲 |
| Ask Zyren | 🔲 | 🔲 | 🔲 | 🔲 |

> ✅ Implementado · 🔜 En roadmap próximo · 🔲 Capacidad futura

---

## 5. Sistema de Cache

El pipeline de carga usa dos niveles de cache para garantizar apertura instantánea en segundas visitas:

```
Abrir documento
      ↓
1. ¿DocumentModel en RAM? (modelCache, max 5, por sesión)
      ↓ no
2. ¿ExtractedDocument en MMKV? (keyed por MD5 del archivo)
      ↓ no
3. Extractor → parseo real del archivo → persiste en MMKV
```

**Clave de cache:** `v{VERSION}:{md5_del_archivo}`  
**Invalidación:** automática al modificar el archivo (el MD5 cambia).  
**Versionado:** `EXTRACTION_CACHE_VERSION` en `[documentUri].tsx`. Incrementar si se modifica el modelo `ExtractedDocument`.

---

## 6. Cómo Añadir un Nuevo Formato

1. Crear `src/services/document/extractors/[Format]Extractor.ts` implementando `DocumentExtractor`.
2. Crear `src/services/document/renderers/[Format]Renderer.tsx` implementando `DocumentRenderer`.
3. Registrar ambos en `DocumentSystemFactory.ts`.
4. Añadir el MIME type en el `mimeMap` de `app/documents/[documentUri].tsx`.
5. Actualizar la tabla de la sección 4 de este documento.

**Nada más cambia.** `DocumentWorkspace`, `DocumentModelBuilder`, `RendererRegistry` y `ExtractorRegistry` son estables.

---

## 7. Formatos Planificados

| Formato | Estrategia | Dependencia |
|---------|-----------|-------------|
| DOCX | `mammoth.js` → HTML → WebView | `npm install mammoth` |
| PPTX | Backend convierte a PDF | API cloud o LibreOffice |
| Markdown enriquecido | `NativeTextRenderer` extendido | `react-native-markdown-display` (ya instalado) |
| EPUB | A evaluar | Sin librería actual |
