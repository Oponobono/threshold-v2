# Session Context

## Goal
Enable full offline functionality for flashcards (decks, cards, import) and document text extraction; fix calendar/UI positioning behind native navbar; show backup upload/download progress in system notifications; improve Zyren context selector with search, pagination, and category pills.

## Constraints & Preferences
- Spanish-language app (i18next).
- Offline-first architecture: SQLite + MMKV local storage, cloud sync when online.
- ForceOfflineMode toggle (useLocalAIStore) must be respected.
- Native navbar space must not be overlapped by modal content.

## Progress
### Done
- **Decks offline**: `FlashcardNewDeckScreen.tsx` — subject made optional; creation no longer requires `deckSubjectId`.
- **Import cards persisted**: `FlashcardImportModal.tsx` — after `saveImportedDeck`, each card now saved via `addLocalCard()` into MMKV.
- **Local decks visible in list**: `useFlashcardsManager.ts` — `loadDecks()` now merges MMKV local decks (`getLocalDecks()`) with SQLite decks via `mergeLocalDecks()`.
- **Cards read from both stores**: `flashcards.ts` — `getFlashcards`, `getFlashcardsPrioritized`, `getCardsNotSnoozed` now merge SQLite cards + MMKV cards via `mergeCards()` and `getLocalCardsFromMMKV()`.
- **PDF import hybrid OCR**: `PDFImportModal.tsx` — switched from `extractTextFromPDF` (cloud-first) to `extractTextFromPDFHybrid` (offline-first via `resolveProvider()`). Added user-visible alert on failure.
- **Scanner OCR for images**: `DocumentScannerModal.tsx` — moved OCR block before PDF/image bifurcation; now both export formats run `extractTextFromImageHybrid` and pass `ocr_text` to `createPhoto()` / `createScannedDocument()`.
- **Calendar modal bottom safe-area**: `EventCreationModal.tsx` — added `paddingBottom: insets.bottom` to content view and `paddingBottom: Math.max(insets.bottom, 20)` to `SubjectPickerSheet`'s pickerContent, preventing buttons and subject selector from clipping behind the native navbar.
- **Backup progress notifications**: `notificationService.ts` — added 8 functions (`showBackupUploadNotification`, `updateBackupUploadNotification`, `completeBackupUploadNotification`, `cancelBackupUploadNotification` and download equivalents) that show ongoing progress (X/Y items) and result (success/partial/error) in system notifications. `useBackupLogic.ts` — integrated them into `handleBackupNow` and `handleDownloadNow`. `scheduledBackupService.ts` — integrated into the background task for automatic backups. `locales/*/backup.json` — added missing `backup.partial` key.
- **Dashboard sheet modals bottom safe-area**: `CreateTaskModal.tsx`, `SubjectSelectorModal.tsx`, `CategorySelectorModal.tsx` — each now imports `useSafeAreaInsets` and applies `paddingBottom: Math.max(insets.bottom, 20)` to `sheetContent`, preventing action buttons from clipping behind the native navbar.
- **Zyren context selector redesigned**: `SubjectAIContextModal.tsx` — replaced bento grid with search bar (filters by OCR/transcript text), horizontally scrollable category pills with counts (Todos, Docs, Fotos, Grabaciones, Videos), content hidden until user searches or picks a category, max 10 items per page with "Ver más" pagination, compact list items with type icon + status. `AIContextItem.tsx` — added `searchText` field. `aiContextMappers.ts` — populate `searchText` from OCR/transcript. `locales/*/ai.json` — added `searchPlaceholder`, `searchPrompt`, `seeMore`, `ready`, `noText` keys; updated filter labels (filterAll→"Todos", filterAudio→"Grabaciones"/"Recordings").

### In Progress
- *(none)*

### Blocked
- *(none)*

## Key Decisions
- **Dual storage merge**: For imported decks, keep MMKV as canonical store for deck+cards, but merge with SQLite at read time so that cards added later via `createEvaluationItem` (which writes SQLite) are also visible. This avoids rewriting the entire card creation pipeline.
- **Hybrid routing for OCR/PDF extraction**: Use `extractTextFromImageHybrid` / `extractTextFromPDFHybrid` everywhere instead of raw cloud functions, so `forceOfflineMode` and connectivity are respected before attempting a network call.
- **Inline safe-area padding for modals**: Use `useSafeAreaInsets()` with inline `paddingBottom` rather than modifying StyleSheet definitions, to keep styles static and avoid per-device StyleSheet recreation.
- **Context selector: pagination over virtualization**: Show max 10 items per page with "Ver más" button instead of implementing virtualized lists. Simpler to maintain, gives user explicit control, and the typical dataset (<200 items) doesn't require windowing.
- **Context selector: content hidden until interaction**: Files not shown until user searches or selects a category. Drastically reduces cognitive load when there are many files.

## Next Steps
- Consider whether `Dashboard.styles.ts` `sheetContent` hardcoded `paddingBottom: 44/52` should be replaced with dynamic inset values passed via props or context.

## Relevant Files
- `mobile/src/components/flashcards/FlashcardNewDeckScreen.tsx`: subject made optional
- `mobile/src/components/flashcards/FlashcardImportModal.tsx`: now calls `addLocalCard` per card
- `mobile/src/hooks/useFlashcardsManager.ts`: merges local MMKV decks
- `mobile/src/services/api/flashcards.ts`: card-read functions merge SQLite + MMKV
- `mobile/src/components/modals/PDFImportModal.tsx`: switched to `extractTextFromPDFHybrid`
- `mobile/src/components/modals/DocumentScannerModal.tsx`: OCR runs for both image and PDF export
- `mobile/src/components/modals/EventCreationModal.tsx`: added bottom safe-area padding to content and SubjectPickerSheet
- `mobile/src/components/dashboard/CreateTaskModal.tsx`: task creation; now uses `useSafeAreaInsets` + inline `paddingBottom`
- `mobile/src/components/dashboard/SubjectSelectorModal.tsx`: subject selector; now uses `useSafeAreaInsets` + inline `paddingBottom`
- `mobile/src/components/dashboard/CategorySelectorModal.tsx`: category selector; now uses `useSafeAreaInsets` + inline `paddingBottom`
- `mobile/src/services/hybridAIService.ts`: `extractTextFromImageHybrid` and `extractTextFromPDFHybrid`
- `mobile/src/services/localOCRService.ts`: ML Kit text recognition (offline)
- `mobile/src/services/localPDFService.ts`: native PDF text extraction (offline)
- `mobile/src/services/notificationService.ts`: backup upload/download progress notification functions
- `mobile/src/hooks/useBackupLogic.ts`: backup/download hook with integrated notification calls
- `mobile/src/styles/Dashboard.styles.ts`: `sheetContent` with hardcoded bottom padding
- `mobile/src/locales/es/backup.json`: Spanish backup translations (added `partial` key)
- `mobile/src/locales/en/backup.json`: English backup translations (added `partial` key)
- `mobile/src/components/subjects/SubjectAIContextModal.tsx`: redesigned context selector with search, horizontal pills, pagination
- `mobile/src/components/ai/AIContextItem.tsx`: added `searchText` field to data type
- `mobile/src/utils/aiContextMappers.ts`: populate `searchText` from OCR/transcript
- `mobile/src/locales/es/ai.json`: Spanish AI translations (added search, seeMore, ready, noText; updated filter labels)
- `mobile/src/locales/en/ai.json`: English AI translations (added search, seeMore, ready, noText; updated filter labels)
