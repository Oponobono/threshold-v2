# Feature Matrix — Auditoría Multidimensional de Ciclo de Vida

> Este documento gobierna el desarrollo. Antes de implementar una entidad nueva, completa su fila aquí.
> Una entidad no está completa hasta que todas sus matrices estén en verde.

---

## Leyenda General

| Símbolo | Significado |
|---------|-------------|
| ✅ | Existe y funciona |
| ❌ | No existe |
| ⚠️ | Existe pero incompleto o con bugs |
| 🔶 | No verificado |
| — | No aplica |

---

## 1. Lifecycle Matrix

Cada operación se audita en 4 capas: **UI** (existe interacción), **API** (existe llamada), **Backend** (existe endpoint/lógica), **Sync** (se sincroniza).

### 1.1 Entidades Core

#### Subject

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Archivar | ❌ | ❌ | ❌ | ❌ |
| Desarchivar | ❌ | ❌ | ❌ | ❌ |
| Restaurar (post-delete) | ❌ | ❌ | ❌ | ❌ |
| Cambiar orden | ❌ | ❌ | ❌ | — |

#### Course

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |
| Archivar | ❌ | ❌ | ❌ | ❌ |
| Desarchivar | ❌ | ❌ | ❌ | ❌ |

#### Assessment (Exam)

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Vincular a mazo | ✅ | ✅ | ✅ | ✅ |
| Desvincular de mazo | ✅ | ✅ | ✅ | ✅ |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |
| Duplicar | ❌ | ❌ | ❌ | ❌ |

#### FlashcardDeck

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Duplicar | ❌ | ❌ | ❌ | ❌ |
| Compartir | ✅ | ✅ | ✅ | ✅ |
| Vincular examen | ✅ | ✅ | ✅ | ✅ |
| Desvincular examen | ✅ | ✅ | ✅ | ✅ |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |
| Exportar | ✅ | ✅ | ✅ | — |
| Mover a grupo | ❌ | ❌ | ❌ | — |

#### Flashcard (individual)

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Mover entre mazos | ❌ | ❌ | ❌ | ❌ |
| Duplicar | ❌ | ❌ | ❌ | ❌ |
| Cambiar tipo (front/back) | ❌ | ❌ | ❌ | — |
| Snooze | ✅ | ✅ | ✅ | ✅ |
| Unsnooze | ✅ | ✅ | ✅ | ✅ |

### 1.2 Entidades de Contenido

#### Photo

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear (tomar foto) | ✅ | ✅ | ✅ | ✅ |
| Renombrar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |
| OCR (extraer texto) | ✅ | ✅ | ✅ | — |
| Compartir | ❌ | ❌ | ❌ | ❌ |
| Descargar original | ✅ | — | — | — |

#### AudioRecording

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear (grabar) | ✅ | ✅ | ✅ | ✅ |
| Renombrar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Transcribir | ⚠️ | ✅ | ✅ | ✅ |
| Re-transcribir | ❌ | ❌ | ❌ | ❌ |
| Cancelar transcripción | ❌ | ❌ | ❌ | ❌ |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |
| Compartir | ❌ | ❌ | ❌ | ❌ |

#### ScannedDocument

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear (escanear) | ✅ | ✅ | ✅ | ✅ |
| Renombrar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Re-escanear | ❌ | ❌ | ❌ | ❌ |
| OCR (extraer texto) | ✅ | ✅ | ✅ | — |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |
| Compartir | ❌ | ❌ | ❌ | ❌ |

#### YouTubeVideo

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear (vincular URL) | ✅ | ✅ | ✅ | ✅ |
| Editar (título/notas) | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Transcribir | ⚠️ | ✅ | ✅ | ✅ |
| Re-transcribir | ❌ | ❌ | ❌ | ❌ |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |

### 1.3 Entidades de Calendario y Planificación

#### CalendarEvent

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Vincular a mazo | ✅ | ✅ | ✅ | ✅ |
| Desvincular de mazo | ✅ | ✅ | ✅ | ✅ |
| Cambiar de subject | ✅ | ✅ | ✅ | ✅ |
| Repetir (recurrente) | ❌ | ❌ | ❌ | ❌ |

#### Schedule (Study Plan)

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Completar manualmente | ❌ | ❌ | ❌ | ❌ |
| Re-planificar | ❌ | ❌ | ❌ | ❌ |

### 1.4 Entidades de Configuración

#### GradingPeriod

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Cerrar período | ❌ | ❌ | ❌ | ❌ |
| Reabrir período | ❌ | ❌ | ❌ | ❌ |

#### LmsAccount

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Vincular | ✅ | ✅ | ✅ | ✅ |
| Desvincular | ⚠️ | ✅ | ✅ | ✅ |
| Re-sincronizar | ❌ | ❌ | ❌ | ❌ |
| Cambiar ajustes | ❌ | ❌ | ❌ | ❌ |

#### ThresholdOverride

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ✅ | ✅ |
| Restablecer a predeterminado | ❌ | ❌ | ❌ | ❌ |

### 1.5 Entidades de Estudio

#### StudySession

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear (iniciar) | ✅ | ✅ | ✅ | ✅ |
| Pausar/Reanudar | ❌ | ❌ | ❌ | ❌ |
| Cancelar/Descartar | ❌ | ❌ | ❌ | ❌ |
| Exportar reporte | ❌ | ❌ | ❌ | ❌ |

#### CardReview

| Operación | UI | API | Backend | Sync |
|-----------|----|-----|---------|------|
| Crear (responder) | ✅ | ✅ | ✅ | ✅ |
| Re-corregir | ❌ | ❌ | ❌ | ❌ |
| Resetear estadísticas | ❌ | ❌ | ❌ | ❌ |

---

## 2. State Machine Matrix

Estados documentados y transiciones para entidades con ciclo de vida no trivial.

### 2.1 Flashcard

```
new → learning → review → mastered
  ↓      ↓          ↓
snoozed → (tiempo) → unsnoozed
```

| Transición | Origen | Destino | ¿Existe? | ¿Dónde? |
|-----------|--------|---------|----------|---------|
| Responder (again) | new/learning/review | learning | ✅ | `updateCardStatus` |
| Responder (hard) | learning/review | learning/review | ✅ | `updateCardStatus` |
| Responder (good) | new/learning/review | review | ✅ | `updateCardStatus` |
| Responder (easy) | new/learning/review | mastered | ✅ | `updateCardStatus` |
| Snooze | any | snoozed | ✅ | `card_snoozes` table |
| Unsnooze automático | snoozed | original | ✅ | `autoUnsnoozeExpired` |
| Unsnooze manual | snoozed | original | ✅ | UI en estudio |

### 2.2 Asset (Photo/Audio/Document)

```
LOCAL_ONLY → QUEUED_UPLOAD → UPLOADING → SYNCED
                                      ↘ FAILED → QUEUED_UPLOAD (retry ×5)
                                               ↘ CORRUPTED
                                               ↘ DELETED
```

| Transición | ¿Existe? | ¿Dónde? |
|-----------|----------|---------|
| LOCAL_ONLY → QUEUED_UPLOAD | ✅ | `AssetSyncEngine.scheduleUpload` |
| QUEUED_UPLOAD → UPLOADING | ✅ | `AssetUploadManager` |
| UPLOADING → SYNCED | ✅ | `AssetUploadManager` success |
| UPLOADING → FAILED | ✅ | `AssetUploadManager` error (retry ≤5) |
| FAILED → QUEUED_UPLOAD | ✅ | Retry automático |
| FAILED → CORRUPTED | ✅ | `AssetValidator` |
| SYNCED → DELETED | ✅ | Delete + cascade |

### 2.3 AudioRecording (Transcription)

```
recorded → transcribing → transcribed
              ↓               ↓
            error          summary_generated
```

| Transición | ¿Existe? | ¿Dónde? |
|-----------|----------|---------|
| recorded → transcribing | ❌ | No hay estado intermedio, se envía directo |
| transcribing → transcribed | ✅ | `POST /audio-transcripts` |
| transcribing → error | ❌ | No hay manejo de error visible |
| transcribed → summary_generated | ✅ | Backend genera summary_text |
| **Re-transcribir** | **❌** | No hay endpoint ni UI |
| **Cancelar transcripción** | **❌** | No hay abort |

### 2.4 SyncQueue

```
pending → processing → completed
                      ↘ failed (retry ×5 → descartado)
```

| Transición | ¿Existe? | ¿Dónde? |
|-----------|----------|---------|
| pending → processing | ✅ | `SyncService.processQueue` |
| processing → completed | ✅ | `markCompletedBatch` |
| processing → failed | ✅ | `markFailed` |
| failed → pending (retry) | ✅ | `getPending` incluye failed |
| failed → descartado | ✅ | Stale ops (retries ≥ 5) |

### 2.5 Bootstrap

```
DATABASE → STORAGE → NETWORK → AUTH → SYNC → READY
```

Cada fase: `pending → running → done | error`

| Transición | ¿Existe? | ¿Dónde? |
|-----------|----------|---------|
| DATABASE → STORAGE | ✅ | `BootstrapManager._runPhase` |
| STORAGE → NETWORK | ✅ | `BootstrapManager._runPhase` |
| NETWORK → AUTH | ✅ | `BootstrapManager._runPhase` |
| AUTH → SYNC | ✅ | `BootstrapManager._runPhase` |
| SYNC → READY | ✅ | `BootstrapManager._onPhaseDone` |
| Error recovery | ❌ | No hay retry por fase |

---

## 3. Relationship Matrix

### 3.1 Relaciones Jerárquicas

| Parent | Child | FK Column | ON DELETE (Backend) | ON DELETE (Mobile) | Riesgo |
|--------|-------|-----------|-------------------|-------------------|--------|
| **Subject** | Course | `subject_id` | NO ACTION | NO ACTION | ⚠️ Órfanos si se elimina subject |
| **Subject** | Assessment | `subject_id` | NO ACTION | NO ACTION | ⚠️ Órfanos |
| **Subject** | Photo | `subject_id` | CASCADE | CASCADE | ✅ |
| **Subject** | AudioRecording | `subject_id` | CASCADE | SET NULL | ⚠️ Inconsistente |
| **Subject** | ScannedDocument | `subject_id` | SET NULL | SET NULL | ✅ |
| **Subject** | YouTubeVideo | `subject_id` | SET NULL | SET NULL | ✅ |
| **Subject** | FlashcardDeck | `subject_id` | CASCADE | CASCADE | ✅ |
| **Subject** | CalendarEvent | `subject_id` | SET NULL | SET NULL | ✅ |
| **Subject** | Schedule | `subject_id` | NO ACTION | NO ACTION | ⚠️ Órfanos |
| **Subject** | StudySession | `subject_id` | NO ACTION | NO ACTION | ⚠️ Órfanos |
| **Subject** | ThresholdOverride | `subject_id` | CASCADE | CASCADE | ✅ |
| **Deck** | Flashcard | `deck_id` | CASCADE | CASCADE | ✅ |
| **Deck** | CalendarEvent | `linked_deck_id` | SET NULL | SET NULL | ✅ |
| **Audio** | AudioTranscript | `recording_id` | CASCADE | CASCADE | ✅ |
| **YouTube** | YouTubeTranscript | `video_id` | CASCADE | CASCADE | ✅ |
| **Deck** | CardReview | `card_id` | CASCADE | CASCADE | ✅ |

### 3.2 Relaciones Cruzadas

| Entity A | Entity B | Dirección A→B | Dirección B→A | Bidireccional? |
|----------|----------|--------------|--------------|----------------|
| Deck | CalendarEvent | `linked_event_id → event.id` | `event.linked_deck_id → deck.id` | ✅ |
| Deck | Group (social) | N/A | `group_pin_id` via share | ⚠️ Solo lectura |

### 3.3 Riesgos Detectados

| Riesgo | Impacto | Prioridad |
|--------|---------|-----------|
| Subject sin CASCADE en assessments, schedules, study_sessions | Datos huérfanos al eliminar subject | 🔴 Alta |
| AudioRecording: CASCADE backend vs SET NULL mobile | Comportamiento inconsistente offline vs online | 🟡 Media |
| No hay RESTRICT en ninguna FK | No se previene eliminación con hijos | 🟡 Media |

---

## 4. Capability Matrix (IA)

| Entidad | OCR | Transcripción | Resumen | Generación IA | Búsqueda Semántica |
|---------|-----|---------------|---------|---------------|-------------------|
| Subject | — | — | — | ✅ (contexto chat) | — |
| Course | — | — | — | — | — |
| Assessment | — | — | — | — | — |
| FlashcardDeck | — | — | — | ✅ (generar desde texto) | — |
| Flashcard | — | — | — | ✅ (chat con contexto) | — |
| Photo | ✅ ML Kit local | — | — | — | ✅ (OCR text search) |
| AudioRecording | — | ✅ Whisper local | ✅ summary_text | — | — |
| AudioTranscript | — | — | ✅ summary_text | — | — |
| ScannedDocument | ✅ ML Kit local | — | — | — | — |
| YouTubeVideo | — | ✅ backend | ✅ summary_text | — | — |
| YouTubeTranscript | — | — | ✅ summary_text | — | — |
| CalendarEvent | — | — | — | — | — |
| Schedule | — | — | — | — | — |
| GradingPeriod | — | — | — | — | — |
| LmsAccount | — | — | — | — | — |
| ThresholdOverride | — | — | — | — | — |
| StudySession | — | — | — | — | — |
| CardReview | — | — | — | — | — |

### 4.1 Brechas de Capacidad

| Brecha | Entidad | ¿Qué falta? |
|--------|---------|-------------|
| ❌ Re-transcribir | Audio / YouTube | No hay endpoint ni UI para repetir transcripción |
| ❌ Cancelar transcripción | Audio | No hay abort de transcripción en progreso |
| ❌ Resumen manual | AudioTranscript | No hay botón "Generar resumen" (solo automático) |
| ❌ OCR en lote | Photo / Document | No hay "OCR todo" para múltiples archivos |

---

## 5. Offline Matrix

### 5.1 Operaciones CRUD

| Entidad | Lectura Local | CREATE offline | UPDATE offline | DELETE offline | Sync pendiente |
|---------|--------------|---------------|---------------|---------------|----------------|
| Subject | ✅ SQLite | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| Course | ✅ SQLite | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| Assessment | ✅ SQLite | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| FlashcardDeck | ✅ SQLite+MMKV | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| Flashcard | ✅ SQLite+MMKV | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| Photo | ✅ SQLite | ✅ metadata | ✅ metadata | ✅ metadata | ✅ (asset diferido) |
| AudioRecording | ✅ SQLite | ✅ metadata | ✅ metadata | ✅ metadata | ✅ (asset diferido) |
| ScannedDocument | ✅ SQLite | ✅ metadata | ✅ metadata | ✅ metadata | ✅ (asset diferido) |
| YouTubeVideo | ✅ SQLite | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| YouTubeTranscript | ✅ SQLite | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| CalendarEvent | ✅ SQLite | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| Schedule | ✅ SQLite | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| GradingPeriod | ✅ SQLite+MMKV | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| LmsAccount | ✅ SQLite+MMKV | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| ThresholdOverride | ✅ SQLite+MMKV | ✅ Enqueue | ✅ Enqueue | ✅ Enqueue | ✅ |
| StudySession | ✅ SQLite | ✅ Enqueue | — | — | ✅ |
| CardReview | ✅ SQLite+MMKV | ✅ Enqueue | — | — | ✅ |

### 5.2 Operaciones IA

| Operación | Offline | Online | Fallback |
|-----------|---------|--------|----------|
| OCR (foto/documento) | ✅ ML Kit local | ✅ Cloud `/ocr` | Local → Cloud |
| Transcripción (audio) | ✅ Whisper local | ✅ Cloud Whisper | Local → Cloud |
| Transcripción (youtube) | ❌ | ✅ backend | Ninguno |
| Generar flashcards | ❌ | ✅ AI | Ninguno |
| Chat IA | ❌ | ✅ AI | Ninguno |
| Resumen | ❌ | ✅ AI | Ninguno |

### 5.3 Asset Binary Transfer

| Operación | Offline | Gatillado por | Retry |
|-----------|---------|---------------|-------|
| Upload photo | Diferido (cola) | `autoUpload && includePhotos` | 5 intentos |
| Upload audio | Diferido (cola) | `autoUpload` | 5 intentos |
| Upload document | Diferido (cola) | `autoUpload && includeDocs` | 5 intentos |
| Download photo | ✅ (si en cache) | Priority / lazy | 5 intentos |
| Download audio | ✅ (si en cache) | Priority / lazy | 5 intentos |
| Download document | ✅ (si en cache) | Priority / lazy | 5 intentos |
| Cache LRU | 3 GB | Eviction automática | — |

### 5.4 Operaciones Solo Online

| Operación | Entidad | ¿Por qué? |
|-----------|---------|-----------|
| `generateFlashcardsFromText` | Flashcard | Requiere AI cloud |
| `generateFlashcardsFromImage` | Flashcard | Requiere AI cloud |
| `shareDeck` | FlashcardDeck | Requiere servidor |
| `getYouTubeSubtitles` | YouTubeVideo | Requiere fetch externo |
| `exportDataCsv/Pdf` | Settings | Generación server-side |
| `enableTwoFactor` | Settings | Seguridad |

---

## 6. Resumen de Brechas

### Prioridad Alta (UI faltante, backend listo)

| Brecha | Entidad | ¿Qué falta? |
|--------|---------|-------------|
| ❌ Restaurar subject | Subject | Botón "Restaurar" en trash |
| ❌ Duplicar mazo | FlashcardDeck | Botón "Duplicar" en menú contextual |
| ❌ Mover tarjeta entre mazos | Flashcard | Opción en edición de tarjeta |
| ❌ Re-transcribir | AudioRecording / YouTubeVideo | Botón en vista de detalle |
| ❌ Cancelar transcripción | AudioRecording | Botón para abortar |
| ❌ Compartir contenido | Photo / Audio / Document | Botón compartir nativo |

### Prioridad Media (relaciones/estados)

| Brecha | Entidad | Impacto |
|--------|---------|---------|
| ⚠️ Subject sin CASCADE en children | Assessment / Schedule / StudySession | Datos huérfanos al eliminar subject |
| ⚠️ AudioRecording CASCADE vs SET NULL | Audio → Subject | Comportamiento inconsistente |
| ❌ No hay manejo de error de transcripción | AudioRecording | Usuario no ve fallos |
| ❌ Re-planificar schedule | Schedule | No se puede editar plan existente |
| ❌ Eventos recurrentes | CalendarEvent | No hay repetición semanal/mensual |

### Prioridad Baja (calidad de vida)

| Brecha | Entidad | ¿Qué falta? |
|--------|---------|-------------|
| ❌ Archivar/Desarchivar | Subject / Course | Estado "archivado" |
| ❌ Resetear estadísticas | CardReview | Botón para reiniciar progreso |
| ❌ Re-corregir respuesta | CardReview | Corregir rating erroneo |
| ❌ Cerrar/Reabrir período | GradingPeriod | Estado de período académico |

---

## 7. Reglas de Gobierno

### Para agregar una entidad nueva

Antes de escribir código, completa:

1. **Lifecycle Matrix** — ¿Qué operaciones tiene su ciclo de vida completo?
2. **State Machine** — ¿Qué estados y transiciones tiene?
3. **Relationship Matrix** — ¿Con quién se relaciona y qué pasa en DELETE?
4. **Capability Matrix** — ¿Qué capacidades IA tiene?
5. **Offline Matrix** — ¿Funciona offline?
6. **Sync Entity Contract** — ¿Cumple los 10 invariantes del protocolo?

### Para modificar una entidad existente

1. Actualiza su fila en las 5 matrices
2. Marca cualquier brecha nueva que introduzca el cambio
3. Si una operación existente queda obsoleta, documéntalo

---

*Generado: 2026-07-02. Documento vivo — actualizar con cada cambio de modelo de negocio.*


---
**Tags:** #product
