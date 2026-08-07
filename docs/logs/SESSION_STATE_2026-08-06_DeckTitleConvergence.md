# Estado de Sesión — Generación de Mazos: `topic` del motor, `title` del móvil

**Fecha:** 2026-08-06
**Commit:** `28ff419` (`feat(flashcards): motores generan topic y el movil decide el titulo final`)
**Status:** ⏳ **PENDIENTE DE APROBACIÓN FUNCIONAL** — lógica implementada y verificada por automatización; falta validación en dispositivo real.

---

## 1. Objetivo del paso

Implementar el **Paso 2** del contrato de generación de mazos: los motores backend generan el `topic` (tema semántico) desde el contenido comprendido, y el móvil arma el `title` final vía `DeckTitleGenerator`. Ambos motores cumplen el contrato interno `{ topic, cards }`; cada endpoint adapta a su API pública y el título final lo decide el móvil.

### Contrato de dominio

| Campo | Productor | Naturaleza |
|-------|-----------|------------|
| `topic` | El motor que comprende (backend) | Dato de dominio (agrupar, buscar, estadísticas, sync) |
| `title` | `DeckTitleGenerator` (móvil) | Representación UI (`[Tema — ]Fuente`) |
| Persistencia | Almacena ambos | No decide ninguno |

**El backend jamás decide el título final.**

---

## 2. Decisiones tomadas

- **Opción 1 (elegida por el usuario)**: generar `topic` en `FlashcardEngine` + flujo legacy Groq de `flashcardsController`. El flujo legacy **no** se migra al FlashcardEngine (cambio de superficie muy grande, merece iteración propia).
- **Pieza común** `FlashcardResponseParser` define el prompt y parseo de `topic` para no duplicar criterios; cada endpoint adapta el resultado a su API pública.
- **Precedencia de topic**: pista del usuario (request) gana; si no, el generado por el motor.
- `/ai/generate-flashcards` está **deprecated (410)** — `geminiService` no es ruta móvil viva.
- Motores generadores reales: FlashcardEngine (chat), `flashcardsController` Groq (grabación/video/doc), `/ai/class-flashcards` (Zyren, **ya** devuelve `{ topic, cards }`).
- Chat envía `topic` hint (`SubjectAIChatModal`); grabación/video/documentos no mandan topic → usan el generado.

---

## 3. Arquitectura implementada

```
Backend (motor que comprende)               Móvil (decide el título)
─────────────────────────────               ─────────────────────────
FlashcardResponseParser (pieza común)       DeckTitleGenerator
  ├─ TOPIC_PROMPT_INSTRUCTION                    buildTitle({ topic, source })
  ├─ TOPIC_FORMAT_INSTRUCTION                    └─ formato [Tema — ]Fuente
  ├─ normalizeTopic() ────────────┐
  └─ parseTopicAndCards()         │
                                  ▼
Generator (FlashcardEngine)  →  { topic, cards }
FlashcardEngine  → DeckBuilder  → request.topic ?? generated
flashcardsController (Groq legacy)
  └─ generateDeckFromText / generateDeckFromImage
       → parseTopicAndCards → topic → persistir → devolver en 201
                                  │
                                  ▼ (HTTP, convergencia local-first)
                    useFlashcardGenerator / SubjectAIChatModal
                      └─ title = DeckTitleGenerator.buildTitle(...)
                      └─ if (title !== deck.title) updateFlashcardDeck(...)
```

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `backend/services/ai/pipelines/flashcard/FlashcardResponseParser.js` | **NUEVO** — pieza común: prompt de topic + parse `{ topic, cards }` |
| `backend/services/ai/pipelines/flashcard/Generator.js` | Única llamada LLM; devuelve `{ topic, cards }` |
| `backend/services/ai/engines/FlashcardEngine.js` | Desestructura `{ topic, cards }`; pasa topic a DeckBuilder |
| `backend/services/ai/pipelines/flashcard/DeckBuilder.js` | `normalizeTopic(request.topic) ?? generatedTopic ?? null` |
| `backend/controllers/flashcardsController.js` | Flujo Groq legacy: pide topic, parsea, persiste, devuelve en 201 |
| `mobile/src/hooks/useFlashcardGenerator.ts` | Reproduce título con `result.topic` + converge vía `updateFlashcardDeck` |
| `mobile/src/components/subjects/SubjectAIChatModal.tsx` | `finalTitle`/`finalTopic` desde `deck.topic` + convergencia |
| `backend/tests/parser/index.js` | **NUEVO** — test node del parser (10/10 PASS) |
| `docs/domains/flashcards/FLASHCARDS_COMPLETE_DOCUMENTATION.md` | Sección 12 v1.2 — contrato de generación |

---

## 4. Verificación automática realizada

- **Parser backend**: `node backend/tests/parser/index.js` → **10/10 PASS** (canónico, `{items,topic}`, array pelado, array de 1 elemento, objeto pre-parseado, `{flashcards}`, Markdown, throws, normalizeTopic, instrucciones).
- **`node --check`** OK en parser/Generator/Engine/DeckBuilder/flashcardsController.
- **Suite móvil**: 53 suites / **528 tests PASS**.
- **TypeScript**: `npx tsc --noEmit` → **0 errores**.
- **Lint**: 0 errores en archivos tocados; los 10 errores restantes son pre-existentes en archivos ajenos.
- **Convergence Suite backend**: falla por harness incompleto (SQLite schema, `scenarios/backup.js:263`) — **pre-existente**, confirmado con `git stash` en línea base sin estos cambios.

---

## 5. Validación funcional pendiente (criterio de cierre)

Lo único que falta para dar el paso por **completamente validado**. No busca bugs de lógica sino experiencia de usuario:

1. Generar un mazo desde **grabación** de audio.
2. Generar un mazo desde **video**.
3. Generar un mazo desde **documento**.
4. Confirmar que inicialmente aparece el mazo esperado (usable de inmediato).
5. Confirmar que, tras la respuesta del backend, el título converge a `[Tema — ]Fuente`:
   - sin crear un mazo duplicado,
   - sin perder estadísticas,
   - sin alterar el orden en la interfaz.

Si esta validación pasa, el Paso 2 se considera terminado y listo para cerrar.

---

## 6. Evolución natural identificada (no urgente)

El patrón *reconstruir título → comparar → `updateFlashcardDeck` si difiere* probablemente reaparecerá cuando existan varias fuentes que enriquecen un mazo (IA local, backend, OCR, clasificación). Evolución natural propuesta:

```
DeckMetadataConvergenceService  (o FlashcardDeckMetadataUpdater)
    convergeMetadata(deck, { topic, sourceType })
```

Así `useFlashcardGenerator`, el chat y cualquier flujo futuro no repiten la lógica de generar título, comparar y actualizar si cambió. **No es una necesidad ahora** — solo una evolución si aparecen más puntos de entrada.

---

## 7. Próximos pasos

1. Ejecutar la validación funcional de la sección 5 en dispositivo.
2. Si pasa → marcar este paso como cerrado y actualizar este documento a `✅ APROBADO FUNCIONAL`.
3. (Opcional) Evaluar `DeckMetadataConvergenceService` cuando aparezca una segunda fuente de enriquecimiento.

---

**Tags:** #logs #flashcards #topic #title #convergence
