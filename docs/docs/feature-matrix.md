# Feature Matrix

Threshold se rige por un conjunto de matrices que documentan el ciclo de vida completo de cada entidad. Ninguna funcionalidad se considera completa hasta que todas las matrices estén en verde para esa entidad.

## Lifecycle Matrix (26+ entidades)

Cada entidad debe soportar 4 operaciones:

| Operación | Capa UI | Capa API | Capa Sync | Capa BD |
|---|---|---|---|---|
| **Crear** | Formulario / Modal | POST endpoint | Enqueue CREATE + push | INSERT |
| **Leer** | Pantalla de detalle | GET endpoint | Initial / Delta sync | SELECT |
| **Actualizar** | Formulario de edición | PUT endpoint | Enqueue UPDATE + push | UPDATE |
| **Eliminar** | Botón + confirmación | DELETE endpoint | Enqueue DELETE + push | Soft delete + sync_deletions |

### Estado de completitud por entidad

| Entidad | Crear | Leer | Actualizar | Eliminar | Sync |
|---|---|---|---|---|---|
| Subject | ✅ | ✅ | ✅ | ✅ | ✅ |
| Course | ✅ | ✅ | ✅ | ❌ CASCADE | ✅ |
| Assessment | ✅ | ✅ | ✅ | ❌ CASCADE | ✅ |
| AssessmentCategory | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Schedule | ✅ | ✅ | ✅ | ❌ CASCADE | ✅ |
| FlashcardDeck | ✅ | ✅ | ✅ | ✅ | ✅ |
| Flashcard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Photo | ✅ | ✅ | ✅ | ✅ | ✅ |
| AudioRecording | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| AudioTranscript | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| ScannedDocument | ✅ | ✅ | ❌ | ✅ | ✅ |
| YouTubeVideo | ✅ | ✅ | ❌ | ❌ | ✅ |
| YouTubeTranscript | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| CalendarEvent | ✅ | ✅ | ✅ | ✅ | ✅ |
| StudySession | ✅ | ✅ | ❌ | ❌ | ✅ |
| GradingPeriod | ✅ | ✅ | ✅ | ✅ | ✅ |
| LmsAccount | ✅ | ✅ | ✅ | ✅ | ✅ |
| ThresholdOverride | ✅ | ✅ | ✅ | ✅ | ✅ |

## State Machine Matrix

| Entidad | Estados | Transiciones documentadas |
|---|---|---|
| Flashcard | new → learning → review → mastered | ✅ |
| CardSnooze | active → snoozed → active | ✅ |
| SyncQueue | pending → failed → completed | ✅ |
| Asset | pending → uploading → uploaded / failed | ✅ |
| User | active → inactive → banned → deleted | ✅ |

## Relationship Matrix

Documenta todas las relaciones FK con su comportamiento ON DELETE. Ver [Ownership Matrix](/development/ownership-matrix) para detalles.

## Capability Matrix (IA por entidad)

| Entidad | Capacidad IA | Estado |
|---|---|---|
| Flashcard | Generación desde texto/imagen/audio/video | ✅ |
| AudioRecording | Transcripción Whisper + resumen Groq | ✅ |
| ScannedDocument | OCR on-device + cloud | ✅ |
| YouTubeVideo | Transcripción automática | ✅ |
| Chat | Zyren con contexto de materia | ✅ |

## Offline Matrix

| Entidad | CRUD offline | IA offline |
|---|---|---|
| Subject | ✅ | N/A |
| Flashcard | ✅ | ⚠️ (generación limitada) |
| Audio | ✅ | ⚠️ (Whisper local) |
| Photo | ✅ | N/A |
| Document | ✅ | ⚠️ (OCR local) |
| Chat | N/A | ⚠️ (llama.rn local) |
