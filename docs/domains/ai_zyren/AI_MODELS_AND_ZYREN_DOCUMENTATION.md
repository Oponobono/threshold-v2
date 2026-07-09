# 🤖 Documentación de Modelos de IA, Transcripciones, Resúmenes y [[ZYREN_BORN|Zyren]]

**Última actualización:** Mayo 2026

---

## 📖 Tabla de Contenidos

1. [¿Por qué 2 Modelos de IA?](#1-por-qué-2-modelos-de-ia)
2. [Groq vs Gemini](#2-groq-vs-gemini-comparación-detallada)
3. [Cómo Se Usan Los Modelos](#3-cómo-se-usan-los-modelos)
4. [Sistema de Transcripción](#4-sistema-de-transcripción)
5. [Generación de Resúmenes](#5-generación-de-resúmenes)
6. [Prompts: Estructura y Restricciones](#6-prompts-estructura-y-restricciones)
7. [¿Quién es Zyren?](#7-quién-es-zyren)
8. [Flujo de Contexto](#8-flujo-de-contexto-documentos-fotos-audios-videos)
9. [Límites y Restricciones](#9-límites-y-restricciones)
10. [Extracción de Contexto](#10-extracción-de-contexto-por-tipo-de-fuente)

---

## 1. ¿Por qué 2 Modelos de IA?

### 1.1 La Estrategia Dual

Threshold implementa **2 modelos de IA complementarios** porque tienen fortalezas diferentes:

| Aspecto | Razón |
|---|---|
| **Velocidad** | Groq es 100x+ más rápido que Gemini para tareas simples |
| **Capacidad** | Gemini maneja documentos grandes (100 MB), Groq tiene límites |
| **Costo** | Groq es más económico para tareas estándar |
| **Confiabilidad** | Gemini Files [[API_DOCUMENTATION|API]] es mejor para PDFs complejos |
| **Fallback** | Si uno falla, el otro continúa |

### 1.2 Estrategia de Selección

```
┌─────────────────────────────────┐
│ Usuario solicita generar [[FLASHCARDS_COMPLETE_DOCUMENTATION|mazo]]   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ ¿Hay documento/PDF grande?      │
└─────┬─────────────────┬─────────┘
      │ SÍ              │ NO
      ▼                 ▼
   GEMINI           GROQ
   (Files API)    (Ultrarrápido)
```

---

## 2. Groq vs Gemini: Comparación Detallada

### 2.1 Groq (Modelo Principal para Chat)

**Modelo:** `llama-3.3-70b-versatile`

**Características:**
- ⚡ **Velocidad:** 300+ tokens/segundo
- 💰 **Costo:** Muy económico (~$0.0005 por 1M tokens)
- 📝 **Contexto máximo:** 8,000 caracteres (recomendado: 5,000)
- 🎯 **Mejor para:** Chat, resúmenes, flashcards simples, generación rápida
- 🔄 **Modelos soportados:**
  - `llama-3.3-70b-versatile` (Actual - recomendado)
  - `llama-3.1-405b-reasoning`
  - `mixtral-8x7b-32768`

**Casos de uso:**
```
✅ Chat en vivo con Zyren
✅ Transcripción de audio (Whisper v3)
✅ Resúmenes de documentos
✅ Generación de flashcards (<50KB texto)
✅ Formateo semántico de transcripciones
❌ Procesamiento de PDFs complejos
❌ Documentos > 100 MB
```

**Límites:**
- Max tokens: 32,768
- Rate limit: según plan
- Contexto práctico: 5,000 caracteres

**Ubicación en código:**
- [aiController.js](backend/controllers/aiController.js) - `callGroqAPI()`
- [groqHelpers.ts](mobile/src/utils/groqHelpers.ts)

### 2.2 Gemini (Modelo para Documentos Grandes)

**Modelo:** `gemini-3-flash-preview` (Mayo 2026)

**Características:**
- 🚀 **Velocidad:** ~50 tokens/segundo (más lento pero suficiente)
- 💵 **Costo:** Económico (~$0.075 por 1M input tokens)
- 📄 **Contexto máximo:** 1 millón de tokens (~500MB)
- 🎯 **Mejor para:** Documentos grandes, PDFs, análisis profundo, Files API
- 📎 **Files API:** Soporta uploads temporales
- 🎨 **Visión:** Puede procesar imágenes

**Casos de uso:**
```
✅ Procesamiento de documentos PDF grandes
✅ Análisis de múltiples archivos
✅ Extracción de información detallada
✅ Generación de flashcards desde documentos
✅ Procesamiento de imágenes/gráficos
✅ Chat con contexto muy largo
❌ Chat en tiempo real (demasiado lento)
```

**Límites:**
- Max tokens: 1,000,000
- Tamaño máximo de archivo: 100 MB
- Files API: uploads temporales (después se eliminan)

**Ubicación en código:**
- [geminiService.js](backend/utils/geminiService.js) - Servicio principal
- [geminiHelpers.ts](mobile/src/utils/geminiHelpers.ts)

### 2.3 Tabla Comparativa

| Criterio | Groq | Gemini |
|---|---|---|
| **Velocidad** | 300+ tok/s | ~50 tok/s |
| **Costo** | Muy bajo | Bajo |
| **Contexto** | 5K chars (práctico) | 15K chars (práctico) |
| **Documentos** | ≤ 50 KB | ≤ 100 MB |
| **Files API** | ❌ | ✅ |
| **Visión** | ❌ | ✅ |
| **Mejor para** | Chat rápido | Documentos grandes |
| **Modelo actual** | llama-3.3-70b | gemini-3-flash |

---

## 3. Cómo Se Usan Los Modelos

### 3.1 Flujo General de Chat

```javascript
Usuario → Chat Message
    ↓
Determinar Provider (Groq o Gemini)
    ↓
├─→ Si hay documento grande → GEMINI
└─→ Si no hay documento → GROQ
    ↓
Construir System Prompt (Zyren)
    ↓
Trimear contexto según límites
    ↓
Enviar a la API del provider
    ↓
Procesar respuesta
    ↓
Detectar %%DECK_ACTION%% (generación automática)
    ↓
Retornar respuesta + deck (si aplica)
```

### 3.2 Flujo de Generación de Flashcards

```javascript
Usuario → "Crea 10 flashcards sobre..."
    ↓
Zyren procesa + genera %%DECK_ACTION%%
    ↓
Backend detecta señal
    ↓
Construir contexto
    ↓
├─→ Si hay PDF grande → GEMINI
└─→ Si no hay → GROQ
    ↓
Generar flashcards (JSON array)
    ↓
Persistir en BD
    ↓
Retornar mazo al cliente
```

### 3.3 Código Principal

**Backend - aiController.js:**
```javascript
// Determinar qué provider usar
const provider = getLLMProvider(req); // 'groq' o 'gemini'

// Trimear contexto
const MAX_CONTEXT_CHARS = provider === 'gemini' ? 15000 : 5000;
const trimmedContext = truncateContext(context_text, MAX_CONTEXT_CHARS);

// Llamar al provider correcto
if (provider === 'gemini') {
  result = await callGeminiAPI(messages, systemPrompt);
} else {
  result = await callGroqAPI(messages, systemPrompt);
}
```

---

## 4. Sistema de Transcripción

### 4.1 ¿De Dónde Vienen las Transcripciones?

| Fuente | Método | Librería/API | Ubicación |
|---|---|---|---|
| **Audio grabado** | Groq Whisper API | whisper-large-v3 | Backend |
| **Videos YouTube** | YouTube Captions API | ytdl-core + noembed | Backend + Mobile |

### 4.2 Transcripción de Audios (Grabaciones)

**Flujo:**

```
Usuario graba audio
    ↓
Archivo guardado en device (m4a/mp3)
    ↓
Usuario pide transcribir
    ↓
Frontend envía archivo a backend
    ↓
Backend usa Groq Whisper v3
    ↓
Retorna texto crudo
    ↓
Groq LLaMA 3 estructura semánticamente (opcional)
    ↓
Guardar transcripción en cache
```

**Implementación:**

```typescript
// Frontend: groqHelpers.ts
export async function transcribeWithWhisper(audioUri: string, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri: audioUri, name: 'audio.m4a', type: 'audio/mp4' });
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'es');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  const rawTranscription = await response.text();
  
  // Formatear con LLaMA 3
  return await formatTranscriptionWithLlama(rawTranscription, apiKey);
}
```

**Archivo:** [groqHelpers.ts](mobile/src/utils/groqHelpers.ts) (líneas 1-127)

### 4.3 Transcripción de Videos YouTube

**Flujo:**

```
Usuario añade video de YouTube
    ↓
Backend extrae captions nativos
    ↓
├─→ Si YouTube tiene captions →  Usar captions
└─→ Si NO → Descargar audio + Whisper
    ↓
Formatear con Groq (opcional)
    ↓
Guardar para resumen/flashcards
```

**Implementación:**

```typescript
// VideoDetail.tsx - Obtener transcripción
async function getYouTubeTranscription(videoId: string): Promise<string> {
  // 1. Intentar obtener captions nativos via ytdl-core
  const info = await getInfo(videoId);
  const captions = info.videoDetails.captions;
  
  // 2. Si hay captions en español → usar directamente
  if (captions && captions.length > 0) {
    const caption = captions.find(c => c.code === 'es');
    if (caption) {
      const url = new URL(caption.baseUrl);
      const response = await fetch(url);
      const captions = await response.text(); // XML
      return parseXMLCaptions(captions);
    }
  }
  
  // 3. Si no hay captions → descargar audio + Whisper
  const audioStream = fs.createWriteStream('video.m4a');
  const download = youtubedl(videoId, { quality: '18' });
  download.pipe(audioStream);
  
  return await transcribeWithWhisper('video.m4a', apiKey);
}
```

**Archivo:** [VideoDetail.tsx](mobile/src/components/VideoDetail.tsx) (líneas 60-210)

### 4.4 Formatos Soportados

| Formato | Codec | Soporte |
|---|---|---|
| MP3 | MPEG-1 Layer III | ✅ Groq Whisper |
| MP4 | AAC | ✅ Groq Whisper |
| M4A | AAC | ✅ Groq Whisper |
| WAV | PCM | ✅ Groq Whisper |
| OGG | Vorbis | ✅ Groq Whisper |
| WebM | Opus | ✅ Groq Whisper |

---

## 5. Generación de Resúmenes

### 5.1 Tipos de Resúmenes

| Tipo | Origen | Motor | Ubicación |
|---|---|---|---|
| **Resumen de audio** | Transcripción de grabación | Groq LLaMA 3 | RecordingDetail.tsx |
| **Resumen de video** | Captions de YouTube | Groq LLaMA 3 | VideoDetail.tsx |
| **Resumen de documento** | PDF/TXT/DOCX subido | Gemini | SubjectAIChatModal.tsx |

### 5.2 Prompt del Resumen

**Sistema (aplicado a todos):**
```
Eres un asistente educativo experto especializado en crear material de estudio universitario altamente efectivo. 

Reglas:
1. Extrae conceptos fundamentales y ordénalos por temas (### títulos)
2. Usa viñetas breves para desglosar detalles
3. Resalta términos clave en **negrita**
4. Elimina "paja": titubeos, saludos, repeticiones
5. Finaliza con "Idea Central" (máximo 2 oraciones)
```

**Ejemplo de salida:**

```markdown
### Fotosíntesis

La **fotosíntesis** es el proceso mediante el cual las plantas convierten luz solar en energía química.

- **Fase luminosa:** Ocurre en los tilacoides del cloroplasto
- **Fase oscura:** Ocurre en el estroma
- **Productos:** Glucosa y oxígeno

### Importancia

- Produce el **oxígeno** que respiran los seres vivos
- Captura energía del sol
- Base de la cadena alimentaria

**Idea Central:** La fotosíntesis es el proceso fundamental que convierte energía solar en materia orgánica, siendo la base de toda vida en el planeta.
```

**Código:**

```typescript
// groqHelpers.ts
export async function summarizeWithGroq(transcription: string, apiKey: string): Promise<string> {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente educativo experto...' // (ver arriba)
      },
      {
        role: 'user',
        content: `Resume el siguiente texto:\n\n${transcription}`
      }
    ],
    temperature: 0.3, // Bajo para consistencia
  };

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  return response.json().choices[0].message.content;
}
```

**Archivo:** [groqHelpers.ts](mobile/src/utils/groqHelpers.ts) (líneas 75-127)

### 5.3 Parámetros Importantes

| Parámetro | Valor | Razón |
|---|---|---|
| **temperature** | 0.3 | Consistencia máxima (no inventar) |
| **model** | llama-3.3-70b | Velocidad y calidad |
| **max_tokens** | 2000 | Resúmenes concisos pero completos |

---

## 6. Prompts: Estructura y Restricciones

### 6.1 Sistema de Prompts (System Instruction)

**Ubicación:** [aiController.js](backend/controllers/aiController.js) (líneas 90-220)

Todos los prompts siguen una estructura estricta:

```javascript
const systemPrompt = `
IDENTIDAD:
Eres Zyren, experto en pedagogía universitaria y diseño instruccional.

MISIÓN:
Transformar contenido en material de ALTO RENDIMIENTO.

REGLAS DE ORO:
1. RIGOR: Usa terminología técnica precisa
2. NO CIRCULARIDAD: Explica el "por qué" fundamental
3. PISTAS ESTRATÉGICAS: Andamiaje cognitivo, no respuestas parciales
4. DISTRACTORES DE CALIDAD: Cada error representa un razonamiento específico
5. CONTENIDO RELACIONADO: Si el usuario pide conceptos conexos, inclúyelos
6. FORMATO DE CÓDIGO: Usa fences (```lenguaje ...\`\`\`) para código

MODO ESPECÍFICO:
[Instrucciones según el modo: flashcard, multiple_choice, boolean, mixed]

FORMATO JSON:
Responde ÚNICAMENTE con el array JSON, sin texto introductorio.
`;
```

### 6.2 Prompts por Modo

#### Mode: `flashcard`

```
Genera exactamente COUNT FLASHCARDS.
- Front: Pregunta conceptual desafiante
- Back: Respuesta precisa (máximo 2-3 oraciones)
- Hint: Pista que active el recuerdo (no letras iniciales)
- Explanation: Profundiza en el concepto

Esquema:
{
  "type": "flashcard",
  "data": { "front": "...", "back": "..." },
  "hint": "...",
  "explanation": "..."
}
```

#### Mode: `multiple_choice`

```
Genera exactamente COUNT PREGUNTAS DE SELECCIÓN MÚLTIPLE (ECAES/SABER PRO).
- Opciones: Exactamente 4 opciones con contenido ÚNICO y diferenciado
- Distractores: Deben nacer de un error de razonamiento específico
- Explanation: Explica la validez de la correcta y la falla de los distractores

Esquema:
{
  "type": "multiple_choice",
  "data": {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correctIndex": N
  },
  "hint": "...",
  "explanation": "..."
}
```

#### Mode: `boolean`

```
Genera exactamente COUNT PREGUNTAS DE VERDADERO O FALSO.
- Question: Afirmación con matices técnicos que desafíe la comprensión obvia
- Explanation: Justifica la veracidad/falsedad con un argumento sólido

Esquema:
{
  "type": "boolean",
  "data": {
    "question": "...",
    "correctAnswer": true/false
  },
  "hint": "...",
  "explanation": "..."
}
```

#### Mode: `mixed`

```
Genera exactamente COUNT ÍTEMS MIXTOS (40% Flashcard, 40% MC, 20% V/F).
Usa estrictamente los 3 esquemas según el ítem:
1. Flashcard: { "type": "flashcard", "data": { "front": "...", "back": "..." }, ... }
2. MC: { "type": "multiple_choice", "data": { "question": "...", "options": [...], "correctIndex": N }, ... }
3. V/F: { "type": "boolean", "data": { "question": "...", "correctAnswer": true/false }, ... }
```

### 6.3 Restricciones Generales de Prompts

| Restricción | Tipo | Aplicación |
|---|---|---|
| **Máx. contexto (Groq)** | Soft limit | 5,000 caracteres (si > se trimea) |
| **Máx. contexto (Gemini)** | Soft limit | 15,000 caracteres (si > se trimea) |
| **Máx. salida (Groq)** | Hard limit | 6,000 tokens (JSON) |
| **Temperature** | Sistema | 0.2 (consistencia máxima) |
| **No inventar** | Regla ORO | "Usa terminología técnica precisa del texto" |
| **Sin paráfrasis** | Regla ORO | Las explicaciones JAMÁS repiten la pregunta |
| **Código obligatorio** | Regla ORO | Si hay programación, usa fences con lenguaje |

### 6.4 Restricciones de Chats con Zyren

**Sistema:** [aiController.js](backend/controllers/aiController.js) (líneas 310-360)

```javascript
// Modo CON contexto (documentos subidos)
const systemMessage = `Eres "Zyren", un tutor académico personal experto y paciente.

INSTRUCCIONES:
- Responde ESTRICTAMENTE basándote en los materiales proporcionados
- Si la pregunta NO puede responderse con los archivos, indícalo claramente
- Sé didáctico, claro y estructurado
- Tono alentador y profesional

[Instrucciones especiales para generar mazos]
`;

// Modo SIN contexto (chat abierto)
const systemMessage = `Eres "Zyren", un tutor académico personal experto y paciente.

INSTRUCCIONES:
- El estudiante NO ha proporcionado materiales específicos
- Puedes responder abiertamente usando tu conocimiento académico general
- Explica los conceptos de forma clara y didáctica
- Adapta el nivel de complejidad según la pregunta

[Instrucciones especiales para generar mazos]
`;
```

### 6.5 Restricciones de Documentos para Gemini

**Ubicación:** [geminiService.js](backend/utils/geminiService.js) (líneas 1-260)

```javascript
// Formatos soportados nativamente
const SUPPORTED_MIMES = {
  ".pdf":  "application/pdf",           // ✅ Nativo
  ".txt":  "text/plain",                // ✅ Nativo
  ".html": "text/html",                 // ✅ Nativo
  ".md":   "text/markdown",             // ✅ Nativo
  ".docx": "...wordprocessingml...",    // ⚠️ Convertido a text/plain
  ".doc":  "application/msword",        // ⚠️ Convertido a text/plain
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// Conversión automática (DOCX/DOC → text/plain via mammoth)
```

---

## 7. ¿Quién es Zyren?

### 7.1 Identidad

**Zyren** es el **persona de IA educativa** de Threshold. No es un modelo específico, sino un **personaje/rol** que se puede implementar con cualquier modelo (Groq o Gemini).

**Características:**

```
Nombre: Zyren
Rol: Tutor académico personal
Especialidad: Pedagogía universitaria y diseño instruccional
Filosofía: "Material de ALTO RENDIMIENTO"
Nivel: Experto universitario/posgrado
Tono: Alentador, profesional, didáctico
```

### 7.2 Responsabilidades de Zyren

| Responsabilidad | Descripción |
|---|---|
| **Chat académico** | Responder preguntas basándose en materiales o conocimiento general |
| **Generación de flashcards** | Crear material de estudio de alta calidad |
| **Detección inteligente** | Saber cuándo generar mazos automáticamente |
| **Estructura pedagógica** | Aplicar Taxonomía de Bloom (Análisis/Síntesis/Evaluación) |
| **Control de calidad** | Asegurar que explicaciones sean profundas, no triviales |

### 7.3 Las "Reglas de Oro" de Zyren

```
1. RIGOR
   Usa terminología técnica precisa del texto.
   Si el usuario solicita conceptos relacionados, puedes incorporarlos
   para enriquecer el contexto académico.
   
2. NO CIRCULARIDAD
   La explicación JAMÁS debe ser una paráfrasis de la pregunta.
   Debe explicar el "por qué" fundamental.
   
3. PISTAS ESTRATÉGICAS
   El 'hint' debe ser un andamiaje cognitivo (ruta de pensamiento),
   no una respuesta parcial.
   Ejemplo ✅: "Considera el orden de operaciones"
   Ejemplo ❌: "Respuesta empieza con 'pu...'"
   
4. DISTRACTORES DE CALIDAD
   Cada opción incorrecta debe nacer de un error de razonamiento específico.
   No son aleatorios.
   Ejemplo: Confusión de términos, fórmula mal aplicada, etc.
   
5. CONTENIDO RELACIONADO
   Si detectas que el usuario solicita temas conexos,
   (ej: "incluye hantavirus" cuando el documento menciona coronavirus),
   incorpora esos temas enriqueciendo con conocimiento académico general.
   
6. FORMATO DE CÓDIGO (OBLIGATORIO SI APLICA)
   Si la evaluación involucra programación, algoritmos, comandos,
   HTML o JSON, USA SIEMPRE bloques de código Markdown.
   
   Formato: ```lenguaje
   ...código...
   ```
```

### 7.4 Detección Automática de Generación

Zyren detecta automáticamente cuándo el usuario quiere generar mazos:

```javascript
// Palabras clave que disparan generación
const generationKeywords = [
  'crea flashcards',
  'necesito preguntas',
  'examen',
  'tarjetas',
  'material de repaso',
  'preguntas de estudio',
  'verdadero o falso',
  'opción múltiple',
];

// Si detecta: genera %%DECK_ACTION%% con parámetros
// Ejemplo: %%DECK_ACTION%%{"mode":"flashcard","count":10}%%END%%
```

### 7.5 Señal de Generación: %%DECK_ACTION%%

Cuando Zyren decide generar un mazo, incluye esta señal oculta en su respuesta:

```
%%DECK_ACTION%%{"mode":"flashcard","count":10}%%END%%
```

**Parámetros:**
- `mode`: "flashcard" | "multiple_choice" | "boolean" | "mixed"
- `count`: 5-20 (recomendado)

**Ejemplo de respuesta con señal:**

```
Perfecto, voy a generar 10 flashcards sobre el tema.
%%DECK_ACTION%%{"mode":"flashcard","count":10}%%END%%

Aquí está el mazo con los conceptos clave...
```

El cliente extrae la señal, limpia la respuesta visible, y genera el mazo.

**Archivo:** [aiController.js](backend/controllers/aiController.js) (líneas 360-400)

---

## 8. Flujo de Contexto: Documentos, Fotos, Audios, Videos

### 8.1 Flujo General

```
┌──────────────────────────────────────────┐
│ Usuario sube/graba contenido             │
└─────────────┬──────────────────┬─────────┘
              │                  │
              ▼                  ▼
        Documentos/Fotos    Audio/Video
              │                  │
              ├─ PDF             ├─ Grabación
              ├─ Word            ├─ YouTube
              ├─ TXT             └─ (No procesados como tal)
              └─ Markdown
              │
              ▼
        ┌─────────────────┐
        │ Determinar tipo │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
  Pequeño      Grande       Audio/Video
  (<50KB)    (>50KB)
    │            │            │
    ▼            ▼            ▼
   GROQ        GEMINI      GROQ
   (inline)   (Files API) (Whisper/
                           Transcripción)
    │            │            │
    ▼            ▼            ▼
  Store en    Store en     Store en
  Memory      Gemini API    Cache
```

### 8.2 Documentos (PDF, Word, TXT, Markdown)

#### Subida de Documento

**Ubicación:** [SubjectAIChatModal.tsx](mobile/src/components/SubjectAIChatModal.tsx) (líneas 410-520)

```typescript
// 1. Usuario selecciona archivo
const result = await DocumentPicker.getDocumentAsync();
const file = result.assets[0];

// 2. Leer archivo
const content = await FileSystem.readAsStringAsync(file.uri);

// 3. Guardar contexto en estado local
setUploadedDocContext(content);

// 4. Guardar en AsyncStorage (cache local)
const key = `@chat_doc_${subjectId}`;
await AsyncStorage.setItem(key, JSON.stringify({
  text: content,
  timestamp: Date.now(),
}));
```

#### Procesamiento de Documento

**Para documentos pequeños:**
```javascript
// Use Groq directly
const response = await processTextInline(documentText, prompt);
```

**Para documentos grandes (Gemini Files API):**
```javascript
// 1. Detectar MIME type
const mimeType = detectMimeType(filePath);

// 2. Validar tamaño
if (fileSize > 100 * 1024 * 1024) throw Error('Demasiado grande');

// 3. Convertir si es necesario (DOCX → text/plain)
const prepared = await prepareBufferForGemini(buffer, mimeType);

// 4. Subir a Files API
const uploadResult = await fileManager.uploadFile(tempFile, {
  mimeType: prepared.mimeType
});

// 5. Procesar con Gemini
const result = await model.generateContent([
  { fileData: { fileUri: uploadResult.file.uri, mimeType: ... } },
  { text: prompt }
]);

// 6. Limpiar
await fileManager.deleteFile(uploadResult.file.name);
```

**Archivo:** [geminiService.js](backend/utils/geminiService.js) (líneas 50-180)

#### Límites

| Parámetro | Groq | Gemini |
|---|---|---|
| Tamaño máximo | ~50 KB | 100 MB |
| Contexto práctico | 5,000 caracteres | 15,000 caracteres |
| Conversión automática | ❌ | ✅ (DOCX/DOC) |

### 8.3 Fotos/Imágenes

**Nota:** Actualmente no se implementa procesamiento de imágenes en Threshold. Gemini soporta visión, pero no se usa en el MVP.

**Potencial futuro:**
```javascript
// Gemini podría procesar imágenes (gráficos, diagramas)
const imageContent = {
  fileData: {
    fileUri: 'image.jpg',
    mimeType: 'image/jpeg'
  }
};
```

### 8.4 Audios/Grabaciones

#### Flujo

```
Usuario graba audio
    ↓
Guardar en device (m4a)
    ↓
Usuario pide transcribir
    ↓
Frontend: Groq Whisper v3
    ↓
Texto crudo
    ↓
(Opcional) Formatear con Groq LLaMA 3
    ↓
Guardar en cache local
    ↓
Disponible para resúmenes/flashcards
```

#### Implementación

**Archivo:** [RecordingDetail.tsx](mobile/src/components/RecordingDetail.tsx) (líneas 60-210)

```typescript
const handleTranscribe = async () => {
  try {
    // 1. Leer audio desde el device
    const fileContent = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 2. Enviar a Groq Whisper
    const transcription = await transcribeWithWhisper(audioUri, apiKey);
    
    // 3. Guardar en cache
    const transcriptPath = `${TRANSCRIPTS_DIR()}transcript_${recordingId}.json`;
    await FileSystem.writeAsStringAsync(transcriptPath, JSON.stringify({
      text: transcription,
      timestamp: Date.now(),
    }));
    
    // 4. Usar para resumen/flashcards
    setTranscription(transcription);
  } catch (error) {
    console.error(error);
  }
};
```

### 8.5 Videos de YouTube

#### Flujo

```
Usuario añade video de YouTube
    ↓
Backend obtiene video_id
    ↓
Intentar obtener captions nativos
    ├─ Sí: Usar directamente
    └─ No: Descargar audio + Whisper
    ↓
(Opcional) Formatear con Groq
    ↓
Disponible para resúmenes/flashcards
```

#### Implementación

**Archivo:** [VideoDetail.tsx](mobile/src/components/VideoDetail.tsx) (líneas 60-210)

```typescript
async function getYouTubeTranscription(videoId: string): Promise<string> {
  try {
    // 1. Obtener info del video
    const info = await getInfo(videoId);
    
    // 2. Intentar captions en español
    const captions = info.videoDetails.captions;
    if (captions?.length > 0) {
      const caption = captions.find(c => c.code === 'es');
      if (caption) {
        const response = await fetch(caption.baseUrl);
        const xml = await response.text();
        return parseXMLCaptions(xml);
      }
    }
    
    // 3. Fallback: descargar audio + Whisper
    const stream = ytdl(videoId, { quality: '18' });
    const output = fs.createWriteStream('temp.m4a');
    stream.pipe(output);
    
    return await transcribeWithWhisper('temp.m4a', apiKey);
  } catch (error) {
    console.error(error);
  }
}
```

---

## 9. Límites y Restricciones

### 9.1 Límites de Caracteres

| Componente | Límite | Razón |
|---|---|---|
| **Context (Groq)** | 5,000 chars | Optimización de tokens |
| **Context (Gemini)** | 15,000 chars | Capacidad de la API |
| **Salida (Groq)** | 6,000 tokens | Presupuesto de generación |
| **Tamaño doc (Groq)** | ~50 KB | Límite práctico |
| **Tamaño doc (Gemini)** | 100 MB | Límite Files API |
| **Temperature** | 0.2 | Consistencia máxima |

### 9.2 Límites de Subida

| Tipo | Límite | Restricción |
|---|---|---|
| **Documentos** | 100 MB | Solo Gemini (Files API) |
| **Imágenes** | No aplicable | No implementadas |
| **Audio** | ~100 MB | Groq Whisper |
| **Video** | N/A | Se usa captions nativos |

### 9.3 Límites de Tokens

| Modelo | Contexto | Salida | Total |
|---|---|---|---|
| Groq llama-3.3-70b | ~32k | 6k (flashcards) | 32k |
| Gemini 3 Flash | 1M | Ilimitada (~100k) | 1M |

### 9.4 Rate Limits (Depende del Plan)

```
Groq:
- Requests/min: Según plan
- Tokens/min: Según plan
- Fallback: cambiar a Gemini

Gemini:
- Requests/min: 1500 (Free tier)
- Tokens/min: 1,000,000 (Free tier)
- Files API: Uploads temporales (se borran automáticamente)
```

### 9.5 Truncamiento Automático

**En aiController.js:**
```javascript
// Trimear contexto automáticamente si es necesario
const MAX_CONTEXT_CHARS = provider === 'gemini' ? 15000 : 5000;
const trimmedContext = contextLength > MAX_CONTEXT_CHARS
  ? context_text.substring(0, MAX_CONTEXT_CHARS) + '\n\n[...Contexto truncado]'
  : context_text;
```

---

## 10. Extracción de Contexto por Tipo de Fuente

### 10.1 Extracción de Documentos

**Proceso:**

```
1. Validar formato (PDF, DOCX, TXT, etc.)
2. Si es DOCX/DOC → convertir a text/plain (mammoth)
3. Si es grande (> 50KB) → usar Gemini Files API
4. Si es pequeño → inline con Groq
5. Trimear a límite de caracteres del provider
```

**Código:**

```javascript
// [documentConverter.js](backend/utils/documentConverter.js)
async function prepareBufferForGemini(fileBuffer, mimeType) {
  // Si es nativo (PDF, TXT, HTML, MD) → pasar sin cambios
  if (isNativelySupported(mimeType)) {
    return { buffer: fileBuffer, mimeType, wasConverted: false };
  }
  
  // Si es DOCX/DOC → extraer texto con mammoth
  if (isConvertible(mimeType)) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const textBuffer = Buffer.from(result.value, 'utf-8');
    return { buffer: textBuffer, mimeType: 'text/plain', wasConverted: true };
  }
  
  throw new Error('Formato no soportado');
}
```

### 10.2 Extracción de Audios

**Proceso:**

```
1. Detectar formato (m4a, mp3, wav, ogg)
2. Enviar a Groq Whisper v3
3. Obtener transcripción en crudo
4. (Opcional) Formatear con LLaMA 3:
   - Agregar puntuación
   - Separar por semántica
   - Crear subtítulos con palabras clave
5. Guardar en cache local
```

**Código:**

```typescript
// [groqHelpers.ts](mobile/src/utils/groqHelpers.ts)
export async function transcribeWithWhisper(audioUri, apiKey) {
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/mp4'
  });
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'es');
  
  const response = await fetch(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: formData }
  );
  
  const rawText = await response.text();
  
  // Formatear con LLaMA 3
  return await formatTranscriptionWithLlama(rawText, apiKey);
}
```

### 10.3 Extracción de Videos

**Proceso:**

```
1. Obtener video_id
2. Intentar obtener captions nativos (YouTube API)
3. Si existen → parsear XML y extraer texto
4. Si NO existen → descargar audio + Whisper
5. (Opcional) Formatear con LLaMA 3
6. Guardar en cache
```

**Código:**

```typescript
// [VideoDetail.tsx](mobile/src/components/VideoDetail.tsx)
async function fetchCaptions(videoId) {
  const info = await getInfo(videoId);
  const captions = info.videoDetails.captions;
  
  if (!captions?.length) return null;
  
  const caption = captions.find(c => c.code === 'es');
  if (!caption) return null;
  
  const response = await fetch(caption.baseUrl);
  const xml = await response.text();
  
  // Parsear XML: <text> tags contienen el texto
  return parseXMLCaptions(xml);
}

function parseXMLCaptions(xml) {
  const regex = /<text[^>]*>([^<]*)<\/text>/g;
  let match;
  let text = '';
  
  while ((match = regex.exec(xml)) !== null) {
    text += match[1] + ' ';
  }
  
  // Decodificar entidades HTML
  return decodeHTMLEntities(text);
}
```

### 10.4 Extracción de Chat History

**Proceso:**

```
1. Si hay documentos explícitos → usar
2. Si no hay → usar historial del chat
3. Filtrar mensajes de sistema
4. Convertir a formato contexto:
   "Estudiante: {msg}\n\nZyren: {reply}\n\n..."
5. Trimear a límite del provider
```

**Código:**

```typescript
// [SubjectAIChatModal.tsx](mobile/src/components/SubjectAIChatModal.tsx)
const buildGenerationContext = useCallback(() => {
  // Prioridad 1: Contexto explícito (documentos)
  const explicit = (localContextText || '') + (uploadedDocContext || '');
  if (explicit.trim()) return explicit;
  
  // Prioridad 2: Historial de conversación
  if (messages.length > 0) {
    return messages
      .filter(m => !m.isDocument)
      .map(m => `${m.role === 'user' ? 'Estudiante' : 'Zyren'}: ${m.content}`)
      .join('\n\n');
  }
  
  return '';
}, [localContextText, uploadedDocContext, messages]);
```

---

## 11. Resumen Ejecutivo

### 🤖 Modelo Dual

| Aspecto | Groq | Gemini |
|---|---|---|
| **Uso principal** | Chat rápido, audio | Documentos grandes |
| **Modelo** | llama-3.3-70b | gemini-3-flash |
| **Velocidad** | 300+ tok/s | ~50 tok/s |
| **Contexto** | 5K chars | 15K chars |
| **Documentos** | ≤50 KB | ≤100 MB |

### 👤 Zyren

- **Es:** Un tutor IA experto en pedagogía y diseño instruccional
- **Hace:** Chat académico, genera flashcards, detecta automáticamente cuándo crear material
- **Reglas:** Rigor, no circularidad, pistas estratégicas, distractores de calidad, código con fences
- **Señal:** %%DECK_ACTION%%{...}%%END%% para generación automática

### 🎤 Transcripción

- **Audio:** Groq Whisper v3 (rápido y preciso)
- **Video:** YouTube captions nativos (o Whisper si no existen)
- **Resumen:** Groq LLaMA 3 (estructura semántica)

### 📄 Documentos

- **Pequeños:** Inline con Groq (rápido)
- **Grandes:** Gemini Files API (poderoso)
- **Formatos:** PDF, DOCX, DOC, TXT, HTML, MD
- **Conversión:** DOCX/DOC → text/plain automáticamente

### 🔄 Contexto

Prioridades:
1. Documentos explícitos subidos
2. Historial del chat
3. Trimear automáticamente si > límite

---

**Documento generado:** Mayo 22, 2026  
**Última actualización:** Mayo 22, 2026


---
**Tags:** #ai_zyren #domains/ai_zyren
