# IDs Negativos para Contenido Local

## Problema

Todos los decks y cartas creadas offline (`_local: true`) usan **IDs negativos** generados con `-Date.now()` decrementado, resultando en números como `-1719561600000`, `-1719561600001`, etc.

Estos IDs aparecen en:

- Logs de consola y errores
- Payloads de sync hacia el backend
- Caché de MMKV
- Interfaz de usuario (tooltips, depuración)

Además, hay **14 puntos de validación** esparcidos por la app que chequean `id < 0` como mecanismo para detectar contenido local:

| Archivo | Línea |
|---|---|
| `hooks/useFlashcardsManager.ts` | 98 |
| `services/api/flashcards.ts` | 149, 414 |
| `services/localFlashcardService.ts` | 294 |
| `components/flashcards/FlashcardStudyScreen.tsx` | 231 |
| `components/flashcards/FlashcardStudyScreenStandalone.tsx` | 216 |
| `components/flashcards/FlashcardsModal.tsx` | 196 |
| `services/hybridAIService.ts` | 730, 974 |

## Diagnóstico

### Origen

El mecanismo está en `services/localFlashcardService.ts:4-9`:

```typescript
let _localIdCounter = -Date.now();
function nextLocalId(): number {
  _localIdCounter -= 1;
  return _localIdCounter;
}
```

#### Commit original (`9f2864f`)
Se creó con `_localIdCounter = -1` y se usaba `_localIdCounter--`. IDs: `-1, -2, -3...`

**Problema:** al reiniciar la app, el contador se reiniciaba a -1, colisionando con IDs de sesiones anteriores.

#### Fix posterior (`b6219bc`)
Se cambió a `_localIdCounter = -Date.now()`. IDs: `-1719561600000, -1719561600001...`

**Problema:** soluciona la colisión entre sesiones pero introduce IDs enormes, inconsistencia (cada sesión arranca en un valor distinto), y depende del casteo `Number(id) < 0` en lugar de usar el flag semántico `_local`.

### Por qué es frágil

1. **El signo negativo no es semántico** — depende de una convención oculta que cualquier nuevo desarrollador (o IA) puede ignorar.
2. **El backend recibe estos IDs** en los payloads de sync (`syncService.enqueueCreate`), propagando números negativos al servidor.
3. **Mezcla de tipos** — algunos IDs son `number` negativos, otros son `string` UUID (los del servidor), forzando `Number(id)` en las comparaciones.
4. **El flag `_local` ya existe** — es redundante tener dos mecanismos (flag + signo) para detectar el mismo estado.

## Solución Propuesta

### Estrategia

Reemplazar IDs numéricos negativos por **UUIDs string** usando `Crypto.randomUUID()`, que ya está disponible y se usa en otras partes del código (`biometricService.ts`, `device.ts`).

### Pasos

1. **Modificar `nextLocalId()` en `localFlashcardService.ts`** para que retorne un UUID en lugar de un número negativo:

   ```typescript
   import * as Crypto from 'expo-crypto';

   function nextLocalId(): string {
     return Crypto.randomUUID();
   }
   ```

2. **Actualizar tipos** — `LocalDeck.id` y `LocalCard.id` pasan de `number` a `string`.

3. **Eliminar todas las validaciones `id < 0`** y reemplazarlas por el flag `_local`:

   - `id < 0` → `item._local === true` en componentes
   - `isLocalId = Number(deckId) < 0` → `isLocalId = localDecks.some(d => d.id === deckId)` o mantener el flag existente

4. **Actualizar almacenamiento en MMKV** — las claves `cache:flashcards_by_deck:${deckId}` ahora usan UUID string, lo cual es compatible con MMKV.

5. **Sync** — el backend ya acepta `id` como string (UUID), no hay cambio de contrato.

### Impacto

- **Elimina ~14 puntos de validación frágil**
- **IDs legibles y consistentes entre sesiones**
- **Sin cambios en el backend** (ya usa strings)
- **Sin cambios en MMKV** (soporta claves string)
- **Riesgo bajo** — el flag `_local` ya está presente en todos los objetos

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `services/localFlashcardService.ts` | `nextLocalId()` → UUID; tipos `LocalDeck.id`/`LocalCard.id` a `string` |
| `hooks/useFlashcardsManager.ts:98` | `id < 0` → `d._local` |
| `services/api/flashcards.ts:149,414` | `Number(deckId) < 0` → flag local |
| `components/flashcards/FlashcardStudyScreen.tsx:231` | `id < 0` → `_local` |
| `components/flashcards/FlashcardStudyScreenStandalone.tsx:216` | `id < 0` → `_local` |
| `components/flashcards/FlashcardsModal.tsx:196` | `id < 0` → `d._local` |
| `services/hybridAIService.ts:730,974` | `deckId < 0` → deck local lookup |


---
**Tags:** #audits
