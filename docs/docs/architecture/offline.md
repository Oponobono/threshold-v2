# Arquitectura Offline

## Filosofía

Threshold funciona completamente offline excepto los servicios de IA (Zyren, OCR cloud, generación de mazos desde audios/fotos/videos). Toda operación de lectura y escritura académica (materias, evaluaciones, horarios, flashcards, repaso FSRS) está diseñada para operar sin conexión y sincronizar automáticamente al recuperar red.

## Estrategia General

**Stale-while-revalidate**: El caché local nunca se elimina por TTL. Los datos expirados se sirven siempre para evitar pantallas en blanco, y el store decide cuándo refrescar según conectividad.

```
Servidor ──► fetch ──► useDataStore ──► UI
               │
               ▼ (fallback)
           MMKV Cache ◄──── stale-while-revalidate
```

## Cache de Lectura (cacheService.ts)

- Usa **MMKV** como almacenamiento síncrono
- Cada entrada tiene un `TTL` pero `loadFromCacheSync` **no elimina datos expirados**: los retorna con log de stale
- `loadAllData` verifica `connectivityStore.isOnline` antes de llamar al servidor
- `preloadOfflineCache` no sobrescribe arrays vacíos

### Claves de caché

- `subjects`, `assessments:{subjectId}`, `schedule:{subjectId}`
- `flashcard_decks`, `flashcard_decks_with_metrics`
- `flashcards_by_deck:{deckId}`, `flashcards_prioritized:{deckId}`
- `cards_not_snoozed:{deckId}`, `predictions`, `user_data`, `profile`

## Escrituras Offline (offlineSyncService.ts)

- Cola FIFO persistente en MMKV bajo `sync:pending_operations`
- Cada operación: `id`, `type` (POST/PUT/DELETE), `endpoint`, `payload`, `timestamp`, `retries`, `maxRetries` (3)
- Write lock con Promises encadenadas

### Tipos de operación

| operationType | Descripción |
|---|---|
| `subject` | Crear materia |
| `assessment` | Crear/editar evaluación |
| `schedule` | Crear/editar horario |
| `photo` | Subir foto |
| `flashcard_review` | Registro FSRS |
| `flashcard_status` | Actualizar estado |
| `flashcard_snooze` | Aplazar tarjeta |
| `flashcard_delete` | Eliminar tarjeta |

### Sincronización automática

Se dispara desde `useAutoSync.ts` cuando:
1. `connectivityStore.isOnline` cambia de false a true
2. Se llama `syncPendingOperations()` manualmente
3. Al recuperar conexión: sincroniza operaciones → `loadAllData(true)`

## Card Logs (offlineQueue.ts)

Cola independiente para `card_logs` (respuestas de estudio) usando **AsyncStorage**. `createCardLogWithFallback` intenta enviar al servidor; si falla, encola.

## Carga de Pantalla Offline (useSubjectDetail.ts)

Cada llamada API tiene fallback al caché cuando `isOnline === false`:

| Dato | Fallback offline |
|---|---|
| `selectedSubject` | `storeSubjects.find(s => s.id === subjectId)` |
| `profile` | `cacheService.loadProfile()` |
| `photos` | `cacheService.loadPhotosBySubject(id)` |
| `scannedDocuments` | `cacheService.loadScannedDocumentsBySubject(id)` |
| `schedules` | `storeSchedules.filter(s => s.subject_id === subjectId)` |
| `youtubeVideos` | `cacheService.loadYouTubeVideos()` + filtrar |
| `assessments` | `storeAssessments.filter(a => a.subject_id === subjectId)` |

### Flujo de carga offline

```
useSubjectDetail mount
       │
       ├── selectedSubject ← storeSubjects.find(id)  (síncrono)
       ├── schedules ← storeSchedules.filter(id)      (síncrono)
       │
       ▼
  Promise.allSettled([8 API calls])
       │
       ├── fulfilled → usar valor del servidor
       └── rejected + offline → leer desde cacheService
                                   │
                                   ▼
                             MMKV cache (stale-while-revalidate)
```

## Edge Cases

| Caso | Comportamiento |
|---|---|
| Offline al iniciar app | `loadAllData` retorna temprano, preserva estado actual |
| Cache vacío + offline | Pantallas muestran `isInitialLoading: true` o empty states |
| Operación falla 3 veces | Se descarta de la cola con log |
| Delete offline de tarjeta | Se elimina localmente + se encola DELETE; 404 en servidor se maneja como éxito |
| Snooze offline | Cálculo de `snoozedUntil` es local; al sincronizar el servidor recalcula |
| Predicciones offline | `loadPredictionsFromCache` retorna datos aunque estén expirados |
