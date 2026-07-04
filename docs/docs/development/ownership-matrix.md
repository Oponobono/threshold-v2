# Ownership Matrix

> Cada entidad tiene un **owner** y puede ser **owned by** otras. Si una entidad no tiene dueño claro, las operaciones de ciclo de vida son inconsistentes.

## Conceptos

| Término | Significado |
|---|---|
| **Owner** | Entidad que crea, elimina, y controla el ciclo de vida |
| **CASCADE** | Si el owner se elimina, el owned también |
| **SET NULL** | Si el owner se elimina, la referencia se anula |
| **RESTRICT** | No se puede eliminar el owner si tiene hijos |
| **ORPHAN** | El owned sobrevive sin owner (riesgo) |

## Árbol de Ownership

```
User (root)
├── Subject (owned by user)
│   ├── Course (CASCADE ❌ → ORPHAN)
│   ├── Assessment (CASCADE ❌ → ORPHAN)
│   ├── Photo (CASCADE ✅)
│   ├── AudioRecording (CASCADE backend / SET NULL mobile ⚠️)
│   │   └── AudioTranscript (CASCADE ✅)
│   ├── ScannedDocument (SET NULL ✅)
│   ├── YouTubeVideo (SET NULL ✅)
│   │   └── YouTubeTranscript (CASCADE ✅)
│   ├── FlashcardDeck (CASCADE ✅)
│   │   └── Flashcard (CASCADE ✅)
│   │       └── CardReview (CASCADE ✅)
│   │       └── CardSnooze (CASCADE ✅)
│   ├── Schedule (CASCADE ❌ → ORPHAN)
│   ├── StudySession (CASCADE ❌ → ORPHAN)
│   └── CalendarEvent (SET NULL ✅)
├── LmsAccount (CASCADE ✅)
├── ThresholdOverride (CASCADE ✅)
└── FlashcardDeck (shared) (CASCADE ✅)
    └── SharedDeck (CASCADE ✅)
```

## Matriz por Owner

| Owner | Owned entities | ON DELETE | Riesgo |
|---|---|---|---|
| **User** | Todo (root) | Varía | Medio |
| **Subject** | Course | ❌ NO ACTION | 🔴 ALTO |
| **Subject** | Assessment | ❌ NO ACTION | 🔴 ALTO |
| **Subject** | Photo | ✅ CASCADE | 🟢 OK |
| **Subject** | AudioRecording | ⚠️ Inconsistente | 🟡 Medio |
| **Subject** | ScannedDocument | ✅ SET NULL | 🟢 OK |
| **Subject** | YouTubeVideo | ✅ SET NULL | 🟢 OK |
| **Subject** | FlashcardDeck | ✅ CASCADE | 🟢 OK |
| **Subject** | Schedule | ❌ NO ACTION | 🔴 ALTO |
| **Subject** | StudySession | ❌ NO ACTION | 🔴 ALTO |
| **Subject** | CalendarEvent | ✅ SET NULL | 🟢 OK |
| **Subject** | ThresholdOverride | ✅ CASCADE | 🟢 OK |
| **FlashcardDeck** | Flashcard | ✅ CASCADE | 🟢 OK |
| **Flashcard** | CardReview | ✅ CASCADE | 🟢 OK |
| **AudioRecording** | AudioTranscript | ✅ CASCADE | 🟢 OK |
| **YouTubeVideo** | YouTubeTranscript | ✅ CASCADE | 🟢 OK |

## Riesgos Identificados

| Riesgo | Entidades | Severidad |
|---|---|---|
| Delete Subject → Courses huérfanos | Course | 🔴 Crítico |
| Delete Subject → Assessments huérfanos | Assessment | 🔴 Crítico |
| Delete Subject → Schedules huérfanos | Schedule | 🔴 Crítico |
| Delete Subject → StudySessions huérfanos | StudySession | 🔴 Crítico |
| Delete Assessment → linked_event_id no se limpia | FlashcardDeck | 🟡 Medio |
| AudioRecording cascade inconsistente | AudioRecording | 🟡 Medio |
| GradingPeriod sin FK a LmsAccount | GradingPeriod | 🟢 Bajo |
