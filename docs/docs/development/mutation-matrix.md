# Mutation Matrix

> Toda acción del usuario (o del sistema) produce mutaciones en una o más entidades. Si una mutación esperada no ocurre, hay un bug — aunque la acción principal funcione.

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Mutación ocurre correctamente |
| ❌ | Mutación debiera ocurrir pero no ocurre |
| ⚠️ | Mutación ocurre pero incompleta o inconsistente |
| — | No debería mutar |

## Subject

| Acción | Efectos | Estado |
|---|---|---|
| Crear | subjects | ✅ |
| Editar | subjects | ✅ |
| Eliminar | subjects | ✅ |
| | courses | ❌ NO CASCADE |
| | assessments | ❌ NO CASCADE |
| | photos | ✅ CASCADE |
| | audio_recordings | ⚠️ CASCADE backend, SET NULL mobile |
| | scanned_documents | ✅ SET NULL |
| | youtube_videos | ✅ SET NULL |
| | flashcard_decks | ✅ CASCADE |
| | schedules | ❌ NO CASCADE |
| | study_sessions | ❌ NO CASCADE |
| | calendar_events | ✅ SET NULL |
| | threshold_overrides | ✅ CASCADE |
| | sync_deletions | ✅ |

## Assessment

| Acción | Efectos | Estado |
|---|---|---|
| Vincular a mazo | flashcard_decks.linked_event_id | ✅ |
| | calendar_events.linked_deck_id | ✅ |
| Desvincular de mazo | flashcard_decks.linked_event_id = null | ✅ |
| | calendar_events CSV limpio | ✅ |
| Eliminar | assessments | ✅ |
| | flashcard_decks.linked_event_id | ❌ No se limpia |
| | calendar_events | ❌ No hay relación directa |

## FlashcardDeck

| Acción | Efectos | Estado |
|---|---|---|
| Crear | flashcard_decks | ✅ |
| Editar | flashcard_decks | ✅ |
| Duplicar | flashcard_decks | ❌ No existe |
| | flashcards | ❌ No existe |
| Eliminar | flashcard_decks | ✅ |
| | flashcards | ✅ CASCADE |
| | card_logs | ✅ CASCADE |
| | card_snoozes | ✅ CASCADE |
| | shared_decks | ✅ CASCADE |
| | calendar_events.linked_deck_id | ✅ SET NULL |

## Flashcard

| Acción | Efectos | Estado |
|---|---|---|
| Crear | flashcards | ✅ |
| Editar | flashcards | ✅ |
| Mover a otro mazo | flashcards.deck_id | ❌ No existe |
| | flashcard_decks.card_count | ❌ No se actualiza |
| Duplicar | flashcards | ❌ No existe |
| Eliminar | flashcards | ✅ |
| | card_logs | ✅ CASCADE |
| | card_snoozes | ✅ CASCADE |

## Hallazgos Críticos

| Brecha | Impacto | Prioridad |
|---|---|---|
| Delete Subject no cascadea Courses, Assessments, Schedules, StudySessions | Datos huérfanos | 🔴 Alta |
| Delete Assessment no limpia linked_event_id en FlashcardDeck | Deck apunta a examen inexistente | 🔴 Alta |
| Duplicar Deck no existe | Usuario no puede copiar mazos | 🟡 Media |
| Duplicar Flashcard no existe | Usuario no puede copiar tarjetas | 🟡 Media |
| Mover Flashcard entre mazos no existe | Usuario no puede reorganizar | 🟡 Media |
| Editar AudioRecording no existe | Usuario no puede renombrar grabaciones | 🟢 Baja |
| AudioTranscript CREATE no siempre existe | Algunas transcripciones no se crean | 🟢 Baja |
