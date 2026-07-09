# Arquitectura Offline de Threshold

## Filosofía

La app funciona completamente offline excepto los servicios de IA ([[ZYREN_BORN|Zyren]], escaneo, generación de [[FLASHCARDS_COMPLETE_DOCUMENTATION|mazos]] desde audios/fotos/videos). Toda operación de lectura y escritura académica (materias, evaluaciones, horarios, flashcards, repaso [[spaced_repetition_logic|FSRS]]) está diseñada para operar sin conexión y sincronizar automáticamente al recuperar red.

## Estrategia General

**Stale-while-revalidate**: El caché local nunca se elimina por TTL. Los datos expirados se sirven siempre para evitar pantallas en blanco, y el store decide cuándo refrescar según la conectividad.

```
Servidor ──► fetch ──► useDataStore ──► UI
               │
               ▼ (fallback)
           MMKV Cache ◄──── stale-while-revalidate
```

---

## 1. Cache de Lectura (cacheService.ts)

### Ubicación
`mobile/src/services/cacheService.ts`

### Mecanismo
- Usa **MMKV** como almacenamiento síncrono para datos de lectura (materias, evaluaciones, mazos, tarjetas, horarios, perfil).
- Cada entrada tiene un `TTL` (time-to-live), pero `loadFromCacheSync` **no elimina datos expirados**: los retorna con un log de stale.
- `loadAllData` verifica `connectivityStore.isOnline` antes de llamar al servidor; si está offline, retorna temprano preservando el estado actual del store.
- `preloadOfflineCache` no sobrescribe arrays vacíos en el caché (solo guarda si `length > 0`).

### Claves de caché
- `subjects`, `assessments:{subjectId}`, `schedule:{subjectId}`,
- `flashcard_decks`, `flashcard_decks_with_metrics`,
- `flashcards_by_deck:{deckId}`, `flashcards_prioritized:{deckId}`,
- `cards_not_snoozed:{deckId}`, `predictions`, `user_data`, `profile`

---

## 2. Escrituras Offline (offlineSyncService.ts)

### Ubicación
`mobile/src/services/offlineSyncService.ts`

### Mecanismo
- Cola FIFO persistente en MMKV bajo la clave `sync:pending_operations`.
- Cada operación contiene: `id`, `type` (POST/PUT/DELETE), `endpoint`, `payload`, `timestamp`, `retries`, `maxRetries` (3), `operationType`.
- Write lock con Promises encadenadas para evitar condiciones de carrera.

### Tipos de operación soportados
| operationType | Descripción |
|---|---|
| `subject` | Crear materia |
| `assessment` | Crear/editar evaluación |
| `schedule` | Crear/editar horario |
| `photo` | Subir foto |
| `flashcard_review` | Registro FSRS de revisión |
| `flashcard_status` | Actualizar estado (new/learning/review) |
| `flashcard_snooze` | Aplazar tarjeta |
| `flashcard_delete` | Eliminar tarjeta |

### Sincronización automática
Se dispara desde `useAutoSync.ts` cuando:
1. `connectivityStore.isOnline` cambia de `false` a `true`
2. Se llama `syncPendingOperations()` manualmente
3. Al recuperar conexión, después de sincronizar operaciones pendientes se llama `loadAllData(true)` para refrescar el estado completo

### Límites
- 3 reintentos por operación antes de descartarla como fallida
- Las operaciones exitosas se eliminan de la cola inmediatamente

---

## 3. Card Logs (offlineQueue.ts)

### Ubicación
`mobile/src/services/offlineQueue.ts`

### Mecanismo
- Cola independiente para `card_logs` (respuestas de estudio: correcta/incorrecta, tiempo de respuesta, word count).
- Usa **AsyncStorage** (no MMKV) para persistencia.
- `createCardLogWithFallback` intenta enviar al servidor; si falla, encola.
- `flushOfflineQueue` se llama periódicamente desde `_layout.tsx` para drenar la cola.

### Diferencia con offlineSyncService
`card_logs` son operaciones de alta frecuencia (una por cada respuesta de estudio) y tienen su propia cola para no bloquear la cola general de escrituras.

---

## 4. Operaciones de Flashcards con Fallback Offline

### recordCardReview (analytics.ts)
Registra la revisión FSRS de una tarjeta:
```
Servidor ──► POST /flashcards/{cardId}/review
  │ éxito ──► retorna CardReviewResponse con métricas FSRS
  ▼ fallo
offlineSyncService.addPendingOperation('flashcard_review')
  └── retorna objeto optimista: { quality:3, retention:0.9, nextReviewDate:+24h, _isPending:true }
```

### updateFlashcardStatus (flashcards.ts)
Actualiza estado de repaso (new → learning → review):
```
Servidor ──► PUT /flashcards/{cardId}
  ▼ fallo
offlineSyncService.addPendingOperation('flashcard_status')
  └── retorna { success:true, _isPending:true }
```

### snoozeCard (flashcards.ts)
Aplaza una tarjeta por N minutos:
```
Servidor ──► POST /flashcards/{cardId}/snooze
  ▼ fallo
offlineSyncService.addPendingOperation('flashcard_snooze')
  └── retorna { success:true, snoozedUntil: (now + duration), _isPending:true }
```

### deleteFlashcard (flashcards.ts)
Elimina una tarjeta:
```
Servidor ──► DELETE /flashcards/{cardId}
  ▼ fallo
offlineSyncService.addPendingOperation('flashcard_delete')
  └── retorna { success:true, _isPending:true }
```

---

## 5. Proyección Académica Offline (projectionEngine.ts)

### Ubicación
`mobile/src/utils/projectionEngine.ts`

### Cálculos
| Variable | Fórmula |
|---|---|
| `evaluatedWeight` | Suma de pesos de evaluaciones con nota |
| `remainingWeight` | `100 - evaluatedWeight` |
| `currentAverage` | `accumulatedPoints / (evaluatedWeight / 100)` |
| `currentEMA` | EMA con α=0.5 sobre la serie cronológica de notas |
| `projectedGrade` | `currentAverage + (currentEMA - currentAverage) * (remainingWeight / 100)` |
| `targetGrade` | `subject.target_grade` → `profile.approval_threshold` → `3.0` |
| `delta` | `projectedGrade - targetGrade` |

### Integración con useSubjectGrades
- Si `connectivityStore.isOnline === false` → calcula localmente
- Si `getProjectionAnalytics()` falla o retorna null → fallback a cálculo local
- Incluye `maxScale` para normalizar delta entre diferentes escalas

---

## 6. Indicador Visual de Cola Pendiente

### FlashcardHeader.tsx
- Muestra un badge naranja con el conteo de operaciones de flashcards pendientes (`getPendingFlashcardCount()`)
- Se actualiza al renderizar el componente
- Usa `theme.colors.warning` como color de fondo

---

## 7. Stores y Hooks

### useDataStore.ts
- `loadAllData(forceRefresh?)`: Verifica conectividad, decide si fetch o cache
- `preloadOfflineCache()`: Precarga datos al caché (solo si non-empty)
- `syncPendingOperations()`: Dispara sincronización de cola
- `setSyncing(bool)`, `setSuccess()`, `syncStatusMessage`: Feedback visual

### useConnectivityStore.ts
- `isOnline`: Estado booleano de conectividad
- `setOnline(bool)`, `setSyncing(msg?)`, `setSuccess()`: Métodos de control
- `setSyncing` usa `i18n.t('common.syncing')` en vez de texto hardcodeado

### useAutoSync.ts
- Escucha cambios en `isOnline`
- Al recuperar conexión: llama `syncPendingOperations()`, luego `loadAllData(true)`
- Expone `manualSync()` para sincronización manual

### usePredictionPolling.ts
- `loadPredictionsFromCache()` retorna datos expirados en vez de `null` (stale-while-revalidate)
- No interrumpe flujo offline

---

## 8. Carga de Pantalla de Materia Offline (useSubjectDetail.ts)

### Problema original
`useSubjectDetail` disparaba 8 llamadas [[API_DOCUMENTATION|API]] directas sin ningún fallback a caché. Al estar offline, todas fallaban y la pantalla se renderizaba vacía (`selectedSubject: null`, `photos: []`, `isLoading: false`).

### Solución implementada
Cada llamada ahora tiene un fallback al caché cuando `isOnline === false`:

| Dato | Fuente principal | Fallback offline |
|---|---|---|
| `selectedSubject` | `getSubjectById(id)` → `Promise.allSettled` | `storeSubjects.find(s => s.id === subjectId)` (ya hidratado desde MMKV sync) |
| `profile` | `getCurrentUserProfile()` | `cacheService.loadProfile()` |
| `photos` | `getPhotosBySubject(id)` | `cacheService.loadPhotosBySubject(id)` |
| `scannedDocuments` | `getScannedDocumentsBySubject(id)` | `cacheService.loadScannedDocumentsBySubject(id)` |
| `schedules` | `getSchedulesBySubject(id)` | `storeSchedules.filter(s => s.subject_id === subjectId)` (ya hidratado desde MMKV sync) |
| `audioRecordings` | `getAudioRecordings()` | Manejado por `useAudioRecorder` internamente |
| `youtubeVideos` | `getYouTubeVideos()` | `cacheService.loadYouTubeVideos()` + filtrar por subject_id |
| `assessments` | `getAssessments(id)` (ignorado) | `storeAssessments.filter(a => a.subject_id === subjectId)` (ya hidratado desde MMKV sync) |

### Flujo de carga offline

```
useSubjectDetail mount
       │
       ├── selectedSubject ← storeSubjects.find(id)  (síncrono del store MMKV)
       ├── schedules ← storeSchedules.filter(id)      (síncrono del store MMKV)
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

### Diagrama de Flujo de Datos

```
Usuario interactúa
       │
       ▼
┌──────────────────┐
│  Componente UI   │
│  (ej: estudio)   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  API Function    │  try { fetch() }
│  (flashcards.ts) │  catch { queue + optimist response }
└──────┬───────────┘
       │
       ├── éxito ──────────► Servidor ──► actualiza cache
       │
       └── fallo ──────────► offlineSyncService.addPendingOperation()
                                  │
                                  ▼
                            MMKV queue (sync:pending_operations)
                                  │
                            (cuando recupera red)
                                  │
                                  ▼
                            useAutoSync.ts ──► syncPendingOperations()
                                                    │
                                                    ▼
                                              fetchWithFallback()
                                              replay POST/PUT/DELETE
                                                    │
                                                    ▼
                                              success → remove from queue
                                              fail → retry (max 3)
```

---

## 9. Edge Cases

| Caso | Comportamiento |
|---|---|
| Offline al iniciar app | `loadAllData` retorna temprano, preserve estado actual del store |
| Cache vacío + offline | Pantallas muestran `isInitialLoading: true` o empty states |
| Operación falla 3 veces | Se descarta de la cola con log de error |
| Usuario elimina tarjeta offline | Se elimina localmente + se encola DELETE; al sincronizar, si ya fue eliminada en servidor, el 404 se maneja como éxito |
| Snooze offline | El cálculo de `snoozedUntil` es local (`now + durationMinutes`); al sincronizar, el servidor recalcula con su propia hora |
| [[PREDICTIONS_ANALYSIS|Predicciones]] offline | `loadPredictionsFromCache` retorna datos aunque estén expirados |

---
**Tags:** #architecture
