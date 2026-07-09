# Mutation Matrix — Qué Entidades Afecta Cada Acción

> Toda acción del usuario (o del sistema) produce mutaciones en una o más entidades.
> Si una mutación esperada no ocurre, hay un bug — aunque la acción principal funcione.

---

## 🔴 Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Mutación ocurre correctamente |
| ❌ | Mutación debiera ocurrir pero no ocurre |
| ⚠️ | Mutación ocurre pero incompleta o inconsciente |
| — | No debería mutar |

---

## Acciones de Usuario

### Subject

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `subjects` | ✅ Crea fila |
| **Editar nombre** | `subjects` | ✅ Actualiza |
| **Editar color/icono** | `subjects` | ✅ Actualiza |
| **Eliminar** | `subjects` | ✅ Elimina fila |
| | `courses` | ❌ NO CASCADE — quedan huérfanos |
| | `assessments` | ❌ NO CASCADE — quedan huérfanos |
| | `photos` | ✅ CASCADE |
| | `audio_recordings` | ⚠️ CASCADE backend, SET NULL mobile |
| | `scanned_documents` | ✅ SET NULL |
| | `youtube_videos` | ✅ SET NULL |
| | `flashcard_decks` | ✅ CASCADE |
| | `schedules` | ❌ NO CASCADE — quedan huérfanos |
| | `study_sessions` | ❌ NO CASCADE — quedan huérfanos |
| | `calendar_events` | ✅ SET NULL |
| | `threshold_overrides` | ✅ CASCADE |
| | `sync_deletions` | ✅ `recordDeletion('subjects', id)` |
| **Archivar** | `subjects` | ❌ No existe operación |

### Course

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `courses` | ✅ |
| **Editar** | `courses` | ✅ |
| **Cambiar subject** | `courses` | ✅ Actualiza `subject_id` |
| | `subjects` (new) | — Referencia actualizada |
| | `subjects` (old) | — Referencia eliminada |
| **Eliminar** | `courses` | ✅ |
| | `subjects.subject_id` | — No hay child que referencie course |

### Assessment (Exam)

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `assessments` | ✅ |
| | `assessment_files` | — CASCADE cuando se agreguen |
| **Editar** | `assessments` | ✅ |
| **Vincular a mazo** | `flashcard_decks` | ✅ `linked_event_id = event.id` |
| | `calendar_events` | ✅ `linked_deck_id` CSV se actualiza |
| **Desvincular de mazo** | `flashcard_decks` | ✅ `linked_event_id = null` |
| | `calendar_events` | ✅ Se limpia `linked_deck_id` CSV |
| **Eliminar** | `assessments` | ✅ |
| | `flashcard_decks.linked_event_id` | ❌ No se limpia — el mazo apunta a evento inexistente |
| | `calendar_events` | ❌ No hay relación directa assessments→events |

### FlashcardDeck

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `flashcard_decks` | ✅ |
| **Editar título** | `flashcard_decks` | ✅ |
| **Cambiar subject** | `flashcard_decks` | ✅ |
| **Vincular examen** | `flashcard_decks` | ✅ `linked_event_id` |
| | `calendar_events` | ✅ `linked_deck_id` CSV |
| **Desvincular examen** | `flashcard_decks` | ✅ `linked_event_id = null` |
| | `calendar_events` | ✅ Se limpia `linked_deck_id` CSV |
| **Duplicar** | `flashcard_decks` | ❌ No existe |
| | `flashcards` | ❌ No existe |
| **Eliminar** | `flashcard_decks` | ✅ |
| | `flashcards` | ✅ CASCADE |
| | `card_logs` | ✅ CASCADE |
| | `card_snoozes` | ✅ CASCADE |
| | `shared_decks` | ✅ CASCADE |
| | `calendar_events.linked_deck_id` | ✅ SET NULL (FK) |
| | `sync_deletions` | ✅ `recordDeletion('flashcard-decks', id)` |

### Flashcard (individual)

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `flashcards` | ✅ |
| **Editar** | `flashcards` | ✅ |
| **Mover a otro mazo** | `flashcards` | ❌ No existe |
| | `flashcard_decks.card_count` | ❌ No se actualiza contador |
| **Duplicar** | `flashcards` | ❌ No existe |
| **Eliminar** | `flashcards` | ✅ |
| | `card_logs` | ✅ CASCADE |
| | `card_snoozes` | ✅ CASCADE |
| | `flashcard_decks.card_count` | ❌ No se decrementa contador |

### Photo

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `photos` | ✅ metadata |
| | `asset_sync_queue` | ✅ upload job |
| **Renombrar** | `photos` | ✅ |
| **Cambiar subject** | `photos` | ✅ |
| **OCR** | `photos.ocr_text` | ✅ se actualiza |
| **Eliminar** | `photos` | ✅ |
| | `asset_store` (filesystem) | ✅ se elimina archivo |
| **Compartir** | — | ❌ No existe |

### AudioRecording

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear (grabar)** | `audio_recordings` | ✅ metadata |
| | `asset_sync_queue` | ✅ upload job |
| **Renombrar** | `audio_recordings` | ✅ |
| **Cambiar subject** | `audio_recordings` | ✅ |
| **Transcribir** | `audio_transcripts` | ✅ se crea |
| | `audio_recordings` | ✅ `has_transcript = true` |
| **Re-transcribir** | `audio_transcripts` | ❌ No existe |
| **Eliminar** | `audio_recordings` | ✅ |
| | `audio_transcripts` | ✅ CASCADE |
| | `asset_store` | ✅ se elimina archivo |

### ScannedDocument

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `scanned_documents` | ✅ |
| | `asset_sync_queue` | ✅ upload job |
| **Renombrar** | `scanned_documents` | ✅ |
| **OCR** | `scanned_documents.ocr_text` | ✅ |
| **Re-escanear** | `scanned_documents` | ❌ No existe |
| **Eliminar** | `scanned_documents` | ✅ |
| | `asset_store` | ✅ se elimina archivo |

### YouTubeVideo

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `youtube_videos` | ✅ |
| **Editar** | `youtube_videos` | ✅ |
| **Transcribir** | `youtube_transcripts` | ✅ |
| **Re-transcribir** | `youtube_transcripts` | ❌ No existe |
| **Eliminar** | `youtube_videos` | ✅ |
| | `youtube_transcripts` | ✅ CASCADE |

### CalendarEvent

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `calendar_events` | ✅ |
| **Editar** | `calendar_events` | ✅ |
| **Vincular a mazo** | `calendar_events` | ✅ `linked_deck_id` |
| | `flashcard_decks` | ✅ `linked_event_id` |
| **Desvincular de mazo** | `calendar_events` | ✅ limpia `linked_deck_id` |
| | `flashcard_decks` | ✅ `linked_event_id = null` |
| **Eliminar** | `calendar_events` | ✅ |
| | `flashcard_decks.linked_event_id` | ✅ SET NULL (FK) |

### Schedule

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Crear** | `schedules` | ✅ |
| **Re-planificar** | `schedules` | ❌ No existe (solo crear y eliminar) |
| **Eliminar** | `schedules` | ✅ |

### LmsAccount

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Vincular** | `lms_accounts` | ✅ |
| | `grading_periods` | ✅ se importan |
| **Desvincular** | `lms_accounts` | ✅ se elimina |
| | `grading_periods` | ❌ No se limpian — quedan huérfanos |
| **Re-sincronizar** | `lms_accounts` | ❌ No existe |

---

## Acciones del Sistema

| Acción | Entidades afectadas | Estado actual |
|--------|-------------------|---------------|
| **Initial Sync** | 10 entidades | ✅ |
| **Delta Sync** | 9 tables + `sync_deletions` | ✅ |
| **SyncQueue: reducción** | sync_queue | ✅ reducer compacta |
| **Conflict: CLIENT_WINS** | entidad local | ✅ se sobreescribe servidor |
| **Conflict: SERVER_WINS** | entidad local | ✅ se sobreescribe local |
| **Backup subida** | assets (photo/audio/doc) | ✅ |
| **Backup restauración** | 6+ entidades + assets | ⚠️ vista previa faltante |
| **Limpieza de sync_queue** | `sync_queue` stale ops | ✅ retries ≥ 5 se limpian |

---

## Resumen de Mutaciones Faltantes

| Mutación faltante | Entidad origen | Entidad destino | Impacto |
|-------------------|---------------|-----------------|---------|
| ❌ Eliminar subject → CASCADE courses | Subject | Course | Datos huérfanos |
| ❌ Eliminar subject → CASCADE assessments | Subject | Assessment | Datos huérfanos |
| ❌ Eliminar subject → CASCADE schedules | Subject | Schedule | Datos huérfanos |
| ❌ Eliminar subject → CASCADE study_sessions | Subject | StudySession | Datos huérfanos |
| ❌ Eliminar assessment → limpiar linked_event_id | Assessment | FlashcardDeck | Referencia muerta |
| ❌ Duplicar deck → crear deck + tarjetas | FlashcardDeck | FlashcardDeck + Flashcards | Operación faltante |
| ❌ Mover flashcard → cambiar deck_id | Flashcard | FlashcardDeck | Operación faltante |
| ❌ Eliminar flashcard → decrementar card_count | Flashcard | FlashcardDeck | Contador inconsistente |
| ❌ Desvincular LMS → limpiar grading_periods | LmsAccount | GradingPeriod | Datos huérfanos |

---

*Generado: 2026-07-02. Toda acción nueva debe documentar sus mutaciones antes de implementarse.*


---
**Tags:** #product
