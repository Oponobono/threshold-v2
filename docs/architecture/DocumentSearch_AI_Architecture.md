# Document Search & AI Integration Architecture

*Estado: Diseño pendiente de implementación. No comenzar hasta que el Document Domain (Workspace, Viewer, Renderer) esté estable en producción.*

---

## 1. El Error Conceptual que Este Documento Corrige

El error más común al integrar documentos con IA es mezclar dos objetivos distintos en el mismo pipeline:

| Objetivo | Descripción | Necesita IA |
|---|---|---|
| **Leer un documento** | El usuario quiere ver el contenido | ❌ Nunca |
| **Preguntarle algo a Zyren** | El usuario quiere una respuesta | ✅ Sí, pero solo el fragmento relevante |

Estos dos objetivos deben vivir en dominios completamente separados.

El error que produce los problemas de escala (timeouts, OOM, latencia) es exactamente este:

```
PDF → extraer TODO → mandar TODO al LLM
```

Eso no escala. Ni con GPT. Ni con Claude. Ni con Gemini. Ni con nadie.

---

## 2. La Separación Correcta de Dominios

```
┌─────────────────────────────────────────────────────────────────┐
│  DOCUMENT DOMAIN (ya implementado)                              │
│                                                                 │
│  PDF ──► DocumentExtractor ──► ExtractedDocument               │
│                                     │                          │
│                                     ▼                          │
│                              DocumentModelBuilder               │
│                                     │                          │
│                                     ▼                          │
│                              DocumentModel ──► NativePdfRenderer│
│                                                                 │
│  Responsabilidad: obtener texto y renderizar. Fin.             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SEARCH DOMAIN (pendiente)                                      │
│                                                                 │
│  ExtractedDocument ──► DocumentIndexer ──► FTS5 (SQLite)       │
│                                                │                │
│                                                ▼                │
│                                        ContextRetriever         │
│                                                │                │
│                                         [query, docId]          │
│                                                │                │
│                                         páginas relevantes      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AI DOMAIN (ya existe parcialmente como chat genérico)          │
│                                                                 │
│  query + context (2000–5000 palabras) ──► LLM ──► respuesta    │
│                                                                 │
│  Responsabilidad: responder preguntas. Nunca recibe el doc.    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. El OCR no es un Dominio Separado

El OCR es únicamente un **extractor alternativo**. Reemplaza al `PdfDocumentExtractor` cuando el PDF no tiene texto digital incrustado (PDFs escaneados como imagen).

```
PDF digital     ──► PdfDocumentExtractor ──► ExtractedDocument
                                                    │
PDF escaneado   ──► PdfOcrExtractor      ──► ExtractedDocument
                                                    │
                                          (mismo contrato)
                                                    │
                                                    ▼
                                            DocumentIndexer
                                            (sin saber de dónde vino)
```

**Invariante:** `ExtractedDocument` es siempre el mismo contrato sin importar si el texto vino de extracción nativa o de OCR. El resto del pipeline no sabe ni le importa.

Esto significa que el OCR **solo debe dispararse una vez por documento**, en el momento de indexación, no al abrir ni al preguntar.

---

## 4. Search Domain — Contratos

### 4.1 DocumentIndexer

```typescript
interface DocumentIndexer {
  /**
   * Indexa un ExtractedDocument en FTS5 por chunks de página.
   * Idempotente: si el doc ya está indexado con el mismo extractorVersion, no hace nada.
   */
  index(doc: ExtractedDocument, docId: string, extractorVersion: number): Promise<void>;

  /**
   * Elimina todos los chunks de un documento del índice.
   */
  drop(docId: string): Promise<void>;
}
```

### 4.2 Schema FTS5 (SQLite)

```sql
CREATE VIRTUAL TABLE document_chunks USING fts5(
  doc_id,
  page_num,
  chunk_index,
  content,
  tokenize = "unicode61"
);

-- Tabla de metadatos paralela (no virtual, para joins)
CREATE TABLE document_chunk_meta (
  doc_id       TEXT NOT NULL,
  page_num     INTEGER NOT NULL,
  chunk_index  INTEGER NOT NULL,
  char_count   INTEGER,
  extractor_v  INTEGER,
  indexed_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (doc_id, page_num, chunk_index)
);
```

### 4.3 ContextRetriever

```typescript
interface RetrievedContext {
  chunks: Array<{
    pageNum: number;
    content: string;
    score: number;       // BM25 score de FTS5
  }>;
  totalChars: number;
  docId: string;
  query: string;
}

interface ContextRetriever {
  /**
   * Busca en FTS5 y retorna los chunks más relevantes para la query.
   * Nunca excede maxChars para garantizar que el prompt cabe en el contexto del LLM.
   * Incluye página previa y siguiente a cada match para coherencia.
   */
  retrieve(
    docId: string,
    query: string,
    maxChars?: number   // default: 12000 (~3000 tokens)
  ): Promise<RetrievedContext>;
}
```

---

## 5. AskZyrenUseCase (orientado a documentos)

Este caso de uso es diferente al chat genérico actual. El chat genérico recibe `ocr_text` completo. Este caso de uso usa retrieval.

```typescript
interface AskDocumentParams {
  docId: string;
  question: string;
  selectionContext?: DocumentSelection; // Si el usuario seleccionó un fragmento específico
}

interface AskDocumentResult {
  answer: string;
  sourcePages: number[];    // Páginas que se usaron como contexto
  provider: string;
  retrievalScore: number;   // Qué tan relevante fue lo que FTS5 encontró
}

class AskZyrenUseCase {
  async execute(params: AskDocumentParams): Promise<AskDocumentResult> {
    // 1. Si hay selección explícita, usarla directamente (no ir a FTS5)
    if (params.selectionContext) {
      return this.askWithSelection(params.selectionContext, params.question);
    }

    // 2. Retrieval: buscar chunks relevantes en FTS5
    const context = await this.contextRetriever.retrieve(
      params.docId,
      params.question,
      12_000
    );

    // 3. Construir prompt con SOLO las páginas relevantes
    const prompt = this.buildPrompt(context, params.question);

    // 4. Llamar al LLM con el contexto reducido
    const answer = await this.llm.complete(prompt);

    return {
      answer: answer.content,
      sourcePages: context.chunks.map(c => c.pageNum),
      provider: answer.provider,
      retrievalScore: context.chunks[0]?.score ?? 0,
    };
  }
}
```

---

## 6. Tareas Globales (Resumir, Extraer Conceptos)

Para tareas que sí requieren el documento completo (resumen, índice temático, generar flashcards del doc entero), se usa **hierarchical summarization**, nunca un prompt de 300 páginas.

```
ExtractedDocument.textBlocks
    │
    ├──► chunk 1 (≤ 4000 palabras) ──► resumen parcial 1
    ├──► chunk 2                   ──► resumen parcial 2
    ├──► ...
    └──► chunk N                   ──► resumen parcial N
                                           │
                                           ▼
                                   prompt de resúmenes parciales
                                           │
                                           ▼
                                   Resumen final / Flashcards / Índice
```

**Regla:** El LLM nunca recibe más de `maxChars` en un solo prompt. Los chunks se procesan secuencialmente con una barra de progreso en la UI.

---

## 7. Estado Actual vs. Arquitectura Objetivo

| Componente | Estado actual | Estado objetivo |
|---|---|---|
| `NativePdfRenderer` | ✅ Implementado (fast-path) | Sin cambio |
| `PdfDocumentExtractor` | ✅ Implementado | Sin cambio |
| `PdfOcrExtractor` | ⚠️ Existe como `extractTextFromPDFHybrid`, no integrado al pipeline | Integrar como extractor alternativo |
| `DocumentIndexer` | ❌ No existe | Implementar |
| `document_chunks` (FTS5) | ❌ No existe en schema | Migration nueva |
| `ContextRetriever` | ❌ No existe | Implementar |
| `AskZyrenUseCase` (doc) | ❌ Chat genérico manda `ocr_text` completo | Reemplazar con retrieval |
| Hierarchical summarization | ❌ No existe | Implementar cuando haya demanda |

---

## 8. Flujos de Usuario Concretos

### Caso 1: Abrir un PDF de 300 páginas

```
Usuario toca documento
    → SubjectDocumentsList.openDocument()
    → router.push('/documents/[documentUri]')
    → [documentUri].tsx fast-path
    → NativePdfRenderer (WebView + PDF.js)
    → renderizado progresivo, primera página visible en < 1s
    ✅ Fin. Sin IA. Sin red. Sin OCR.
```

### Caso 2: Preguntar algo sobre el documento

```
Usuario abre chat de Zyren con contexto del documento
    → AskZyrenUseCase.execute({ docId, question })
    → ContextRetriever.retrieve(docId, question, 12_000)
    → FTS5 MATCH query → 3-5 páginas relevantes
    → buildPrompt(context, question)   ← nunca > 12.000 chars
    → LLM.complete(prompt)
    → respuesta con sourcePages: [127, 131, 132]
    ✅ Fin. Documento de 300 páginas, 2000-5000 palabras al modelo.
```

### Caso 3: PDF escaneado (sin texto digital)

```
Usuario importa PDF escaneado
    → createScannedDocument() guarda en SQLite
    → Usuario presiona "Extraer OCR"
    → PdfOcrExtractor.extract(pdfUri)  ← solo aquí aparece el OCR
    → ExtractedDocument
    → DocumentIndexer.index(doc, docId)  ← guarda en FTS5
    → ocr_text guardado en scanned_documents
    ✅ Fin. Próximas preguntas usan FTS5, no mandan el texto completo.
```

---

## 9. Invariantes de Este Diseño

1. **El LLM nunca recibe un documento completo.** Siempre recibe un fragmento recuperado por `ContextRetriever`.
2. **El OCR solo ocurre una vez por documento**, en el momento de indexación o importación. No al abrir el visor.
3. **`ExtractedDocument` es el único contrato entre Document Domain y Search Domain.** FTS5 no sabe si el texto vino de PDF digital u OCR.
4. **Abrir un documento para leer nunca toca la red.** Solo SQLite y el archivo local.
5. **`DocumentSelection` es el puente entre el usuario y el AI Domain.** Si el usuario seleccionó un fragmento, ese fragmento tiene prioridad sobre el retrieval automático.

---

*Próximo sprint cuando este diseño se implemente: comenzar por el schema FTS5 (migration), luego `DocumentIndexer`, luego `ContextRetriever`. El `AskZyrenUseCase` orientado a documentos es el último paso, cuando el retrieval esté validado.*
