# AI Assistant Chat: File Content Flow Analysis

## Overview
This document traces how the Zyren assistant chat reads and passes content from selected files to the backend AI service.

---

## 1. HOW SubjectAIChatModal RECEIVES SELECTED FILES AND THEIR CONTENT

### File: [mobile/src/components/SubjectAIChatModal.tsx](mobile/src/components/SubjectAIChatModal.tsx)

**Key Point:** SubjectAIChatModal does NOT directly receive individual files or their content. Instead, it receives **pre-assembled context text** from its parent component.

```tsx
// Lines 42-48: Interface definition
export interface SubjectAIChatModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjectName: string;
  contextText: string;              // ← PRE-BUILT TEXT (not raw files)
  contextItemCount: number;         // ← Number of items that contributed
}

// Lines 120-124: Component receives context as prop
export const SubjectAIChatModal: React.FC<SubjectAIChatModalProps> = ({
  isVisible, onClose, subjectName, contextText, contextItemCount,
}) => {
```

**Flow:**
1. User opens SubjectAIChatModal with already-built `contextText`
2. This text is passed directly to `sendAIChatMessage()` function
3. Modal does NOT read files - it just manages the conversation UI

---

## 2. WHERE TRANSCRIPT_URI CONTENT IS READ FROM RECORDINGS/VIDEOS

### File: [backend/controllers/aiController.js](backend/controllers/aiController.js#L76-L190)

**Function:** `buildContext()` - This is where ALL file content is extracted and assembled.

### 2.1 AUDIO RECORDINGS TRANSCRIPTS

```javascript
// Lines 93-111: Reading audio transcripts
else if (item.type === 'recording') {
  // Obtener transcripción de audio
  const transcript = await new Promise((resolve, reject) => {
    db.get(`
      SELECT transcript_text, transcript_uri 
      FROM audio_transcripts 
      WHERE recording_id = ?
    `, [item.id], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });

  if (transcript?.transcript_text) {
    // Prefer inline text from database
    text = `[AUDIO: ${item.label}]\n${transcript.transcript_text}`;
  } else if (transcript?.transcript_uri) {
    // Fallback: Try to read from file
    try {
      const fileContent = await fs.readFile(transcript.transcript_uri, 'utf8');
      text = `[AUDIO: ${item.label}]\n${fileContent}`;
    } catch (fErr) {
      console.warn(`No se pudo leer archivo de audio: ${transcript.transcript_uri}`);
    }
  }
}
```

**Key Points:**
- ✅ First checks `audio_transcripts.transcript_text` (inline in database)
- ✅ Falls back to `audio_transcripts.transcript_uri` (file path) if text is null
- ✅ Reads file using `fs.readFile(transcript.transcript_uri, 'utf8')`
- ✅ Wraps with label: `[AUDIO: label_name]\n{text}`

**Database Tables Involved:**
- `audio_transcripts` - columns: `transcript_text`, `transcript_uri`

---

### 2.2 YOUTUBE VIDEO TRANSCRIPTS

```javascript
// Lines 113-162: Reading YouTube transcripts
else if (item.type === 'video') {
  // 1. Buscar transcript cacheado en la BD
  const ytTranscript = await new Promise((resolve, reject) => {
    db.get(`
      SELECT transcript_text, transcript_uri 
      FROM youtube_transcripts 
      WHERE video_id = ?
    `, [item.id], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });

  if (ytTranscript?.transcript_text) {
    // Case 1: Inline text in database (ideal - zero cost)
    text = `[VIDEO YOUTUBE: ${item.label}]\n${ytTranscript.transcript_text}`;
  } else if (ytTranscript?.transcript_uri) {
    // Case 2: Fallback - read from file
    try {
      const fileContent = await fs.readFile(ytTranscript.transcript_uri, 'utf8');
      text = `[VIDEO YOUTUBE: ${item.label}]\n${fileContent}`;
    } catch (fErr) {
      console.warn(`No se pudo leer archivo de video: ${ytTranscript.transcript_uri}`);
    }
  } else {
    // Case 3: No cached transcript - fetch live captions from YouTube API
    try {
      const ytVideo = await new Promise((resolve, reject) => {
        db.get('SELECT video_id FROM youtube_videos WHERE id = ?', [item.id], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });

      if (ytVideo?.video_id) {
        const captionRes = await fetch(
          `http://localhost:${process.env.PORT || 3000}/api/youtube-captions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: ytVideo.video_id }),
          }
        );

        if (captionRes.ok) {
          const captionData = await captionRes.json();
          if (captionData.captions) {
            text = `[VIDEO YOUTUBE: ${item.label}]\n${captionData.captions}`;
            // Cache for next time
            db.run(
              `INSERT OR REPLACE INTO youtube_transcripts (video_id, transcript_text)
               VALUES (?, ?)
               ON CONFLICT(video_id) DO UPDATE SET transcript_text = excluded.transcript_text`,
              [item.id, captionData.captions],
              (saveErr) => { if (saveErr) console.warn('No se pudo cachear transcript de YouTube:', saveErr.message); }
            );
          }
        }
      }
    } catch (captionErr) {
      console.warn(`No se pudieron obtener captions para video ${item.id}:`, captionErr.message);
    }
  }
}
```

**Key Points:**
- ✅ Three-tier fallback system:
  1. Check `youtube_transcripts.transcript_text` (inline)
  2. Fall back to `youtube_transcripts.transcript_uri` (file)
  3. Fetch live captions from YouTube API and cache them
- ✅ Wraps with label: `[VIDEO YOUTUBE: label_name]\n{text}`
- ✅ **IMPORTANT:** Calls `/api/youtube-captions` endpoint if no cached transcript

**Database Tables Involved:**
- `youtube_transcripts` - columns: `transcript_text`, `transcript_uri`
- `youtube_videos` - columns: `video_id`

---

## 3. HOW CONTEXT IS BUILT AND SENT TO AI BACKEND

### 3.1 CONTEXT BUILDING FLOW

**Step 1: User selects files in UI**

File: [mobile/src/components/SubjectAIFab.tsx](mobile/src/components/SubjectAIFab.tsx#L125-L155)

```tsx
// User taps "Ask Questions" or "Flashcards"
const buildAndProceed = useCallback(async (
  selectedItems: AIContextItemData[],
  action: 'ask' | 'flashcards',
) => {
  // Convert selected items to simple payload
  const payload = selectedItems.map(item => ({
    id:    item.rawItem?.id ?? item.id,
    type:  item.type,                    // 'photo', 'recording', 'video', 'document'
    label: item.label,
  }));

  // Call backend to build context
  const result = await buildAIContext(payload);

  setBuiltContext(result.context);
  setBuiltContextCount(result.itemsCount);

  if (action === 'ask') {
    setIsChatVisible(true);              // Open chat with built context
  } else if (action === 'flashcards') {
    onGenerateFlashcards?.(result.context, selectedItems);
  }
}, [onGenerateFlashcards]);
```

**Step 2: Mobile service calls backend**

File: [mobile/src/services/api/ai.ts](mobile/src/services/api/ai.ts#L28-L51)

```typescript
export const buildAIContext = async (
  items: { id: string | number; type: string; label: string }[]
) => {
  try {
    const response = await fetchWithFallback('/ai/build-context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),    // ← Just IDs and types
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al construir el contexto de IA');
    }
    return data as { context: string; itemsCount: number };
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al construir el contexto');
  }
};
```

**Step 3: Backend retrieves and assembles content**

File: [backend/controllers/aiController.js](backend/controllers/aiController.js#L68-L190)

```javascript
exports.buildContext = async (req, res) => {
  const { items } = req.body; // Array of { id, type, label }

  try {
    const contextPromises = items.map(async (item) => {
      let text = '';
      
      if (item.type === 'photo') {
        // Fetch OCR text from photos table
        const photo = await new Promise((resolve, reject) => {
          db.get('SELECT ocr_text, local_uri FROM photos WHERE id = ?', [item.id], (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });
        text = photo?.ocr_text ? `[FOTO: ${item.label}]\n${photo.ocr_text}` : '';
      }
      else if (item.type === 'recording') {
        // Fetch from audio_transcripts (see section 2.1 above)
        // ... transcript_text or transcript_uri
      }
      else if (item.type === 'video') {
        // Fetch from youtube_transcripts (see section 2.2 above)
        // ... transcript_text, transcript_uri, or live API
      }
      else if (item.type === 'document') {
        // Fetch OCR text from scanned_documents table
        const doc = await new Promise((resolve, reject) => {
          db.get('SELECT ocr_text, name FROM scanned_documents WHERE id = ?', [item.id], (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });
        text = doc?.ocr_text ? `[DOCUMENTO: ${doc.name || item.label}]\n${doc.ocr_text}` : '';
      }

      return text;
    });

    const results = await Promise.all(contextPromises);
    const finalContext = results.filter(t => t.length > 0).join('\n\n---\n\n');

    res.json({ 
      context: finalContext,
      itemsCount: results.filter(t => t.length > 0).length
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al construir el contexto', details: err.message });
  }
};
```

**Final Format of Built Context:**
```
[FOTO: Photo Label]
OCR text from photo...

---

[AUDIO: Recording Label]
Transcript text from audio...

---

[VIDEO YOUTUBE: Video Label]
Caption text from YouTube...

---

[DOCUMENTO: Document Label]
OCR text from scanned document...
```

---

### 3.2 SENDING CONTEXT TO AI CHAT

**File:** [mobile/src/services/api/ai.ts](mobile/src/services/api/ai.ts#L1-L27)

```typescript
export const sendAIChatMessage = async (
  contextText: string,        // Pre-built context from buildAIContext
  messages: any[]              // Chat history: [{ role, content }, ...]
) => {
  try {
    const response = await fetchWithFallback('/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_text: contextText,    // ← Full assembled context
        messages: messages,           // ← Chat history
      }),
    });
    
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al comunicarse con la IA');
    }
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar chatear con la IA');
  }
};
```

---

## 4. FUNCTIONS THAT CONSTRUCT PROMPTS WITH FILE CONTENT

### 4.1 CHAT PROMPT CONSTRUCTION

**File:** [backend/controllers/aiController.js](backend/controllers/aiController.js#L1-L65)

**Function:** `aiChat()`

```javascript
exports.aiChat = async (req, res) => {
  const { context_text, messages } = req.body;

  // Build system prompt with user's context
  const systemMessage = {
    role: 'system',
    content: `Eres "Zyren", un tutor académico personal experto y paciente. 
Tu objetivo es responder a las preguntas del estudiante basándote PRINCIPALMENTE en el siguiente material de sus clases (transcripciones, apuntes, documentos).

REGLAS:
1. Usa el contexto proporcionado para fundamentar tus respuestas.
2. Si la respuesta a la pregunta no se encuentra en el contexto, puedes usar tu conocimiento general para ayudar al estudiante, pero debes aclarar que esa información extra no proviene de sus apuntes.
3. Sé didáctico, claro y estructurado (usa viñetas si es necesario).
4. Mantén un tono alentador y profesional.

--- CONTEXTO DE LA MATERIA ---
${context_text || 'El estudiante no proporcionó contexto específico para esta consulta.'}
------------------------------`
  };

  // Combine system message with user's chat history
  const apiMessages = [systemMessage, ...messages];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: apiMessages,        // ← System + context + chat history
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    const groqData = await response.json();
    const reply = groqData.choices[0].message;

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Error en el chat de IA', details: err.message });
  }
};
```

**How Context is Used:**
- ✅ **Context is DIRECTLY INJECTED into the system prompt** (line 26: `${context_text}`)
- ✅ Instructions tell AI to use context as the primary source
- ✅ User messages combined with system message and sent to Groq API

---

### 4.2 FLASHCARD GENERATION PROMPT

**File:** [backend/controllers/aiController.js](backend/controllers/aiController.js#L202-L280)

**Function:** `generateFlashcards()`

```javascript
exports.generateFlashcards = async (req, res) => {
  const { context_text, count = 10 } = req.body;

  // Trim context if too large
  const trimmedContext = context_text.length > 80000
    ? context_text.substring(0, 80000) + '\n[...contexto truncado por longitud]'
    : context_text;

  const systemPrompt = `Eres un experto pedagogo universitario. Tu tarea es generar exactamente ${count} flashcards de estudio a partir del material académico proporcionado.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional, sin markdown, sin explicaciones.
2. Cada elemento del array debe tener exactamente dos campos: "front" (pregunta o concepto) y "back" (respuesta o definición).
3. Las preguntas deben ser precisas y directas. Las respuestas, concisas pero completas.
4. Cubre los conceptos más importantes del material. Evita preguntas triviales.
5. Formato exacto requerido: [{"front": "...", "back": "..."}, ...]

Ejemplo de respuesta válida:
[{"front": "¿Qué es la fotosíntesis?", "back": "Proceso por el cual las plantas convierten luz solar en glucosa usando CO₂ y agua."}]`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera ${count} flashcards a partir de este material:\n\n${trimmedContext}` },
          //                                                                           ↑ Context embedded here
        ],
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    const groqData = await response.json();
    const rawContent = groqData.choices?.[0]?.message?.content || '{}';

    // Parse JSON response
    let flashcards = [];
    try {
      const parsed = JSON.parse(rawContent);
      flashcards = Array.isArray(parsed)
        ? parsed
        : (parsed.flashcards || parsed.cards || parsed.data || []);
    } catch (parseErr) {
      return res.status(500).json({ error: 'El modelo no retornó un JSON válido.' });
    }

    res.json({ flashcards, count: flashcards.length });
  } catch (err) {
    res.status(500).json({ error: 'Error generando flashcards', details: err.message });
  }
};
```

**How Context is Used:**
- ✅ **Context is truncated to 80k characters** to avoid exceeding token limits
- ✅ **Context is embedded in user message** (line 255: `${trimmedContext}`)
- ✅ **Strict JSON format rules** ensure parseable output

---

## 5. TRANSCRIPT TEXT IS BEING READ AND INCLUDED IN MESSAGES

### ✅ YES - Transcript text IS being read and included

**Evidence:**

1. **Audio Transcripts:**
   - Location: [aiController.js lines 99-111](backend/controllers/aiController.js#L99-L111)
   - ✅ Reads `transcript_text` from `audio_transcripts` table
   - ✅ Falls back to reading `transcript_uri` file if text is null
   - ✅ Formats as: `[AUDIO: label]\n{transcript_text}`

2. **YouTube Video Transcripts:**
   - Location: [aiController.js lines 118-162](backend/controllers/aiController.js#L118-L162)
   - ✅ Reads `transcript_text` from `youtube_transcripts` table
   - ✅ Falls back to reading `transcript_uri` file
   - ✅ Fetches live captions from YouTube API if not cached
   - ✅ Caches for future use
   - ✅ Formats as: `[VIDEO YOUTUBE: label]\n{transcript_text}`

3. **Included in Final Context:**
   - Location: [aiController.js lines 187-195](backend/controllers/aiController.js#L187-L195)
   - ✅ All transcript text joined together with `---` separators
   - ✅ Sent to AI backend in `context_text` field
   - ✅ Embedded in system prompt for chat
   - ✅ Embedded in user message for flashcards

---

## COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SubjectAIFab.tsx                                              │
│  ├─ User selects files (photos, recordings, videos, docs)      │
│  └─ Calls buildAIContext([{ id, type, label }])               │
│                         │                                       │
│                         ▼                                       │
│  mobile/src/services/api/ai.ts                                 │
│  └─ sendAIChatMessage(contextText, messages)                  │
│     ├─ POST /ai/build-context    (step 1: build context)      │
│     └─ POST /ai/chat              (step 2: send to AI)         │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP POST
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js/Express)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  backend/controllers/aiController.js                            │
│  ├─ buildContext()                                             │
│  │  ├─ For each item (photo, recording, video, document):      │
│  │  │  ├─ photo → SELECT ocr_text FROM photos               │
│  │  │  ├─ recording → SELECT transcript_text FROM audio_... │
│  │  │  │              or read from transcript_uri            │
│  │  │  ├─ video → SELECT transcript_text FROM youtube_... │
│  │  │  │           or read from transcript_uri              │
│  │  │  │           or fetch from YouTube API               │
│  │  │  └─ document → SELECT ocr_text FROM scanned_docs     │
│  │  │                                                        │
│  │  └─ Join all text: "[TYPE: label]\ntext\n---\n..."     │
│  │     Return: { context, itemsCount }                      │
│  │                                                           │
│  └─ aiChat()                                                │
│     ├─ Receive: context_text, messages[]                    │
│     ├─ Build system prompt with context                     │
│     ├─ Combine: [systemPrompt, ...messages]                 │
│     └─ Send to Groq API (llama-3.3-70b-versatile)          │
│                                                             │
│  backend/routes/ai.js                                        │
│  ├─ POST /ai/build-context → aiController.buildContext     │
│  └─ POST /ai/chat → aiController.aiChat                    │
│                                                             │
│  Database (SQLite/PostgreSQL)                               │
│  ├─ photos.ocr_text                                         │
│  ├─ audio_transcripts.transcript_text                       │
│  ├─ audio_transcripts.transcript_uri                        │
│  ├─ youtube_transcripts.transcript_text                     │
│  ├─ youtube_transcripts.transcript_uri                      │
│  └─ scanned_documents.ocr_text                              │
│                                                             │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTP Response
                          ▼
                    { context, itemsCount }
```

---

## BACKEND ROUTES

**File:** [backend/routes/ai.js](backend/routes/ai.js)

```javascript
router.post('/ai/chat', aiController.aiChat);
router.post('/ai/build-context', aiController.buildContext);
router.post('/ai/generate-flashcards', aiController.generateFlashcards);
```

---

## SUMMARY TABLE

| Component | File | Function | Purpose |
|-----------|------|----------|---------|
| **Mobile UI** | `mobile/src/components/SubjectAIChatModal.tsx` | `SubjectAIChatModal()` | Chat interface - receives pre-built `contextText` prop |
| **Mobile UI** | `mobile/src/components/SubjectAIFab.tsx` | `buildAndProceed()` | Orchestrates context building and chat opening |
| **Mobile Service** | `mobile/src/services/api/ai.ts` | `buildAIContext()` | Calls `/api/ai/build-context` with item IDs |
| **Mobile Service** | `mobile/src/services/api/ai.ts` | `sendAIChatMessage()` | Calls `/api/ai/chat` with `context_text` + messages |
| **Backend** | `backend/controllers/aiController.js` | `buildContext()` | Reads files from DB, assembles context text |
| **Backend** | `backend/controllers/aiController.js` | `aiChat()` | Injects context into system prompt, calls Groq API |
| **Backend** | `backend/controllers/aiController.js` | `generateFlashcards()` | Embeds context in prompt for flashcard generation |
| **Backend** | `backend/routes/ai.js` | Route handlers | Maps endpoints to controller functions |

---

## KEY FINDINGS

✅ **Transcript text IS being read:**
- From `audio_transcripts.transcript_text` column
- From `audio_transcripts.transcript_uri` file path (fallback)
- From `youtube_transcripts.transcript_text` column
- From `youtube_transcripts.transcript_uri` file path (fallback)
- From YouTube API live captions (if not cached)

✅ **Transcript text IS being included in messages:**
- All transcripts assembled into single `context` string
- Context injected into system prompt for AI
- Format: `[AUDIO/VIDEO YOUTUBE: label]\n{transcript_text}`

✅ **File selection works correctly:**
- SubjectAIContextModal shows Bento Grid of files
- User selects files by type (photos, audio, videos, documents)
- Selected items passed as `{ id, type, label }` to backend
- Backend looks up full content using ID and type

✅ **Context building is robust:**
- 3-tier fallback for transcripts (inline DB text → file URI → API fetch)
- Error handling with console warnings
- Context trimmed to 80k chars to avoid token limits
- Items formatted consistently with labels and separators

---

## DATABASE SCHEMA VERIFICATION

### ✅ CONFIRMED: transcript_text columns exist

**File:** [backend/database/schema.js](backend/database/schema.js)

The actual database schema used by the application (schema.js) DOES include `transcript_text` columns:

#### audio_transcripts table:
```javascript
audio_transcripts: {
  sqlite: `
    CREATE TABLE IF NOT EXISTS audio_transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id INTEGER NOT NULL,
      transcript_uri TEXT,
      transcript_text TEXT,           // ✅ Column EXISTS
      summary_uri TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recording_id) REFERENCES audio_recordings(id) ON DELETE CASCADE
    )
  `,
  postgres: `
    CREATE TABLE IF NOT EXISTS audio_transcripts (
      id SERIAL PRIMARY KEY,
      recording_id INTEGER NOT NULL REFERENCES audio_recordings(id) ON DELETE CASCADE,
      transcript_uri TEXT,
      transcript_text TEXT,           // ✅ Column EXISTS
      summary_uri TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  columns: [
    { name: 'transcript_text', type: 'TEXT' }  // ✅ Migration ensures it's added
  ]
}
```

#### youtube_transcripts table:
```javascript
youtube_transcripts: {
  sqlite: `
    CREATE TABLE IF NOT EXISTS youtube_transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      transcript_uri TEXT,
      transcript_text TEXT,           // ✅ Column EXISTS
      summary_uri TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (video_id) REFERENCES youtube_videos(id) ON DELETE CASCADE
    )
  `,
  postgres: `
    CREATE TABLE IF NOT EXISTS youtube_transcripts (
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
      transcript_uri TEXT,
      transcript_text TEXT,           // ✅ Column EXISTS
      summary_uri TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  columns: [
    { name: 'transcript_text', type: 'TEXT' }  // ✅ Migration ensures it's added
  ]
}
```

**Note:** DATABASE_SCHEMA.sql in the root is outdated documentation. The actual schema is in backend/database/schema.js.

**Migration System:**
- File: [backend/database/migrations.js](backend/database/migrations.js)
- Uses `migrateColumnsSqlite()` and `migrateColumnsPostgres()` to automatically add missing columns to existing databases
- Ensures `transcript_text` columns are added on first backend startup

---

## POTENTIAL ISSUES TO INVESTIGATE

1. **transcript_uri might be null/incorrect paths** - If file paths are relative but app running from different directory, `fs.readFile()` will fail silently
2. **youtube-captions endpoint** - Verify `/api/youtube-captions` endpoint exists and returns `{ captions: "..." }` JSON structure
3. **File read permissions** - Ensure backend has read access to transcript files on disk
4. **Character encoding** - Transcripts read as UTF-8 - check for mojibake (garbled text) if transcripts saved in different encoding
5. **Empty transcript_text** - If transcript_text is empty string `""` instead of null, code won't fall back to file read (because of `?.transcript_text` check)
6. **YouTube caption fetching** - `/api/youtube-captions` endpoint might be missing or not caching results properly
