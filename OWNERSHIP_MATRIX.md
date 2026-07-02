# Ownership Matrix — Propiedad y Cascadas entre Entidades

> Cada entidad tiene un **owner** y puede ser **owned by** otras.
> Si una entidad no tiene dueño claro, las operaciones de ciclo de vida son inconsistentes.
> Si la relación de ownership no tiene cascade definido, hay riesgo de datos huérfanos.

---

## Conceptos

| Término | Significado |
|---------|-------------|
| **Owner** | Entidad que crea, elimina, y controla el ciclo de vida |
| **Owned by** | Entidad que depende del owner para existir |
| **CASCADE** | Si el owner se elimina, el owned también |
| **SET NULL** | Si el owner se elimina, la referencia se anula |
| **RESTRICT** | No se puede eliminar el owner si tiene hijos |
| **ORPHAN** | El owned sobrevive sin owner (riesgo de datos inconsistentes) |
| **MOVE** | Preguntar al usuario a dónde re-asignar |

---

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
│       └── FlashcardDeck.linked_event_id (SET NULL ✅) [circular ref]
├── LmsAccount (CASCADE ✅)
│   └── GradingPeriod (?? ❌ — no cascade definido)
├── ThresholdOverride (CASCADE ✅)
├── FlashcardDeck (shared) (CASCADE ✅)
│   └── SharedDeck (CASCADE ✅)
└── SyncSettings / UserSettings (CASCADE ✅)
```

---

## Matriz de Ownership

### Por Owner

| Owner | Owned entities | Tipo de relación | ON DELETE actual | Riesgo |
|-------|---------------|-----------------|------------------|--------|
| **User** | Todo (root) | Parent absoluto | Varía por entidad | Medio — si se borra user, datos huérfanos sin cleanup |
| **Subject** | Course | Parent→Child | ❌ NO ACTION | 🔴 ALTO — courses huérfanos |
| **Subject** | Assessment | Parent→Child | ❌ NO ACTION | 🔴 ALTO — assessments huérfanos |
| **Subject** | Photo | Parent→Child | ✅ CASCADE | 🟢 OK |
| **Subject** | AudioRecording | Parent→Child | ⚠️ CASCADE bk / SET NULL mob | 🟡 Inconsistente |
| **Subject** | ScannedDocument | Parent→Child | ✅ SET NULL | 🟢 OK |
| **Subject** | YouTubeVideo | Parent→Child | ✅ SET NULL | 🟢 OK |
| **Subject** | FlashcardDeck | Parent→Child | ✅ CASCADE | 🟢 OK |
| **Subject** | Schedule | Parent→Child | ❌ NO ACTION | 🔴 ALTO — schedules huérfanos |
| **Subject** | StudySession | Parent→Child | ❌ NO ACTION | 🔴 ALTO — sessions huérfanos |
| **Subject** | CalendarEvent | Parent→Child | ✅ SET NULL | 🟢 OK |
| **Subject** | ThresholdOverride | Parent→Child | ✅ CASCADE | 🟢 OK |
| **FlashcardDeck** | Flashcard | Parent→Child | ✅ CASCADE | 🟢 OK |
| **FlashcardDeck** | SharedDeck | Parent→Child | ✅ CASCADE | 🟢 OK |
| **Flashcard** | CardReview | Parent→Child | ✅ CASCADE | 🟢 OK |
| **Flashcard** | CardSnooze | Parent→Child | ✅ CASCADE | 🟢 OK |
| **AudioRecording** | AudioTranscript | Parent→Child | ✅ CASCADE | 🟢 OK |
| **YouTubeVideo** | YouTubeTranscript | Parent→Child | ✅ CASCADE | 🟢 OK |
| **CalendarEvent** | FlashcardDeck.linked | Cross-ref | ✅ SET NULL | 🟢 OK |
| **LmsAccount** | GradingPeriod | Parent→Child | ❌ Sin FK directo | 🟡 Grading periods no se limpian |

### Por Owned Entity

| Owned | Owner(s) | ¿Puede existir sin owner? | ¿Qué pasa si el owner se elimina? |
|-------|---------|---------------------------|-----------------------------------|
| Subject | User | No | ❌ Orphan |
| Course | Subject | Sí (pero es raro) | ❌ ORPHAN — sin cascade |
| Assessment | Subject | Sí (pero es raro) | ❌ ORPHAN — sin cascade |
| Photo | Subject | Sí (SET NULL) | ✅ Subject_id=null |
| AudioRecording | Subject | Sí (SET NULL) | ⚠️ Depende de platform |
| AudioTranscript | AudioRecording | No | ✅ CASCADE |
| ScannedDocument | Subject | Sí (SET NULL) | ✅ Subject_id=null |
| YouTubeVideo | Subject | Sí (SET NULL) | ✅ Subject_id=null |
| YouTubeTranscript | YouTubeVideo | No | ✅ CASCADE |
| FlashcardDeck | Subject | Sí (SET NULL) | ✅ Subject_id=null (pero CASCADE en backend ⚠️) |
| Flashcard | FlashcardDeck | No | ✅ CASCADE |
| CardReview | Flashcard | No | ✅ CASCADE |
| CardSnooze | Flashcard | No | ✅ CASCADE |
| Schedule | Subject | Sí (pero inconsistente) | ❌ ORPHAN — sin cascade |
| StudySession | Subject | Sí (pero inconsistente) | ❌ ORPHAN — sin cascade |
| CalendarEvent | Subject | Sí (SET NULL) | ✅ Subject_id=null |
| GradingPeriod | LmsAccount | Sí | ❌ ORPHAN — no se limpia |
| ThresholdOverride | Subject | No | ✅ CASCADE |
| SharedDeck | FlashcardDeck | No | ✅ CASCADE |

---

## Reglas de Cascade por Escenario

### Escenario: Usuario elimina Subject

| ¿Qué pasa con... | Comportamiento actual | Comportamiento esperado |
|-----------------|---------------------|------------------------|
| Courses | ❌ Quedan huérfanos | CASCADE o ASK user |
| Assessments | ❌ Quedan huérfanos | CASCADE o ASK user |
| Photos | ✅ CASCADE | ✅ |
| AudioRecordings | ⚠️ CASCADE backend / SET NULL mobile | ✅ CASCADE (consistente) |
| ScannedDocuments | ✅ SET NULL | ✅ |
| YouTubeVideos | ✅ SET NULL | ✅ |
| FlashcardDecks | ⚠️ CASCADE backend (SQLite no enforced) | ✅ CASCADE |
| Schedules | ❌ Quedan huérfanos | CASCADE o ASK user |
| StudySessions | ❌ Quedan huérfanos | CASCADE |
| CalendarEvents | ✅ SET NULL | ✅ |
| ThresholdOverrides | ✅ CASCADE | ✅ |

### Escenario: Usuario elimina FlashcardDeck

| ¿Qué pasa con... | Comportamiento actual | Comportamiento esperado |
|-----------------|---------------------|------------------------|
| Flashcards | ✅ CASCADE | ✅ |
| CardReviews | ✅ CASCADE | ✅ |
| CardSnoozes | ✅ CASCADE | ✅ |
| CalendarEvent.linked | ✅ SET NULL (FK en DB) | ✅ |
| Mazos compartidos | ✅ CASCADE shared_decks | ✅ |

### Escenario: Usuario elimina Flashcard

| ¿Qué pasa con... | Comportamiento actual | Comportamiento esperado |
|-----------------|---------------------|------------------------|
| CardReviews | ✅ CASCADE | ✅ |
| CardSnoozes | ✅ CASCADE | ✅ |
| FlashcardDeck.card_count | ❌ No se decrementa | Debe decrementarse |

### Escenario: Usuario elimina AudioRecording

| ¿Qué pasa con... | Comportamiento actual | Comportamiento esperado |
|-----------------|---------------------|------------------------|
| AudioTranscripts | ✅ CASCADE | ✅ |
| Archivo de audio | ✅ Se elimina del asset store | ✅ |
| Subject ref | ❌ No aplica (FK en audio) | ✅ |

### Escenario: Usuario elimina LmsAccount

| ¿Qué pasa con... | Comportamiento actual | Comportamiento esperado |
|-----------------|---------------------|------------------------|
| GradingPeriods | ❌ Quedan huérfanos | CASCADE (limpiar períodos importados) |
| Grades importados | ❌ Quedan en la DB | Limpiar o marcar como "sin LMS" |

---

## Ownership de Operaciones (Quién puede hacer qué)

| Operación | User owner | User con share | Admin | Sistema (sync) |
|-----------|-----------|---------------|-------|----------------|
| Crear Subject | ✅ | — | — | ✅ (restore) |
| Eliminar Subject | ✅ | — | — | — |
| Crear FlashcardDeck | ✅ | — | — | ✅ (restore) |
| Eliminar FlashcardDeck | ✅ | ❌ (solo si own) | — | — |
| Compartir Mazo | ✅ | — | — | — |
| Ver Mazo compartido | ✅ | ✅ | — | — |
| Eliminar Mazo compartido | ✅ (propio) | ❌ | ✅ (grupo) | — |
| Ver estadísticas | ✅ | ✅ | — | — |

---

## Resumen de Riesgos de Ownership

| Riesgo | Entidades | Impacto | Prioridad |
|--------|-----------|---------|-----------|
| ❌ Subject→Courses sin CASCADE | Course | Datos huérfanos | 🔴 Alta |
| ❌ Subject→Assessments sin CASCADE | Assessment | Datos huérfanos | 🔴 Alta |
| ❌ Subject→Schedules sin CASCADE | Schedule | Datos huérfanos | 🔴 Alta |
| ❌ Subject→StudySessions sin CASCADE | StudySession | Datos huérfanos | 🔴 Alta |
| ❌ LmsAccount→GradingPeriod sin cascade | GradingPeriod | Datos huérfanos | 🟡 Media |
| ⚠️ AudioRecording cascade inconsistente | AudioRecording | Comportamiento variable | 🟡 Media |
| ❌ FlashcardDeck.card_count no se decrementa | FlashcardDeck | Contador incorrecto | 🟡 Media |

---

*Generado: 2026-07-02. Toda relación de ownership debe definirse explícitamente, no por omisión.*
