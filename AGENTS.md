# Session Context

## Goal
Enable full offline functionality for flashcards (decks, cards, import) and document text extraction; fix calendar/UI positioning behind native navbar; show backup upload/download progress in system notifications; improve Zyren context selector with search, pagination, and category pills. Additionally: build a unified Multi-Platform Course Hub (Platzi, Udemy, etc.) with hierarchical SectionList UI, atomic sync, Momentum tracking and AI-powered class ingestion.

## Constraints & Preferences
- Spanish-language app (i18next).
- Offline-first architecture: SQLite + MMKV local storage, cloud sync when online.
- ForceOfflineMode toggle (useLocalAIStore) must be respected.
- Native navbar space must not be overlapped by modal content.
- `React.memo` on list cards must be preserved — always wrap SectionList item handlers in `useCallback`.

## Progress
### Done
- **Decks offline**: `FlashcardNewDeckScreen.tsx` — subject made optional; creation no longer requires `deckSubjectId`.
- **Import cards persisted**: `FlashcardImportModal.tsx` — after `saveImportedDeck`, each card now saved via `addLocalCard()` into MMKV.
- **Local decks visible in list**: `useFlashcardsManager.ts` — `loadDecks()` now merges MMKV local decks (`getLocalDecks()`) with SQLite decks via `mergeLocalDecks()`.
- **Cards read from both stores**: `flashcards.ts` — `getFlashcards`, `getFlashcardsPrioritized`, `getCardsNotSnoozed` now merge SQLite cards + MMKV cards via `mergeCards()` and `getLocalCardsFromMMKV()`.
- **PDF import hybrid OCR**: `PDFImportModal.tsx` — switched from `extractTextFromPDF` (cloud-first) to `extractTextFromPDFHybrid` (offline-first via `resolveProvider()`). Added user-visible alert on failure.
- **Scanner OCR for images**: `DocumentScannerModal.tsx` — moved OCR block before PDF/image bifurcation; now both export formats run `extractTextFromImageHybrid` and pass `ocr_text` to `createPhoto()` / `createScannedDocument()`.
- **Calendar modal bottom safe-area**: `EventCreationModal.tsx` — added `paddingBottom: insets.bottom` to content view and `paddingBottom: Math.max(insets.bottom, 20)` to `SubjectPickerSheet`'s pickerContent, preventing buttons and subject selector from clipping behind the native navbar.
- **Backup progress notifications**: `notificationService.ts` — added 8 functions for upload/download progress and result. `useBackupLogic.ts` + `scheduledBackupService.ts` integrated. `locales/*/backup.json` — added `backup.partial` key.
- **Dashboard sheet modals bottom safe-area**: `CreateTaskModal.tsx`, `SubjectSelectorModal.tsx`, `CategorySelectorModal.tsx` — each now imports `useSafeAreaInsets` and applies `paddingBottom: Math.max(insets.bottom, 20)` to `sheetContent`.
- **Zyren context selector redesigned**: `SubjectAIContextModal.tsx` — search bar, horizontal category pills, "Ver mas" pagination (max 10/page), content hidden until interaction. `AIContextItem.tsx` — added `searchText`. `aiContextMappers.ts` — populate `searchText` from OCR/transcript.
- **Backup flow resilience**: `backupService.ts` — `POST /backup/mark` failures no longer throw. Files successfully uploaded to Uploadthing always marked `is_backed_up = 1` locally.
- **YouTube transcripts query fixed**: `backupService.ts` — removed invalid column filter. Migration v2 adds `is_backed_up` + `cloud_url` to `youtube_videos`.
- **Migration runner fixed**: `DatabaseService.ts` — removed `PRAGMA user_version = 0` hack; incremental migrations now run exactly once. `PRAGMA foreign_keys = ON` active.
- **Backend mark logging**: `backupController.js` — `console.error` on every `db.run` failure.
- **PostgreSQL id type fix**: `migrations/fix-id-type.js` — converts PK id columns from INTEGER to TEXT.
- **Scheduled backup UI clean up**: `settings.tsx` — flat `SettingRow` + `actionRow` pattern.
- **[HUB] Migration v7**: `migrations.ts` — `courses` table (momentum_score, last_studied_at, platform). Added `course_id`, `external_url`, `total_lessons`, `completed_lessons`, `next_micro_milestone` to `subjects`. `ON DELETE SET NULL` on `course_id`.
- **[HUB] CourseRepository**: `CourseRepository.ts` — SQLite CRUD. Registered in `repositories/index.ts`.
- **[HUB] Backend UPSERT for courses**: `coursesController.js` — `INSERT ... ON CONFLICT (id) DO UPDATE SET`. Route registered in `server.js`.
- **[HUB] Atomic sync ordering**: `SyncService.ts` — items sorted `course -> subject -> *` before processing.
- **[HUB] useGroupedSubjects hook**: `useGroupedSubjects.ts` — SectionList sections grouped by course, `collapsedCourses` state, `aggregatedMomentumScore` (average of all courses' momentum_score).
- **[HUB] CourseAccordion**: `CourseAccordion.tsx` — sticky header, animated chevron, platform pill.
- **[HUB] CourseSubjectCard**: `CourseSubjectCard.tsx` — `React.memo` card with pills, "Continuar" deep-link button, "Marcar clase terminada" bicephalous trigger.
- **[HUB] subjects.tsx refactor**: Replaced ScrollView+map with `SectionList`. All `renderItem` handlers wrapped in `useCallback` to preserve `React.memo`. `MomentumCard` reads `aggregatedMomentumScore` (was hardcoded 0.85).
- **[HUB] MomentumService**: `MomentumService.ts` — logarithmic decay after 72h (`0.05 * Math.log1p(hoursOverdue)`), `boostMomentum` (+15%), `updateAllMomentumScores` on app start via `appInit.ts`.
- **[HUB] Deep Linking fixed**: `linking.ts` — reescrito con estrategia correcta: (1) esquema nativo `vnd.youtube:` para YouTube, (2) `Linking.openURL(https_url)` directo para todas las demás plataformas (Udemy, Coursera, Platzi, etc.) — el SO intercepta Universal Links/App Links y abre la app si está instalada, (3) `WebBrowser` solo si Linking falla por completo. Eliminados esquemas falsos `coursera://`, `udemy://`, `platzi://`. `app.json` actualizado con `LSApplicationQueriesSchemes` (iOS) y `intentFilters` (Android) para YouTube. `CourseAccordion.tsx` y `CourseHeroCard.tsx` ahora pasan `platform` a `openCourseLink`.
- **[HUB] Zyren Ingestion endpoint**: `aiController.js` — `generateClassFlashcards` uses `llama-3.3-70b-versatile`. Strict JSON contract in system prompt. Double sanitization (Markdown strip + regex fallback). Route: `POST /api/ai/class-flashcards`.
- **[HUB] ZyrenIngestionModal**: `ZyrenIngestionModal.tsx` — 3-step (Input->Preview->Saving). Saves via `saveImportedDeck` + `addLocalCard` + `recalculateLocalDeckCounters`. `subjectId` passed correctly.
- **[HUB] Audit**: `useCallback` applied to handlers; `aggregatedMomentumScore` connected to Hero Card; `subjectId` fixed in modal.
- **Fix subject-course link persistence**: `mergeWithLocal()` cambia `!== undefined` por `!= null` para `course_id`, `external_url`, `next_micro_milestone`. `getSubjectById()` usa `mergeWithLocal()`. Se agregan `updateCourseCounters()` y `repairSubjectCourseLinks()` en `subjects.ts`.
- **Fix deck subject display**: `localDeckToFlashcardDeck()` resuelve subject metadata desde `subjects[]`. Backend `getGroupDecks` hace `LEFT JOIN subjects`. `LocalDeck` agrega `subject_name/color/icon`.
- **Fix course loading sync**: `useDataStore` ahora almacena `courses[]` en Zustand, cargándolos síncronamente desde SQLite local. `getCourses()` ya no descarta el resultado. `useGroupedSubjects` recibe `courses` como prop eliminando `useFocusEffect` + `courseRepository.getAll()` asíncrona.

### In Progress
- *(none)*

### Blocked
- *(none)*

## Key Decisions
- **Dual storage merge**: MMKV canonical for deck+cards; merge with SQLite at read time.
- **Hybrid routing for OCR/PDF extraction**: `extractTextFromImageHybrid` / `extractTextFromPDFHybrid` everywhere.
- **Inline safe-area padding for modals**: `useSafeAreaInsets()` with inline `paddingBottom`.
- **Context selector: pagination over virtualization**: Max 10 items/page with "Ver mas" button.
- **Context selector: content hidden until interaction**: Reduces cognitive load.
- **Hub: Data-Driven collapse**: SectionList data array emptied on collapse (not CSS hidden).
- **Hub: aggregatedMomentumScore**: Arithmetic mean of all courses exposed from `useGroupedSubjects`.
- **Hub: useCallback for SectionList handlers**: All handlers to `CourseSubjectCard` must be `useCallback` — otherwise `React.memo` is bypassed on every parent re-render.
- **Hub: Zyren ingestion reuses Groq infra**: No new API key. `generateClassFlashcards` follows same pattern as `generateStudyMaterial` with stricter JSON-only prompt.
- **Hub: Deep link strategy**: NO usar esquemas custom inventados (`coursera://`, `udemy://`, `platzi://`). Solo `vnd.youtube:` para YouTube. Para todo lo demás: `Linking.openURL(https)` — el SO activa Universal Links/App Links. `WebBrowser` solo como último recurso de emergencia.

## Next Steps
- Consider whether `Dashboard.styles.ts` `sheetContent` hardcoded `paddingBottom: 44/52` should be replaced with dynamic inset values.
- Audit note (INFO): Migration v6 duplicates `assessment_files` table already in v3. No crash (`IF NOT EXISTS`), but dirty log. Consider cleanup migration.
- Future: After user returns from external class URL, trigger `boostMomentum` automatically.

## Relevant Files
- `mobile/src/components/flashcards/FlashcardNewDeckScreen.tsx`: subject made optional
- `mobile/src/components/flashcards/FlashcardImportModal.tsx`: now calls `addLocalCard` per card
- `mobile/src/hooks/useFlashcardsManager.ts`: merges local MMKV decks
- `mobile/src/services/api/flashcards.ts`: card-read functions merge SQLite + MMKV
- `mobile/src/components/modals/PDFImportModal.tsx`: switched to `extractTextFromPDFHybrid`
- `mobile/src/components/modals/DocumentScannerModal.tsx`: OCR runs for both image and PDF export
- `mobile/src/components/modals/EventCreationModal.tsx`: added bottom safe-area padding
- `mobile/src/components/dashboard/CreateTaskModal.tsx`: useSafeAreaInsets + inline paddingBottom
- `mobile/src/components/dashboard/SubjectSelectorModal.tsx`: useSafeAreaInsets + inline paddingBottom
- `mobile/src/components/dashboard/CategorySelectorModal.tsx`: useSafeAreaInsets + inline paddingBottom
- `mobile/src/services/hybridAIService.ts`: extractTextFromImageHybrid and extractTextFromPDFHybrid
- `mobile/src/services/localOCRService.ts`: ML Kit text recognition (offline)
- `mobile/src/services/localPDFService.ts`: native PDF text extraction (offline)
- `mobile/src/services/notificationService.ts`: backup upload/download progress notification functions
- `mobile/src/hooks/useBackupLogic.ts`: backup/download hook with integrated notification calls
- `mobile/src/services/backup/backupService.ts`: resilient mark flow; youtube_videos query fixed
- `mobile/src/services/database/DatabaseService.ts`: PRAGMA foreign_keys = ON; incremental migrations
- `mobile/src/services/database/migrations.ts`: v7 adds courses table + subjects columns
- `mobile/src/services/database/repositories/CourseRepository.ts`: SQLite CRUD for courses
- `mobile/src/services/database/repositories/index.ts`: exports CourseRepository
- `mobile/src/services/database/appInit.ts`: sync handler; MomentumService startup call
- `mobile/src/services/database/SyncService.ts`: atomic ordering course->subject
- `mobile/src/services/MomentumService.ts`: logarithmic decay, boostMomentum, updateAllMomentumScores
- `mobile/src/hooks/useGroupedSubjects.ts`: SectionList sections, collapse state, aggregatedMomentumScore
- `mobile/src/components/subjects/CourseAccordion.tsx`: sticky header with animated chevron
- `mobile/src/components/subjects/CourseSubjectCard.tsx`: React.memo card with pills and bicephalous trigger
- `mobile/src/components/subjects/ZyrenIngestionModal.tsx`: 3-step ingestion modal (Input->Preview->Saving)
- `mobile/src/utils/linking.ts`: openCourseLink con estrategia en capas: vnd.youtube → Linking.openURL(https) → WebBrowser fallback
- `mobile/app/(tabs)/subjects.tsx`: SectionList hub with useCallback handlers, reactive MomentumCard
- `backend/controllers/aiController.js`: generateClassFlashcards endpoint (Groq llama-3.3-70b)
- `backend/routes/ai.js`: POST /api/ai/class-flashcards registered
- `backend/controllers/coursesController.js`: UPSERT logic for courses
- `backend/controllers/backupController.js`: error detail logging to mark endpoint
- `backend/database/migrations/fix-id-type.js`: converts PK id columns from INTEGER to TEXT
- `mobile/src/styles/Settings.styles.ts`: removed obsolete scheduledBackup* styles
- `mobile/src/styles/Dashboard.styles.ts`: sheetContent with hardcoded bottom padding
- `mobile/src/locales/es/backup.json`: added partial key
- `mobile/src/locales/en/backup.json`: added partial key
- `mobile/src/components/subjects/SubjectAIContextModal.tsx`: redesigned context selector
- `mobile/src/components/ai/AIContextItem.tsx`: added searchText field
- `mobile/src/utils/aiContextMappers.ts`: populate searchText from OCR/transcript
- `mobile/src/locales/es/ai.json`: added search, seeMore, ready, noText keys
- `mobile/src/locales/en/ai.json`: added search, seeMore, ready, noText keys

## Strategic Reference: RemNote Benchmarking

Feature priorities adapted from RemNote for mobile-first offline architecture:

### P1 — High Impact, Low Effort

1. **Direction flag on cards** (`direction: 'forward' | 'backward' | 'bidirectional'`)
   - Add `direction` column to `flashcards` table in SQLite (default `'forward'`)
   - Study session engine reads flag and generates inverse render dynamically (no duplicate cards)
   - Schema: `ALTER TABLE flashcards ADD COLUMN direction TEXT NOT NULL DEFAULT 'forward'`
   - Migration v8, ~50 lines in `useStudySession.ts`

2. **Source Context** (source_context TEXT on flashcards)
   - Add `source_context` column; populated by OCR/import/creation flows
   - Study screen shows discreet "Context" button → opens bottom sheet with original text
   - No graph engine needed — just a TEXT field per card

### P2 — High Impact, Moderate Effort

3. **Exam Scheduler** (temporal SRS compression)
   - Exam date flag on deck/subject (`exam_date` nullable TIMESTAMP in subjects or flashcard_decks)
   - Zustand store reads exam date → overrides SRS interval multiplier in `MomentumService.getNextReview`
   - Algorithm: `compressedInterval = baseInterval * max(0.2, 1 - (daysUntilExam / totalDaysToStudy))`
   - Integrates with existing `MomentumService.ts`

### P3 — Differentiator, Higher Effort

4. **Touch-native image occlusion**
   - Canvas overlay on image using `react-native-svg` or `react-native-canvas`
   - User draws rectangles to hide portions → stores shapes as JSON in `flashcard.source_context` or new `image_occlusion` table
   - Study mode renders image + occlusions as touch-to-reveal zones

5. **Inline floating toolbar over keyboard**
   - Custom `InputAccessoryView` (iOS) / `WindowInsets` (Android) with card-type shortcuts
   - Avoids symbol typing on mobile keyboards

6. **Contextual AI generation from local text**
   - After OCR/PDF capture, auto-suggest front/back pairs using Groq
   - Reuses existing `generateClassFlashcards` endpoint with captured text as context
