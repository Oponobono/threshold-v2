# Document Context Flow for AI Chat - Comprehensive Analysis

**Date**: 2026-06-06  
**Focus**: How documents are sent as context to Zyren/AI, OCR text handling, and offline vs online processing

---

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [Context Building Pipeline](#context-building-pipeline)
3. [OCR Text Field Analysis](#ocr-text-field-analysis)
4. [Offline vs Online Processing](#offline-vs-online-processing)
5. [Detailed Code Flow](#detailed-code-flow)
6. [Data Structures](#data-structures)
7. [Critical Gaps & Observations](#critical-gaps--observations)

---

## High-Level Architecture

The document context flow is a **three-layer pipeline**:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. MOBILE CLIENT (Selection & Mapping)                          │
│                                                                 │
│  SubjectAIContextModal (displays items in Bento Grid)           │
│    ↓                                                             │
│  aiContextMappers.ts (transforms data to AIContextItemData)    │
│    ↓                                                             │
│  SubjectAIFab.tsx (orchestrates buildAndProceed)               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
            (POST /ai/build-context with item IDs)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. BACKEND SERVER (Context Assembly)                            │
│                                                                 │
│  aiController.buildContext()                                    │
│    ├─ Query photos.ocr_text                                    │
│    ├─ Query scanned_documents.ocr_text                         │
│    ├─ Query audio_transcripts.transcript_text                  │
│    └─ Query youtube_transcripts.transcript_text                │
│                                                                 │
│  Format: "[TYPE: label]\n<text>\n\n---\n\n"                   │
│  Return: { context: string, itemsCount: number }              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
        (context text stored in client state)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. AI CHAT (Use Context)                                        │
│                                                                 │
│  sendHybridChatMessage(contextText, messages, ...)            │
│    ├─ Resolve provider (local or cloud based on forceOfflineMode)
│    └─ Send to LLM (Groq, Gemini, or Llama.rn)                 │
│                                                                 │
│  Response used for chat or flashcard generation                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Context Building Pipeline

### Step 1: UI Selection (SubjectAIContextModal.tsx)

**Input**: Raw entities from props
```typescript
interface SubjectAIContextModalProps {
  isVisible: boolean;
  recordings?: RecordingItem[];
  photos?: any[];                    // { id, local_uri, ocr_text?, ... }
  documents?: any[];                 // { id, name, local_uri, ocr_text?, ... }
  videos?: YouTubeVideo[];
  onAskQuestions?: (selected: AIContextItemData[]) => void;
  onGenerateFlashcards?: (selected: AIContextItemData[]) => void;
}
```

**Processing**:
1. Map all items to unified `AIContextItemData` format using mappers
2. Display in Bento Grid with selection checkboxes
3. Validate with `checkTextReadiness()` before allowing action
4. Warn if items missing text, but allow proceeding

**Key Validation**:
```typescript
checkTextReadiness(selected: AIContextItemData[]) {
  const withoutText = selected.filter(i => i.hasText === false);
  if (withoutText.length === 0) return { status: 'ok', items: [] };
  if (withoutText.length === selected.length) 
    return { status: 'all_empty', items: withoutText };
  return { status: 'some_empty', items: withoutText };
}
```

---

### Step 2: Mapping Layer (aiContextMappers.ts)

**Critical Function**: Transform raw DB entities → UI-ready format

```typescript
// For Documents (Scanned)
export function mapDocuments(documents: any[]): AIContextItemData[] {
  return documents.map((d, i) => ({
    id: `doc_${d.id ?? i}`,
    label: d.name || (d.local_uri || '').split('/').pop() || 'Documento',
    uri: d.local_uri,
    type: 'document' as AIContextItemType,
    hasText: !!(d.ocr_text && d.ocr_text.length > 0),  // ← Key indicator
    rawItem: d,  // ← Preserve original for later queries
  }));
}

// For Photos
export function mapPhotos(photos: any[]): AIContextItemData[] {
  return photos.map((p, i) => ({
    id: `photo_${p.id ?? i}`,
    label: (p.local_uri || '').split('/').pop() || 'Foto',
    uri: p.local_uri,
    type: 'photo' as AIContextItemType,
    hasText: !!(p.ocr_text && p.ocr_text.length > 0),  // ← Checks OCR text
    rawItem: p,
  }));
}

// For Audio & Video (Transcripts)
export function mapRecordings(recordings: RecordingItem[]): AIContextItemData[] {
  return recordings.map((r, i) => ({
    id: `rec_${r.id_string || r.id || i}`,
    label: r.name || 'Grabación',
    type: 'recording' as AIContextItemType,
    hasText: !!(
      (r.transcript_uri && r.transcript_uri.length > 0) ||
      (r.transcript_text && r.transcript_text.length > 0)
    ),
    rawItem: r,
  }));
}

export function mapVideos(videos: YouTubeVideo[]): AIContextItemData[] {
  return videos.map((v, i) => ({
    id: `vid_${v.id ?? i}`,
    label: v.title || 'Video de YouTube',
    thumbnailUrl: v.thumbnail_url || undefined,
    type: 'video' as AIContextItemType,
    hasText: !!(
      (v.transcript_uri && v.transcript_uri.length > 0) ||
      (v.transcript_text && v.transcript_text.length > 0)
    ),
    rawItem: v,
  }));
}
```

**Key Insight**: `hasText` is the **gateway flag** — determines if item can be used for AI context.

---

### Step 3: FAB Orchestration (SubjectAIFab.tsx)

**When User Confirms Selection**:

```typescript
const buildAndProceed = useCallback(async (
  selectedItems: AIContextItemData[],
  action: 'ask' | 'flashcards',
) => {
  // Guard: empty selection
  if (selectedItems.length === 0) {
    if (action === 'ask') {
      setBuiltContext('');  // Allow chat without context
      setIsChatVisible(true);
    }
    return;
  }

  setIsBuildingCtx(true);  // Show overlay
  
  try {
    // Transform to backend payload
    const payload = selectedItems.map(item => {
      const id = item.rawItem?.id;  // ← Extract DB ID
      
      if (!id) {
        console.warn(`[buildAIContext] Item ${item.type} missing ID`);
      }

      return {
        id: id,
        type: item.type,           // 'photo' | 'document' | 'recording' | 'video'
        label: item.label,
      };
    });

    console.log('[buildAIContext] Payload:', payload);

    // Call backend
    const result = await buildAIContext(payload);

    // Store context
    setBuiltContext(result.context);
    setBuiltContextCount(result.itemsCount);

    // Proceed with action
    if (action === 'ask') {
      setIsChatVisible(true);  // Open chat with context loaded
    } else if (action === 'flashcards') {
      onGenerateFlashcards?.(result.context, selectedItems);
    }
  } catch (err: any) {
    console.error('[SubjectAIFab] Error:', err.message);
    // Graceful fallback: open chat with empty context
    if (action === 'ask') {
      setBuiltContext('');
      setBuiltContextCount(0);
      setIsChatVisible(true);
    }
  } finally {
    setIsBuildingCtx(false);
  }
}, [onGenerateFlashcards]);
```

---

### Step 4: Backend Context Assembly (aiController.buildContext)

**Endpoint**: `POST /ai/build-context`

**Request Body**:
```javascript
{
  items: [
    { id: 123, type: 'photo', label: 'Biology notes.jpg' },
    { id: 456, type: 'document', label: 'Chapter 5.pdf' },
    { id: 789, type: 'recording', label: 'Lecture 2' },
  ]
}
```

**Core Implementation**:

```javascript
exports.buildContext = async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ 
      error: 'Se requiere un array de items para construir el contexto.' 
    });
  }

  try {
    // Process all items in parallel
    const contextPromises = items.map(async (item) => {
      let text = '';
      
      try {
        if (item.type === 'photo') {
          console.log(`[buildContext] Processing photo: id=${item.id}, label="${item.label}"`);
          
          // Query photos table for OCR text
          const photo = await new Promise((resolve, reject) => {
            db.get(
              'SELECT ocr_text, local_uri FROM photos WHERE id = ?', 
              [item.id], 
              (err, row) => {
                if (err) {
                  console.error(`[buildContext] DB error for photo_id=${item.id}:`, err.message);
                  reject(err);
                } else {
                  console.log(`[buildContext] Query result for photo_id=${item.id}:`, row);
                  resolve(row);
                }
              }
            );
          });
          
          if (photo?.ocr_text) {
            console.log(`[buildContext] Using ocr_text for photo_id=${item.id}`);
            text = `[FOTO: ${item.label}]\n${photo.ocr_text}`;
          } else {
            console.log(`[buildContext] No ocr_text for photo_id=${item.id}`);
          }
        } 
        else if (item.type === 'document') {
          // Query scanned_documents table for OCR text
          const doc = await new Promise((resolve, reject) => {
            db.get(
              'SELECT ocr_text, name FROM scanned_documents WHERE id = ?', 
              [item.id], 
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });
          
          text = doc?.ocr_text 
            ? `[DOCUMENTO: ${doc.name || item.label}]\n${doc.ocr_text}`
            : `[DOCUMENTO: ${doc?.name || item.label}] (Sin contenido de texto extraído aún)`;
        }
        else if (item.type === 'recording') {
          // Query audio_transcripts for transcript
          const transcript = await new Promise((resolve, reject) => {
            db.get(
              `SELECT transcript_text, transcript_uri FROM audio_transcripts WHERE recording_id = ?`,
              [item.id],
              (err, row) => {
                if (err) {
                  console.error(`[buildContext] DB error for recording_id=${item.id}:`, err.message);
                  reject(err);
                } else {
                  console.log(`[buildContext] Query result for recording_id=${item.id}:`, row);
                  resolve(row);
                }
              }
            );
          });

          if (transcript?.transcript_text) {
            console.log(`[buildContext] Using transcript_text for recording_id=${item.id}`);
            text = `[AUDIO: ${item.label}]\n${transcript.transcript_text}`;
          } else if (transcript?.transcript_uri) {
            // Fallback: read from file
            console.log(`[buildContext] Attempting to read file: ${transcript.transcript_uri}`);
            try {
              const fileContent = await fs.readFile(transcript.transcript_uri, 'utf8');
              text = `[AUDIO: ${item.label}]\n${fileContent}`;
            } catch (fErr) {
              console.warn(`No se pudo leer archivo de audio: ${transcript.transcript_uri}`, fErr.message);
            }
          } else {
            console.log(`[buildContext] No transcript for recording_id=${item.id}`);
          }
        }
        else if (item.type === 'video') {
          // Query youtube_transcripts for transcript
          const ytTranscript = await new Promise((resolve, reject) => {
            db.get(
              `SELECT transcript_text, transcript_uri FROM youtube_transcripts WHERE video_id = ?`,
              [item.id],
              (err, row) => {
                if (err) {
                  console.error(`[buildContext] DB error for video_id=${item.id}:`, err.message);
                  reject(err);
                } else {
                  console.log(`[buildContext] Query result for video_id=${item.id}:`, row);
                  resolve(row);
                }
              }
            );
          });

          if (ytTranscript?.transcript_text) {
            console.log(`[buildContext] Using transcript_text for video_id=${item.id}`);
            text = `[VIDEO YOUTUBE: ${item.label}]\n${ytTranscript.transcript_text}`;
          } else if (ytTranscript?.transcript_uri) {
            // Fallback: read from file
            console.log(`[buildContext] Attempting to read file: ${ytTranscript.transcript_uri}`);
            try {
              const fileContent = await fs.readFile(ytTranscript.transcript_uri, 'utf8');
              text = `[VIDEO YOUTUBE: ${item.label}]\n${fileContent}`;
            } catch (fErr) {
              console.warn(`No se pudo leer archivo de video: ${ytTranscript.transcript_uri}`);
            }
          } else {
            // Try to fetch from YouTube directly
            console.log(`[buildContext] No transcript cached, fetching from YouTube...`);
            // ... fetch logic ...
          }
        }
      } catch (itemErr) {
        console.error(`Error processing item ${item.id} (${item.type}):`, itemErr);
      }

      return text;
    });

    // Wait for all items to process
    const results = await Promise.all(contextPromises);
    
    // Filter out empty results and join
    const successfulItems = results.filter(t => t.length > 0);
    const finalContext = successfulItems.join('\n\n---\n\n');

    console.log(`[buildContext] Processed ${results.length} items, ${successfulItems.length} successful`);
    
    res.json({ 
      context: finalContext,
      itemsCount: successfulItems.length
    });

  } catch (err) {
    res.status(500).json({ 
      error: 'Error al construir el contexto', 
      details: err.message 
    });
  }
};
```

**Key Features**:
- ✅ Parallel processing (`Promise.all()`)
- ✅ Type-specific queries (photos → `photos.ocr_text`, docs → `scanned_documents.ocr_text`)
- ✅ Graceful degradation (missing files don't crash, just return empty string)
- ✅ Formatted output with type labels `[FOTO: ...]`, `[DOCUMENTO: ...]`, etc.
- ✅ Returns count of successful items

**Example Output**:
```
[FOTO: Biology notes.jpg]
The cellular membrane is composed of a lipid bilayer with embedded proteins...

---

[DOCUMENTO: Chapter 5.pdf]
PHOTOSYNTHESIS: THE PROCESS OF CONVERTING LIGHT ENERGY...

---

[AUDIO: Lecture 2]
Today we're going to discuss the importance of mitochondria in energy production...
```

---

### Step 5: Chat Context Usage (SubjectAIChatModal.tsx)

**Context Storage & Retrieval**:
```typescript
// From SubjectAIFab after buildContext succeeds
const [builtContext, setBuiltContext] = useState('');

// Used when sending message
const handleSendMessage = useCallback(async (text: string) => {
  try {
    // Pass context to hybrid chat function
    const data = await sendHybridChatMessage(
      builtContext,           // ← Full assembled context from buildContext
      [
        ...messages,          // ← Conversation history
        { role: 'user', content: text }  // ← New user message
      ],
      sessionId,
      provider
    );
    
    // Append AI response to conversation
    setMessages(prev => [...prev, { role: 'assistant', content: data.reply.content }]);
  } catch (error) {
    // Error handling
  }
}, [builtContext, messages, sessionId, provider]);
```

**Chat Header Shows Context Count**:
```typescript
{/* Chip showing active context */}
<View style={chipStyle}>
  <Text style={chipText}>
    {builtContextCount} {builtContextCount === 1 ? 'archivo' : 'archivos'} en contexto
  </Text>
</View>
```

---

## OCR Text Field Analysis

### Where OCR Text Comes From

#### 1. **Photo Capture** (PhotoCaptureModal)
```typescript
// Capture photo
const photo = await takePhotoAsync();

// Extract text (hybrid — offline-first)
let ocrText = await extractTextFromImageHybrid(photo.base64);

// Save to database (mobile)
await addPhotoToGallery({
  uri: photo.uri,
  ocr_text: ocrText,  // ← Stored immediately
  subject_id,
  user_id,
});
```

#### 2. **Document Scanner** (DocumentScannerModal)
```typescript
// Scan document
const document = await captureDocumentAsync();

// Extract text based on format
let ocrText = '';
if (documentFormat === 'pdf') {
  ocrText = await extractTextFromPDFHybrid(document.base64);
} else {
  ocrText = await extractTextFromImageHybrid(document.base64);
}

// Save to database
await createScannedDocument({
  uri: document.uri,
  ocr_text: ocrText,  // ← Stored immediately
  name: 'Scanned Doc',
  subject_id,
  user_id,
});
```

#### 3. **Manual Re-analysis** (SubjectDocumentsList.tsx)
```typescript
const handleReanalyzeDocument = async (docId: string) => {
  let ocrText = '';
  
  try {
    const fileContent = await readFileAsBase64(docUri);
    
    if (fileType === 'pdf') {
      ocrText = await extractTextFromPDFHybrid(fileContent);
    } else {
      ocrText = await extractTextFromImageHybrid(fileContent);
    }
    
    if (!ocrText) {
      toast.error('No text extracted');
      return;
    }
    
    // Update document with new OCR text
    await updateScannedDocument(docId as any, { 
      ocr_text: ocrText  // ← Updated in DB
    });
    
    toast.success('Document analyzed');
  } catch (error) {
    // Error handling
  }
};
```

### Where OCR Text is Used

#### 1. **Gallery Search & Filtering** (useGallery.ts)
```typescript
const handleSearch = useCallback((query: string) => {
  const q = query.toLowerCase();
  return photos.filter(p => 
    p.name?.toLowerCase().includes(q) ||
    p.ocr_text?.toLowerCase().includes(q)  // ← Search within OCR text
  );
}, [photos]);

const handleFilterByTab = useCallback((filterTab: string) => {
  if (filterTab === 'ocr') {
    return photos.filter(p => !!p.ocr_text);  // ← Show only photos with OCR
  }
  return photos;
}, [photos]);
```

#### 2. **AI Context Building** (aiController.buildContext)
```javascript
// Query photo OCR text
const photo = await new Promise((resolve, reject) => {
  db.get('SELECT ocr_text, local_uri FROM photos WHERE id = ?', [item.id], 
    (err, row) => { if (err) reject(err); else resolve(row); });
});

if (photo?.ocr_text) {
  text = `[FOTO: ${item.label}]\n${photo.ocr_text}`;
}

// Query document OCR text
const doc = await new Promise((resolve, reject) => {
  db.get('SELECT ocr_text, name FROM scanned_documents WHERE id = ?', [item.id], 
    (err, row) => { if (err) reject(err); else resolve(row); });
});

text = doc?.ocr_text 
  ? `[DOCUMENTO: ${doc.name || item.label}]\n${doc.ocr_text}`
  : `[DOCUMENTO: ...] (No text extracted)`;
```

#### 3. **UI Validation & Indicators** (aiContextMappers.ts)
```typescript
// Mark item as having text
hasText: !!(d.ocr_text && d.ocr_text.length > 0)

// Used in modal to warn if missing
const { status, items } = checkTextReadiness(selected);
if (status === 'some_empty') {
  showToast('⚠️ Some documents need OCR analysis before using as context');
}
```

### Database Schema

```sql
-- Photos table
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  local_uri TEXT,
  ocr_text TEXT,  -- ← Key field: OCR extracted text
  created_at DATETIME,
  updated_at DATETIME,
  ...
);

-- Scanned documents table
CREATE TABLE scanned_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  name TEXT,
  local_uri TEXT,
  ocr_text TEXT,  -- ← Key field: OCR extracted text
  created_at DATETIME,
  updated_at DATETIME,
  ...
);

-- Audio transcripts table
CREATE TABLE audio_transcripts (
  id TEXT PRIMARY KEY,
  recording_id TEXT UNIQUE NOT NULL,
  transcript_text TEXT,  -- ← Inline transcript
  transcript_uri TEXT,   -- ← File path as fallback
  ...
);

-- YouTube transcripts table
CREATE TABLE youtube_transcripts (
  id TEXT PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  transcript_text TEXT,  -- ← Inline transcript
  transcript_uri TEXT,   -- ← File path as fallback
  ...
);
```

---

## Offline vs Online Processing

### Context Building Endpoint

| Aspect | Behavior |
|--------|----------|
| **Location** | Always backend (cloud) |
| **Network Dependency** | Requires connection to backend |
| **Data Source** | Local DB (populated via sync) |
| **Processing** | Server-side query + assembly |
| **Offline Support** | ❌ NO |

**Key Point**: The `buildAIContext` endpoint is **not hybrid**. It always runs on the backend.

However, the **data** it reads (ocr_text) is generated offline on the mobile client using local OCR services.

### Document Upload Processing (processDocumentUploadHybrid)

| Aspect | Offline | Online |
|--------|---------|--------|
| **Text Extraction** | ✅ Local (MLKit OCR) | ✅ Local (MLKit OCR) |
| **Analysis** | ✅ Local LLM (if available) | ✅ Gemini/Groq cloud |
| **Fallback** | Return raw extracted text | N/A |
| **Network Requirement** | ❌ NO | ✅ YES for analysis |

**Implementation**:
```typescript
export async function processDocumentUploadHybrid(
  file: { uri: string; name: string; type: string },
  prompt: string,
): Promise<{ result: string; fileName: string; fileSize: string }> {
  const resolved = await resolveProvider();

  // 1. ALWAYS extract text locally (offline-first)
  const FileSystem = require('expo-file-system/legacy');
  const fileContent = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  let text = '';
  if (file.type?.includes('pdf')) {
    const { extractTextFromPdfLocal } = require('./localPDFService');
    text = await extractTextFromPdfLocal(fileContent);
  } else {
    const { extractTextFromImageLocal } = require('./localOCRService');
    text = await extractTextFromImageLocal(fileContent);
  }

  if (!text || !text.trim()) {
    throw new Error('No se pudo extraer texto del documento localmente.');
  }

  const fileSizeKB = Math.round((fileContent.length * 3) / 4 / 1024);

  // 2. Try to analyze with LLM (can be local or cloud)
  if (!resolved) {
    // No provider available → return raw text as fallback
    return {
      result: `[Texto extraído sin análisis (Offline)]\n\n${text}`,
      fileName: file.name,
      fileSize: `${fileSizeKB} KB`,
    };
  }

  // Send extracted text to hybrid chat for analysis
  const chatResponse = await sendHybridChatMessage(
    text, 
    [{ role: 'user', content: prompt }]
  );

  return {
    result: chatResponse?.reply?.content || `[Texto extraído]\n\n${text}`,
    fileName: file.name,
    fileSize: `${fileSizeKB} KB`,
  };
}
```

### Chat Context Usage (sendHybridChatMessage)

| Mode | Provider | Network | Uses Context |
|------|----------|---------|--------------|
| **Online** | Groq/Gemini | ✅ Required | ✅ Yes |
| **Offline (Forced)** | Local LLM | ❌ Not needed | ✅ Yes |
| **Offline (No Model)** | None | ❌ Not needed | ❌ No |

**Implementation**:
```typescript
export async function sendHybridChatMessage(
  contextText: string,
  messages: any[],
  sessionId?: number,
  provider?: LLMProvider,
  onStreamToken?: (token: string) => void,
) {
  const baseResolved = await resolveProvider();  // ← Checks forceOfflineMode
  const resolved = baseResolved === 'local' ? 'local' : (provider || baseResolved);

  if (!resolved) {
    throw new Error('No internet and no local model. Enable a model in Settings.');
  }

  if (resolved === 'local') {
    // Use local LLM with same context
    await ensureLocalModel();
    const prompt = buildChatPrompt(messages, contextText);  // ← Context included
    
    const result = await runInference({
      prompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    return {
      reply: { content: result.text },
      model: `local:${result.modelName}`,
      tokensPerSecond: result.tokensPerSecond,
    };
  }

  // Send to cloud with context
  return cloudSendChat(contextText, messages, sessionId, resolved);  // ← contextText passed
}
```

### LLM Provider Resolution (llmProviderManager.ts)

```typescript
/**
 * Resolves provider respecting forceOfflineMode
 */
export async function resolveProvider(): Promise<LLMProvider> {
  const offline = useLocalAIStore.getState().forceOfflineMode;  // ← Key gate
  
  if (offline) {
    // Force offline mode ignores all preferences
    return 'local';
  }
  
  // Otherwise use stored preference or default
  return getPreferredLLMProvider();
}
```

---

## Detailed Code Flow

### Complete Flow: User Selects Documents → AI Chat

```
┌─ USER SELECTS DOCUMENTS IN MODAL ──────────────────────────────┐
│                                                                  │
│  SubjectAIContextModal.handleAsk()                              │
│    ├─ Gets selected items from state                            │
│    ├─ Validates with checkTextReadiness()                       │
│    ├─ Shows warning if some missing text                        │
│    └─ Calls onAskQuestions(selectedItems)                       │
│                                                                  │
│  SubjectAIFab.buildAndProceed('ask')                            │
│    ├─ Hides modal                                               │
│    ├─ Shows "Analyzing files..." overlay                        │
│    ├─ Maps selectedItems to payload:                            │
│    │   {                                                         │
│    │     id: item.rawItem.id,  (123, 456, ...)                 │
│    │     type: item.type,      ('photo', 'document', ...)      │
│    │     label: item.label                                      │
│    │   }                                                         │
│    └─ Calls buildAIContext(payload)                             │
│                                                                  │
│  ai.ts::buildAIContext()                                        │
│    └─ POST /ai/build-context with { items: [...] }             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌─ BACKEND PROCESSES CONTEXT ────────────────────────────────────┐
│                                                                  │
│  aiController.buildContext(req, res)                            │
│    ├─ Receives: { items: [{ id, type, label }, ...] }         │
│    ├─ For each item in parallel:                                │
│    │                                                             │
│    │  if type === 'photo'                                       │
│    │    └─ SELECT ocr_text FROM photos WHERE id = ?            │
│    │                                                             │
│    │  if type === 'document'                                    │
│    │    └─ SELECT ocr_text FROM scanned_documents WHERE id = ?  │
│    │                                                             │
│    │  if type === 'recording'                                   │
│    │    └─ SELECT transcript_text FROM audio_transcripts ...   │
│    │                                                             │
│    │  if type === 'video'                                       │
│    │    └─ SELECT transcript_text FROM youtube_transcripts ...  │
│    │                                                             │
│    │  Append to text: "[TYPE: label]\n<text>"                  │
│    │                                                             │
│    ├─ Join all with "\n\n---\n\n"                              │
│    └─ Return: { context: string, itemsCount: number }           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌─ CLIENT RECEIVES & STORES CONTEXT ────────────────────────────┐
│                                                                  │
│  SubjectAIFab.buildAndProceed()                                 │
│    ├─ result.context → setBuiltContext()                       │
│    ├─ result.itemsCount → setBuiltContextCount()               │
│    ├─ setIsChatVisible(true)                                    │
│    └─ Hide overlay                                              │
│                                                                  │
│  SubjectAIChatModal opens with context loaded                  │
│    └─ Shows: "3 archivos en contexto"                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌─ USER SENDS MESSAGE TO ZYREN ─────────────────────────────────┐
│                                                                  │
│  SubjectAIChatModal.handleSendMessage()                         │
│    ├─ newMessage = { role: 'user', content: userText }         │
│    ├─ messages = [...previousMessages, newMessage]             │
│    └─ Calls sendHybridChatMessage(                              │
│        builtContext,   // ← Full context text assembled!       │
│        messages,       // ← Conversation history                │
│        sessionId,      // ← Optional                             │
│        provider        // ← Resolved from forceOfflineMode      │
│      )                                                           │
│                                                                  │
│  hybridAIService.sendHybridChatMessage()                        │
│    ├─ Resolve provider (local vs cloud)                         │
│    ├─ If local:                                                 │
│    │   ├─ Build prompt with context                             │
│    │   ├─ Run local inference                                   │
│    │   └─ Return result                                         │
│    └─ If cloud:                                                 │
│        └─ Call api.sendAIChatMessage(contextText, messages)    │
│                                                                  │
│  api.sendAIChatMessage()                                        │
│    └─ POST /ai/chat { context_text, messages, provider }       │
│                                                                  │
│  Backend aiController.chat()                                    │
│    ├─ Receives: { context_text, messages, ... }                │
│    ├─ Builds system prompt with context                         │
│    ├─ Calls LLM (Groq or Gemini)                               │
│    └─ Returns: { reply: { content: ... } }                     │
│                                                                  │
│  Response returned to client                                    │
│    └─ Append to messages                                        │
│    └─ Display in chat bubble                                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### AIContextItemData Interface

```typescript
export interface AIContextItemData {
  id: string;                    // Unique identifier for UI ('doc_123', 'photo_456')
  label: string;                 // Display name ('Chapter 5.pdf', 'Notes.jpg')
  uri?: string;                  // Local file URI for thumbnails
  thumbnailUrl?: string;         // YouTube thumbnail URL
  type: AIContextItemType;       // 'document' | 'photo' | 'recording' | 'video'
  hasText?: boolean;             // true if ocr_text/transcript exists
  rawItem?: any;                 // Original entity (for extracting DB ID)
}

export type AIContextItemType = 'document' | 'photo' | 'recording' | 'video';
```

### Backend Payload

```typescript
interface BuildContextPayload {
  items: Array<{
    id: string | number;       // Database ID (not mapped ID)
    type: 'photo' | 'document' | 'recording' | 'video';
    label: string;             // For formatting output
  }>;
}

interface BuildContextResponse {
  context: string;             // Assembled context text
  itemsCount: number;          // Count of successful items
}
```

### Chat Message Format

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequestPayload {
  context_text: string;        // Full context from buildContext
  messages: ChatMessage[];     // Conversation history
  session_id?: number;         // Optional session tracking
  provider: 'groq' | 'gemini' | 'local';
}

interface ChatResponse {
  reply: {
    content: string;           // AI response text
  };
  model: string;               // Model name used
  tokensPerSecond?: number;    // TPS for local inference
}
```

---

## Critical Gaps & Observations

### 1. **Context Building is Cloud-Only**
- ❌ No offline fallback for `buildAIContext`
- ✅ But data (ocr_text) is generated offline
- 📝 Consider: Add local assembly option if needed offline context

### 2. **No Retry Logic in buildAIContext**
- ❌ Single query per item; no retry on transient failure
- 📝 Consider: Add exponential backoff for flaky connections

### 3. **Missing Items are Silent**
- ✅ Item with no ocr_text just returns empty string
- ✅ Doesn't break the whole request
- 📝 Frontend shows warning if text missing, so UX is aware

### 4. **Document Search Uses LIKE (Performance Risk)**
- ❌ `p.ocr_text?.toLowerCase().includes(q)` in JavaScript
- 📝 Consider: Move to SQL LIKE for large OCR texts

### 5. **No Versioning of OCR Text**
- ❌ When document is re-analyzed, old ocr_text is overwritten
- 📝 Consider: Keep version history for audit trail

### 6. **Transcript Caching for YouTube**
- ✅ Smart fallback: cache after fetching
- ⚠️ But no TTL — cached forever until manual refresh

### 7. **No Streaming of Context**
- ❌ All context assembled at once on backend
- 📝 Consider: Stream large contexts for UX responsiveness

### 8. **forceOfflineMode Only Affects LLM, Not Context**
- ✅ But users may expect context building to work offline
- 📝 Current behavior: context requires backend, but LLM can be local
- 📝 Document extraction itself is hybrid (works offline)

---

## Summary Table

| Component | Location | Offline | Input | Output | Key Behavior |
|-----------|----------|---------|-------|--------|--------------|
| **Mapping** | Client | ✅ Yes | Raw entities | AIContextItemData[] | Checks `hasText` flag |
| **Selection Modal** | Client | ✅ Yes | Mapped items | Selected items | Validates with `checkTextReadiness()` |
| **FAB Orchestrator** | Client | ✅ Yes | Selected items | Backend payload | Transforms to { id, type, label } |
| **buildAIContext** | Backend | ❌ NO | Item IDs | Context string | Queries database, formats output |
| **Chat Modal** | Client | ✅ Yes | Context + messages | LLM input | Displays context count |
| **sendHybridChatMessage** | Client/Backend | ⚠️ Hybrid | Context + messages | AI response | Routes based on `forceOfflineMode` |
| **processDocumentUploadHybrid** | Client/Backend | ✅ Mostly | File | Analyzed text | OCR local, analysis hybrid |

---

## Recommendations

1. **Add Offline Context Assembly**: Implement client-side context building for emergency offline chat
2. **Add buildContext Retry Logic**: Handle transient network failures gracefully
3. **Cache buildContext Results**: Store last successful context to enable offline access
4. **Add SQL Indexes**: Index `ocr_text` for faster searches on large datasets
5. **Implement OCR Text Versioning**: Keep history for debugging and rollback
6. **Add Streaming**: Stream large contexts to improve perceived performance
7. **Document Extraction Rate Limiting**: Prevent OCR bombs with size limits

---

**End of Analysis**


---
**Tags:** #ai_zyren #domains/ai_zyren
