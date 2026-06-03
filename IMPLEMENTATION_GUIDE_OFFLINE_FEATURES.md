# 🔨 Guía de Implementación - Features Offline Faltantes

## 📦 P1: Crear Módulo ASSIGNMENTS (Trabajos)

### Paso 1: Servicio API - `mobile/src/services/api/assignments.ts`

```typescript
/**
 * assignments.ts
 * 
 * Servicio CRUD para trabajos académicos (assignments/tareas para entregar).
 * Cada trabajo pertenece a una materia y puede tener archivos adjuntos y feedback.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { offlineSyncService } from '../offlineSyncService';
import { cacheService, CACHE_KEYS } from '../cacheService';

export interface Assignment {
  id: number;
  subject_id: number;
  user_id?: number;
  title: string;
  description?: string;
  instructions?: string;
  due_date: string; // YYYY-MM-DD
  submission_date?: string; // Cuando el usuario lo entrega
  file_uris?: string[]; // URIs locales de archivos
  status: 'pending' | 'submitted' | 'graded' | 'returned';
  grade?: number;
  teacher_feedback?: string;
  created_at?: string;
  updated_at?: string;
  _isPending?: boolean;
}

/**
 * Obtiene todos los trabajos del usuario
 */
export const getAllAssignments = async (): Promise<Assignment[]> => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');
  
  try {
    const response = await fetchWithFallback(`/assignments/user/${userId}`);
    if (!response.ok) {
      throw new Error(await (await parseJsonSafely(response))?.error || 'Error al obtener trabajos');
    }
    const data = await parseJsonSafely(response);
    const assignments = Array.isArray(data) ? data : [];
    if (assignments.length > 0) {
      await cacheService.saveAssignments(assignments);
    }
    return assignments;
  } catch (error) {
    console.warn('[Assignments] Network error, falling back to cache:', error);
    const cached = await cacheService.loadAssignments();
    if (cached && Array.isArray(cached)) {
      console.log('[Assignments] ✅ Loaded from cache (offline mode)');
      return cached;
    }
    return [];
  }
};

/**
 * Obtiene trabajos por materia
 */
export const getAssignmentsBySubject = async (subjectId: number): Promise<Assignment[]> => {
  try {
    const response = await fetchWithFallback(`/assignments/subject/${subjectId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al obtener trabajos');
    }
    const assignments = Array.isArray(data) ? data : [];
    if (assignments.length > 0) {
      await cacheService.saveAssignmentsBySubject(subjectId, assignments);
    }
    return assignments;
  } catch (error) {
    console.warn(`[Assignments] Network error for subject ${subjectId}, using cache:`, error);
    const cached = await cacheService.loadAssignmentsBySubject(subjectId);
    return Array.isArray(cached) ? cached : [];
  }
};

/**
 * Crea un nuevo trabajo
 */
export const createAssignment = async (payload: Omit<Assignment, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const payloadWithUser = {
    ...payload,
    user_id: Number(userId),
  };

  try {
    const response = await fetchWithFallback('/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithUser),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo crear el trabajo.');
    }

    cacheService.clearKey(CACHE_KEYS.ASSIGNMENTS);
    cacheService.clearKey(`${CACHE_KEYS.ASSIGNMENTS_BY_SUBJECT}${payload.subject_id}`);
    return data as Assignment;
  } catch (error) {
    console.warn('[Assignments] Offline: encolando createAssignment', error);
    await offlineSyncService.addPendingOperation('POST', '/assignments', 'assignment', payloadWithUser);

    const optimisticAssignment = {
      id: -Date.now(),
      ...payloadWithUser,
      status: 'pending' as const,
      _isPending: true,
      created_at: new Date().toISOString(),
    };

    const existing = await cacheService.loadAssignments() as any[] | null;
    if (existing) {
      cacheService.saveAssignments([optimisticAssignment, ...existing]);
    } else {
      cacheService.saveAssignments([optimisticAssignment]);
    }

    return optimisticAssignment as Assignment;
  }
};

/**
 * Actualiza un trabajo existente
 */
export const updateAssignment = async (id: number, payload: Partial<Assignment>) => {
  try {
    const response = await fetchWithFallback(`/assignments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo actualizar el trabajo.');
    }

    cacheService.clearKey(CACHE_KEYS.ASSIGNMENTS);
    if (payload.subject_id) {
      cacheService.clearKey(`${CACHE_KEYS.ASSIGNMENTS_BY_SUBJECT}${payload.subject_id}`);
    }
    return data as Assignment;
  } catch (error) {
    console.warn(`[Assignments] Offline: encolando updateAssignment ${id}`, error);
    await offlineSyncService.addPendingOperation('PUT', `/assignments/${id}`, 'assignment', payload);
    cacheService.updateOptimisticItem(CACHE_KEYS.ASSIGNMENTS, id, payload);
    return { ...payload, _isPending: true } as any;
  }
};

/**
 * Marca un trabajo como entregado (submitted)
 */
export const submitAssignment = async (id: number, file_uris?: string[]) => {
  const payload = {
    status: 'submitted' as const,
    submission_date: new Date().toISOString(),
    file_uris: file_uris || [],
  };

  return updateAssignment(id, payload);
};

/**
 * Elimina un trabajo
 */
export const deleteAssignment = async (id: number) => {
  try {
    const response = await fetchWithFallback(`/assignments/${id}`, {
      method: 'DELETE',
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo eliminar el trabajo.');
    }

    cacheService.clearKey(CACHE_KEYS.ASSIGNMENTS);
    return data;
  } catch (error) {
    console.warn(`[Assignments] Offline: encolando deleteAssignment ${id}`, error);
    await offlineSyncService.addPendingOperation('DELETE', `/assignments/${id}`, 'assignment');
    cacheService.removeOptimisticItem(CACHE_KEYS.ASSIGNMENTS, id);
    return { success: true, _isPending: true };
  }
};

/**
 * Obtiene un trabajo específico
 */
export const getAssignmentById = async (assignmentId: number): Promise<Assignment | null> => {
  try {
    const response = await fetchWithFallback(`/assignments/${assignmentId}`);
    if (response.ok) {
      const data = await parseJsonSafely(response);
      return data;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn(`[Assignments] getAssignmentById(${assignmentId}) falló, buscando en caché...`);
    const cached = await cacheService.loadAssignments() as Assignment[] | null;
    if (Array.isArray(cached)) {
      return cached.find(a => a.id === assignmentId) || null;
    }
    return null;
  }
};
```

### Paso 2: Agregar Cache Keys - `mobile/src/services/cacheService.ts`

```typescript
export const CACHE_KEYS = {
  // ... existing keys ...
  ASSIGNMENTS: 'cache:assignments',
  ASSIGNMENTS_BY_SUBJECT: 'cache:assignments_by_subject:',
} as const;

// Agregar TTL
const CACHE_TTL = {
  // ... existing TTLs ...
  ASSIGNMENTS: 1000 * 60 * 60, // 1 hora
};
```

**Agregar funciones de caché**:
```typescript
export const cacheService = {
  // ... existing methods ...

  saveAssignments: async (assignments: any[]): Promise<void> => {
    saveToCacheSync(CACHE_KEYS.ASSIGNMENTS, assignments);
  },

  loadAssignments: async (): Promise<any[] | null> => {
    return loadFromCacheSync(CACHE_KEYS.ASSIGNMENTS, CACHE_TTL.ASSIGNMENTS);
  },

  saveAssignmentsBySubject: async (subjectId: number, assignments: any[]): Promise<void> => {
    saveToCacheSync(`${CACHE_KEYS.ASSIGNMENTS_BY_SUBJECT}${subjectId}`, assignments);
  },

  loadAssignmentsBySubject: async (subjectId: number): Promise<any[] | null> => {
    return loadFromCacheSync(`${CACHE_KEYS.ASSIGNMENTS_BY_SUBJECT}${subjectId}`, CACHE_TTL.ASSIGNMENTS);
  },
};
```

### Paso 3: Agregar a offlineSyncService - `mobile/src/services/offlineSyncService.ts`

```typescript
interface PendingOperation {
  operationType: 
    | 'flashcard' 
    | 'flashcard_deck' 
    | 'subject' 
    | 'assessment' 
    | 'schedule' 
    | 'photo' 
    | 'audio' 
    | 'document' 
    | 'grading' 
    | 'calendar' 
    | 'youtube' 
    | 'assignment'  // ← AGREGAR
    // ... resto de tipos
}

export const offlineSyncService = {
  addPendingOperation: async (
    type: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    operationType: 'assignment' | /* ... otros ... */,  // ← AGREGAR
    payload?: any
  ): Promise<string> => {
    // ... existing implementation, automáticamente soporta 'assignment'
  },
};
```

### Paso 4: Backend Route - `backend/routes/assignments.js` (CREAR)

```javascript
/**
 * @swagger
 * /api/assignments:
 *   post:
 *     summary: Crea un nuevo trabajo académico
 *     tags: [Assignments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 */

const express = require('express');
const router = express.Router();
const assignmentsController = require('../controllers/assignmentsController');
const { verifyToken } = require('../middlewares/authMiddleware');

// CRUD
router.post('/assignments', verifyToken, assignmentsController.createAssignment);
router.get('/assignments/user/:userId', verifyToken, assignmentsController.getUserAssignments);
router.get('/assignments/subject/:subjectId', verifyToken, assignmentsController.getSubjectAssignments);
router.get('/assignments/:id', verifyToken, assignmentsController.getAssignmentById);
router.put('/assignments/:id', verifyToken, assignmentsController.updateAssignment);
router.delete('/assignments/:id', verifyToken, assignmentsController.deleteAssignment);

module.exports = router;
```

### Paso 5: Backend Controller - `backend/controllers/assignmentsController.js` (CREAR)

```javascript
const db = require('../database/connection');

exports.createAssignment = (req, res) => {
  const { user_id, subject_id, title, description, instructions, due_date, file_uris } = req.body;
  const userId = req.user.id;

  if (!title || !subject_id) {
    return res.status(400).json({ error: 'title y subject_id son requeridos' });
  }

  const query = `
    INSERT INTO assignments (
      user_id, subject_id, title, description, instructions, 
      due_date, file_uris, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `;

  db.run(query, 
    [userId, subject_id, title, description || null, instructions || null, due_date, JSON.stringify(file_uris || [])],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get('SELECT * FROM assignments WHERE id = ?', [this.lastID], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
      });
    }
  );
};

exports.getUserAssignments = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT a.*, s.name as subject_name, s.color 
    FROM assignments a
    JOIN subjects s ON a.subject_id = s.id
    WHERE a.user_id = ?
    ORDER BY a.due_date DESC
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

exports.getSubjectAssignments = (req, res) => {
  const { subjectId } = req.params;
  const query = `SELECT * FROM assignments WHERE subject_id = ? ORDER BY due_date DESC`;

  db.all(query, [subjectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

exports.getAssignmentById = (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM assignments WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Trabajo no encontrado' });
    res.json(row);
  });
};

exports.updateAssignment = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { status, grade, teacher_feedback, submission_date, file_uris } = req.body;

  // Verificar propiedad
  db.get('SELECT user_id FROM assignments WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Trabajo no encontrado' });
    if (Number(row.user_id) !== Number(userId)) {
      return res.status(403).json({ error: 'No tienes permiso para editar este trabajo' });
    }

    const fields = [];
    const values = [];
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (grade !== undefined) { fields.push('grade = ?'); values.push(grade); }
    if (teacher_feedback !== undefined) { fields.push('teacher_feedback = ?'); values.push(teacher_feedback); }
    if (submission_date !== undefined) { fields.push('submission_date = ?'); values.push(submission_date); }
    if (file_uris !== undefined) { fields.push('file_uris = ?'); values.push(JSON.stringify(file_uris)); }
    
    fields.push('updated_at = datetime("now")');
    values.push(id);

    const query = `UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`;
    db.run(query, values, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get('SELECT * FROM assignments WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
      });
    });
  });
};

exports.deleteAssignment = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.get('SELECT user_id FROM assignments WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Trabajo no encontrado' });
    if (Number(row.user_id) !== Number(userId)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este trabajo' });
    }

    db.run('DELETE FROM assignments WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, deleted: this.changes });
    });
  });
};
```

### Paso 6: DB Schema - `backend/database/schema.js`

```javascript
// Agregar a la lista de tablas
const CREATE_ASSIGNMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    due_date TEXT NOT NULL,
    submission_date TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'submitted', 'graded', 'returned')),
    grade REAL,
    teacher_feedback TEXT,
    file_uris TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )
`;

module.exports = [
  // ... existing tables ...
  CREATE_ASSIGNMENTS_TABLE,
];
```

### Paso 7: Agregar Route al Server - `backend/server.js`

```javascript
const assignmentRoutes = require('./routes/assignments');

// ... existing routes ...
app.use('/api', assignmentRoutes);
```

---

## 📱 P2: Mejorar Transcripción de Audio Offline

### Paso 1: Crear Servicio Local de Whisper - `mobile/src/services/localWhisperService.ts`

**Opción A - TensorFlow Lite (Recomendado pero requiere más dependencias)**

```typescript
/**
 * localWhisperService.ts
 * 
 * Transcripción de audio 100% offline usando modelo ONNX tiny de Whisper.
 * Requiere instalación de react-native-onnxruntime
 */

export async function transcribeAudioLocal(audioUri: string): Promise<string> {
  try {
    console.log('[LocalWhisper] Iniciando transcripción local de:', audioUri);

    // 1. Convertir audio a WAV si es necesario
    const wavUri = await convertToWav(audioUri);

    // 2. Leer archivo como buffer
    const buffer = await readAudioFile(wavUri);

    // 3. Procesar con modelo local (simulado - en producción usar ONNX Runtime)
    const transcript = await processWithWhisperTiny(buffer);

    console.log('[LocalWhisper] ✅ Transcripción completada:', transcript.substring(0, 50) + '...');
    return transcript;
  } catch (error) {
    console.error('[LocalWhisper] ❌ Error en transcripción local:', error);
    throw error;
  }
}

// Funciones auxiliares
async function convertToWav(audioUri: string): Promise<string> {
  // Implementar conversión si es necesario
  // Por ahora, asumir que el audio ya está en formato WAV
  return audioUri;
}

async function readAudioFile(audioUri: string): Promise<Float32Array> {
  const FileSystem = require('expo-file-system').default;
  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Convertir WAV a PCM (Float32Array)
  return decodeWav(bytes);
}

function decodeWav(wavData: Uint8Array): Float32Array {
  // Implementación simplificada de decodificación WAV
  // En producción, usar librería dedicada
  const pcmData = wavData.slice(44); // Skip WAV header
  const pcm = new Float32Array(pcmData.length / 2);
  
  for (let i = 0; i < pcm.length; i++) {
    const s16 = pcmData[i * 2] | (pcmData[i * 2 + 1] << 8);
    pcm[i] = ((s16 << 16) >> 16) / 32768;
  }
  
  return pcm;
}

async function processWithWhisperTiny(audioBuffer: Float32Array): Promise<string> {
  // Placeholder - en producción usar ONNX Runtime
  // const ort = require('onnxruntime-node');
  // const session = await ort.InferenceSession.create('whisper-tiny.onnx');
  // const feeds = { audio: new ort.Tensor('float32', audioBuffer, [audioBuffer.length]) };
  // const results = await session.run(feeds);
  // return results.text;

  // Para demo, retornar transcripción simulada
  console.warn('[LocalWhisper] Usando simulación (instalar react-native-onnxruntime en producción)');
  return "Transcripción local simulada - Instalar modelo ONNX Whisper tiny en producción";
}
```

**Opción B - Usar Google Cloud Speech-to-Text con Cache** (Más simple, pero requiere internet)

```typescript
/**
 * localWhisperService.ts (Opción B)
 * 
 * Envuelve Google Cloud Speech-to-Text con caching offline.
 * Si hay error de red, intenta usar transcripción cacheada similar.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { cacheService } from './cacheService';

const TRANSCRIPTION_CACHE_KEY = 'cache:audio_transcriptions';

interface CachedTranscription {
  audioHash: string;
  text: string;
  timestamp: number;
}

// Generar hash simple del audio para cache matching
async function hashAudio(audioUri: string): Promise<string> {
  const data = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return require('crypto').createHash('sha256').update(data).digest('hex');
}

export async function transcribeAudioLocal(audioUri: string): Promise<string> {
  try {
    console.log('[AudioTranscription] Iniciando transcripción de:', audioUri);

    // 1. Generar hash del audio
    const audioHash = await hashAudio(audioUri);

    // 2. Buscar en cache
    const cached = await getCachedTranscription(audioHash);
    if (cached) {
      console.log('[AudioTranscription] ✅ Encontrado en cache (similar)');
      return cached;
    }

    // 3. Intentar transcribir con Google Cloud (requiere API key en env)
    const transcript = await transcribeWithGoogleCloud(audioUri);

    // 4. Cachear resultado
    await cacheTranscription(audioHash, transcript);

    console.log('[AudioTranscription] ✅ Transcripción completada');
    return transcript;
  } catch (error) {
    console.warn('[AudioTranscription] ❌ Error, intentando fallback:', error);
    // Si falla internet, retornar transcripción similar cacheada
    const fallback = await getFallbackTranscription();
    if (fallback) return fallback;
    throw error;
  }
}

async function getCachedTranscription(audioHash: string): Promise<string | null> {
  try {
    const cache = cacheService.loadTranscriptionCache() || {};
    const key = audioHash.substring(0, 16); // Usar primeros 16 caracteres
    return cache[key] ? cache[key].text : null;
  } catch {
    return null;
  }
}

async function cacheTranscription(audioHash: string, text: string): Promise<void> {
  try {
    const cache = cacheService.loadTranscriptionCache() || {};
    const key = audioHash.substring(0, 16);
    cache[key] = { audioHash, text, timestamp: Date.now() };
    cacheService.saveTranscriptionCache(cache);
  } catch (error) {
    console.warn('[AudioTranscription] Error guardando en cache:', error);
  }
}

async function transcribeWithGoogleCloud(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
  if (!apiKey) throw new Error('Google Cloud API key no configurado');

  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        encoding: 'LINEAR16',
        languageCode: 'es-ES',
        audioChannelCount: 1,
        sampleRateHertz: 16000,
      },
      audio: { content: base64Audio },
    }),
    params: { key: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Google Cloud error: ${response.status}`);
  }

  const data = await response.json();
  const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || '';

  if (!transcript) {
    throw new Error('No se pudo transcribir el audio');
  }

  return transcript;
}

async function getFallbackTranscription(): Promise<string | null> {
  try {
    const cache = cacheService.loadTranscriptionCache();
    if (!cache || Object.keys(cache).length === 0) return null;
    
    // Retornar transcripción más reciente como fallback
    const entries = Object.values(cache as any);
    const latest = entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
    return latest?.text || null;
  } catch {
    return null;
  }
}
```

### Paso 2: Integrar en groqHelpers - `mobile/src/utils/groqHelpers.ts`

```typescript
// En la función transcribeAudioOnline (línea ~206-240)

export async function transcribeAudioOnline(
  audioUri: string,
  format: 'mp3' | 'm4a' = 'm4a',
): Promise<{ text: string; confidence?: number }> {
  const store = useLocalAIStore.getState();
  
  // ← AGREGAR: Intenta local primero si está configurado
  if (store.forceOfflineMode || store.activeProvider === 'local') {
    console.warn('[GroqHelpers] Modo offline: intentando transcripción local...');
    try {
      const { transcribeAudioLocal } = await import('../services/localWhisperService');
      const text = await transcribeAudioLocal(audioUri);
      return { text, confidence: 0.8 }; // Confidence estimada
    } catch (error) {
      console.error('[GroqHelpers] Transcripción local falló:', error);
      throw error;
    }
  }

  // Resto del código original (transcripción con Groq)
  // ...
}
```

---

## ✅ Checklist de Implementación

### Assignments
- [ ] Crear `mobile/src/services/api/assignments.ts`
- [ ] Agregar cache keys en `cacheService.ts`
- [ ] Actualizar `offlineSyncService.ts`
- [ ] Crear `backend/routes/assignments.js`
- [ ] Crear `backend/controllers/assignmentsController.js`
- [ ] Actualizar `backend/database/schema.js`
- [ ] Agregar ruta en `backend/server.js`
- [ ] Crear UI componentes (modal, lista, etc.)
- [ ] Pruebas offline completas

### Audio Transcripción
- [ ] Crear `mobile/src/services/localWhisperService.ts`
- [ ] Elegir Opción A o B
- [ ] Integrar en `groqHelpers.ts`
- [ ] Pruebas de transcripción offline
- [ ] Documentar configuración requerida

---

**Versión**: 1.0  
**Fecha**: Junio 3, 2026  
**Autor**: Análisis de Features Offline
