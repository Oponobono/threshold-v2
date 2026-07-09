# Fallas de Comportamiento Offline

## Resumen

Se identificaron y corrigieron **20 bugs** en la arquitectura offline de la app. A continuación se detalla cada uno con su ubicación, síntoma, causa raíz y solución aplicada.

---

### 1. `mobile/src/hooks/useSubjectDetail.ts` — Sin fallback a caché offline

**Síntoma:** Al abrir una materia sin conexión, la pantalla muestra fotos, documentos, horarios y videos vacíos (arrays `[]`), aunque haya datos cacheados.

**Causa raíz:** El `Promise.allSettled` con 8 llamadas API solo manejaba `status === 'fulfilled'`. Cuando todas fallaban (offline), los estados `photos`, `scannedDocuments`, `subjectSchedules`, `videos` permanecían en sus valores iniciales vacíos. No había ningún bloque `else if (status === 'rejected')` con fallback a `cacheService`.

**Solución aplicada:** Para cada promesa rechazada + modo offline, se agrega un fallback que lee del caché:
- `profile` → `cacheService.loadProfile()`
- `photos` → `cacheService.loadPhotosBySubject(id)`
- `scannedDocuments` → `cacheService.loadScannedDocumentsBySubject(id)`
- `schedules` → `useDataStore.getState().schedules.filter(...)` (ya hidratado desde MMKV)
- `videos` → `cacheService.loadYouTubeVideos()` + filtrado por `subject_id`

**Archivo:** `mobile/src/hooks/useSubjectDetail.ts:130-175`

---

### 2. `mobile/src/services/api/client.ts` — Stale-while-revalidate roto en caché expirado

**Síntoma:** Cuando el caché de `fetchWithFallback` tenía más de 10 minutos de antigüedad y el dispositivo estaba offline, la app no servía los datos y lanzaba error de red.

**Causa raíz:** En el bloque de fallback, el código comparaba `age <= API_CACHE_TTL_MS` para decidir si servir el caché. Si estaba expirado, asignaba `undefined` a `data` y no retornaba la respuesta, dejando que la función lanzara `lastError`.

**Solución aplicada:** Se eliminó la comprobación de TTL en el fallback offline. Ahora siempre se sirve el dato cacheados (incluso expirado) cuando todas las URLs fallaron, cumpliendo la estrategia stale-while-revalidate documentada.

Lo mismo se aplicó al manejador de `304 Not Modified`: antes descartaba el caché expirado; ahora lo sirve igual.

**Archivo:** `mobile/src/services/api/client.ts:374-403` y `:325-352`

---

### 3. `mobile/src/services/api/client.ts` — Sin verificación de conectividad global temprana

**Síntoma:** Durante los primeros 10 segundos sin internet, cada llamada `fetchWithFallback` intentaba todas las URLs (con timeouts) antes de llegar al caché, causando demoras acumulativas de hasta 30-60 segundos en pantalla.

**Causa raíz:** La guarda `if (isOffline)` solo verificaba `useLocalAIStore.getState().forceOfflineMode`, que se activa con un retardo de 10s en `useAutoSync.ts`. No consultaba `connectivityStore.isOnline`, que refleja el estado en tiempo real vía `NetInfo`.

**Solución aplicada:** Se agregó verificación de `useConnectivityStore.getState().isOnline` junto al flag `forceOfflineMode`. Si cualquiera de los dos indica offline, se salta la fase de red y va directo al caché.

**Archivo:** `mobile/src/services/api/client.ts:245-249`

---

### 4. `mobile/src/hooks/useSubjectGrades.ts` — Variable `offlineProjection` no utilizada

**Síntoma:** Linter warning y código muerto.

**Causa raíz:** La línea `const [offlineProjection] = useState(() => calculateProjection(...))` creaba un estado que nunca se leía. La proyección local se recalcula en el `useEffect` cuando `isOnline === false`.

**Solución aplicada:** Se eliminó la declaración del estado `offlineProjection`.

**Archivo:** `mobile/src/hooks/useSubjectGrades.ts:55`

---

### 5. `mobile/src/services/api/flashcards.ts` — `deleteFlashcard` limpiaba llaves de caché incorrectas

**Síntoma:** Al eliminar una tarjeta, se invocaba `cacheService.clearKey(CACHE_KEYS.FLASHCARDS_BY_DECK)` sin el `deckId`, intentando limpiar la llave base `cache:flashcards_by_deck:` en lugar de `cache:flashcards_by_deck:42`. Esto era un no-op pero código engañoso.

**Causa raíz:** La función `deleteFlashcard` solo recibe `cardId`, no `deckId`, por lo que no puede construir las llaves correctas. El código original intentaba limpiar las constantes base en lugar de las llaves específicas del mazo.

**Solución aplicada:** Se eliminaron las 3 líneas de limpieza de caché incorrectas. La sincronización post-offline ya refresca los datos completos mediante `loadAllData(true)`.

**Archivo:** `mobile/src/services/api/flashcards.ts:482-484`

---

### 6. Cache fallback para `getFlashcardDecksWithMetrics` — Bugs 11/12

**Síntoma:** La pantalla de mazos no carga datos cuando no hay conexión, mostrando "sin mazos" aunque haya datos cacheados.

**Causa raíz:** `getFlashcardDecksWithMetrics` no tenía fallback al caché MMKV.

**Solución aplicada:** Se agregó try/catch con fallback a `cacheService.loadFlashcardDecksWithMetrics()`. Como fallback adicional, si no hay métricas cacheadas, intenta cargar desde `localFlashcardService.getLocalDecks()`.

**Archivos:** `mobile/src/services/api/flashcards.ts:56-74`

---

### 7. Cache fallback para `getCalendarEvents` — Bug 18

**Síntoma:** Los eventos del calendario no se muestran en modo offline.

**Causa raíz:** `getCalendarEvents` no tenía try/catch ni fallback a cache.

**Solución aplicada:** Se envolvió en try/catch con fallback a `cacheService.loadCalendarEvents()`. Los datos exitosos se persisten con `cacheService.saveCalendarEvents()`.

**Archivo:** `mobile/src/services/api/calendar.ts:69-105`

---

### 8. Cache fallback para `getPredictions` — Bug 20

**Síntoma:** Las predicciones FSRS no se cargan sin conexión.

**Causa raíz:** `getPredictions` no guardaba ni leía del caché.

**Solución aplicada:** Se agregó try/catch con persistencia y fallback a `cacheService.savePredictions()` / `loadPredictions()`.

**Archivo:** `mobile/src/services/api/analytics.ts:39-53`

---

### 9. Cache fallback para `getSemesterSummary` — Bugs 16/17

**Síntoma:** El delta del semestre es inconsistente entre subjects.tsx y la pantalla de detalle cuando hay datos cacheados.

**Causa raíz:** `getSemesterSummary` (usado por subjects.tsx) no tenía cache. En offline, la API lanzaba error mientras que el detalle usa proyección local.

**Solución aplicada:** Se agregó cache con `cacheService.saveSemesterSummary()` / `loadSemesterSummary()`.

**Archivo:** `mobile/src/services/api/analytics.ts:285-315`

---

### 10. Cache fallback para `getGlobalGPAAnalytics` — Bug 19

**Síntoma:** La pantalla de calificaciones no muestra GPA global sin conexión.

**Causa raíz:** `getGlobalGPAAnalytics` lanzaba error en catch sin intentar cache.

**Solución aplicada:** Se agregó `cacheService.saveGlobalGPAAnalytics()` en éxito y `loadGlobalGPAAnalytics()` en fallback.

**Archivos:** `mobile/src/services/api/analytics.ts:331-379` y `mobile/src/services/cacheService.ts:34,65-66,210-215`

---

### 11. Cache fallback para `getGradingPeriods` — Bugs 21/23

**Síntoma:** Los períodos de calificación no se cargan en settings sin conexión.

**Causa raíz:** `getGradingPeriods` no tenía try/catch ni cache.

**Solución aplicada:** Se agregó try/catch con persistencia usando `cacheService.saveGradingSystems()` / `loadGradingSystems()`.

**Archivo:** `mobile/src/services/api/settings.ts:39-56`

---

### 12. Datos optimistas no persisten en cache al crear offline — Bugs 1, 6, 7, 8, 10

**Síntoma:** Datos creados sin conexión (materias, fotos, documentos, evaluaciones) no aparecen en UI hasta sincronizar.

**Causa raíz:** `create*` retornaban objeto optimista con `_isPending: true` pero no lo guardaban en cache MMKV.

**Solución aplicada:** En cada `create*` offline, tras encolar en `offlineSyncService`, se persiste el objeto en cache:
- `createSubject` → `cacheService.saveSubjects()` (prepend)
- `createPhoto` → `cacheService.savePhotosBySubject(subjectId)` (prepend)
- `createScannedDocument` → `cacheService.saveScannedDocumentsBySubject(subjectId)` (prepend)
- `createAssessment` → `cacheService.saveAssessments()` (prepend)
- IDs temporales: `-Date.now()` en lugar de `-1` para unicidad

**Archivos:** `subjects.ts:117-134`, `photos.ts:65-83`, `documents.ts:84-97`, `assessments.ts:69-83`

---

### 13. `deleteFlashcardDeck` sin actualizar cache local — Bug 13

**Síntoma:** Mazo eliminado offline seguía visible en UI.

**Causa raíz:** Rama offline de `deleteFlashcardDeck` solo encolaba operación sin eliminar del cache.

**Solución aplicada:** En rama offline, se filtran mazos eliminados de `flashcardDecks` y `flashcardDecksWithMetrics` en cache, y se limpian llaves específicas del deck.

**Archivo:** `mobile/src/services/api/flashcards.ts:337-351`

---

### 14. Nuevos cache keys: GLOBAL_GPA y SEMESTER_SUMMARY

| Cache Key | TTL | Métodos |
|-----------|-----|---------|
| `cache:global_gpa` | 15 min | `saveGlobalGPAAnalytics()` / `loadGlobalGPAAnalytics()` |
| `cache:semester_summary` | 15 min | `saveSemesterSummary()` / `loadSemesterSummary()` |

**Archivo:** `mobile/src/services/cacheService.ts:34-35, 65-66, 210-215`

---

### 15. IDs temporales únicos para objetos offline

Se cambió `id: -1` fijo por `id: -Date.now()` en todos los `create*` offline para evitar colisiones de IDs temporales.

**Archivos:** `subjects.ts`, `assessments.ts`, `documents.ts`, `photos.ts`, `flashcards.ts`

---

## Bugs No Corregidos (7 pendientes)

| # | Descripción | Tipo |
|---|-------------|------|
| 2 | Materia duplicada al sincronizar | Backend |
| 3 | Materia sin nombre con id temporal | UI |
| 5 | Rendimiento modelos locales | Config/Modelo |
| 9 | Personalidad Zyren ignorada local | AI Service |
| 15 | Whisper tiny no persiste tras reinicio | Almacenamiento |
| 24 | Notificaciones no marcar leídas offline | Hook |
| 25 | text key missing _isPending | UI |
| 26 | Botón cancelar no funciona offline | UI |
| 27 | Falta storage check descarga modelos | UI |


---
**Tags:** #sync
