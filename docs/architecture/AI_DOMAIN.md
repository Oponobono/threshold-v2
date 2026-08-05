# AI Domain — Zyren v1.0

**Status:** `FROZEN`
**Versión:** 1.0
**Fecha de congelamiento:** 2026-08-04
**Aprobado por:** Cristian (Product Owner)

---

## Declaración

El AI Domain de Threshold queda oficialmente congelado en esta versión.

Esta decisión no significa que el sistema no crezca. Significa que **la infraestructura compartida es estable** y que el crecimiento futuro ocurre añadiendo nuevas Capabilities, no rediseñando la base.

A partir de este momento, el AI Domain se trata igual que el Sync Protocol: como una base de confianza sobre la que construir, no como algo que deba replantearse cada vez que aparezca una nueva funcionalidad.

---

## Arquitectura Congelada

```
backend/services/ai/
├── providers/
│   ├── InferenceRouter.js      ← FROZEN
│   ├── GroqProvider.js         ← FROZEN
│   └── GeminiProvider.js       ← FROZEN
├── contracts/                  ← patrón FROZEN, instancias pueden crecer
├── models/
│   └── KnowledgeModel.js       ← FROZEN
├── knowledge/
│   └── KnowledgeEngine.js      ← FROZEN (fuentes pueden ampliarse)
├── pipelines/                  ← patrón FROZEN, stages pueden crecer
├── engines/                    ← patrón FROZEN, engines pueden crecer
└── capabilities/               ← patrón FROZEN, capabilities pueden crecer

backend/database/repositories/  ← patrón FROZEN
backend/controllers/            ← patrón FROZEN (flashcardController)
```

**Capability activa:** `FlashcardCapability` (v1.0 — validada en producción)

---

## Constitución del Dominio (Invariantes)

Las siguientes reglas son **invariantes**. Cualquier cambio que las rompa debe justificar explícitamente por qué el invariante ya no aplica.

### Regla 1 — Saturación de componentes
> No añadir responsabilidades nuevas a los componentes existentes si pueden resolverse mediante un nuevo módulo.

Si aparece un nuevo tipo de trabajo de IA → se crea una nueva Capability.
**Nunca** se extiende `aiController.js` con nueva lógica de generación.

### Regla 2 — Contratos públicos estables
> Los contratos públicos de los componentes frozen no cambian sin una versión major.

Cambiar la firma de `KnowledgeEngine.consolidate(items)` es un breaking change.
Cambiar el formato de respuesta de `POST /api/ai/capabilities/[name]` es un breaking change.

### Regla 3 — El patrón es obligatorio
> Toda nueva Capability debe seguir exactamente `CAPABILITY_PATTERN.md`.

No se aceptan Capabilities ad-hoc sin Request Contract, Engine y Repository.

### Regla 4 — Aislamiento de Pipeline Stages
> Ningún Pipeline Stage puede conocer la implementación de otro Stage.

`Generator` no importa `Planner`. `Validator` no importa `Generator`.
Cada Stage recibe sus inputs por parámetro y devuelve su output.

### Regla 5 — Monopolio del InferenceRouter
> Ningún Provider puede ser consumido directamente fuera del InferenceRouter.

Prohibido: `require('../providers/GroqProvider')` en un Engine o Controller.
Permitido: `InferenceRouter.getGenerationModel(provider)`.

### Regla 6 — Generator es la única pieza que habla con el LLM
> Dentro de un pipeline, solo el Generator hace llamadas de red al LLM.

Planner, PlanEvaluator, Validator y Builder son determinísticos.

### Regla 7 — KnowledgeModel es inmutable
> Nadie muta un KnowledgeModel después de construido.

`Object.freeze` se aplica en el constructor.

### Regla 8 — El Repository no conoce el LLM
> Ningún Repository puede importar InferenceRouter, Providers o Engines.

El Repository solo persiste. Recibe un Aggregate y lo escribe en SQLite.

### Regla 9 — Los Pipelines producen modelos del dominio
> Ningún Stage devuelve objetos HTTP ni estructuras de persistencia.

El Aggregate es el límite del dominio. La traducción a respuesta HTTP es
responsabilidad del Controller + Mapper. El Engine y el Repository nunca
conocen los Mappers.

### Regla 10 — Ningún Stage puede invocar otro Stage directamente
> Toda la orquestación pertenece exclusivamente al Engine.

Un Stage recibe sus inputs por parámetro y devuelve su output.
Nunca importa ni invoca a otro Stage del mismo pipeline.

```
❌  Planner → Generator.generate()
❌  Validator → Builder.build()
✅  Engine → Planner → Generator → Validator → Builder
```

---

## Qué Puede Crecer Sin Romper el Congelamiento

| Tipo de cambio | ¿Rompe el freeze? |
|---|---|
| Nueva Capability (Quiz, Summary, StudyPlan, etc.) | No — sigue el patrón |
| Nuevo tipo de fuente en KnowledgeEngine | No — extensión interna |
| Nuevo proveedor de LLM en InferenceRouter | No — el Router es el punto de extensión |
| Nuevo Pipeline Stage dentro de un Engine | No — extensión del pipeline |
| Cambiar la firma de `KnowledgeEngine.consolidate` | Sí — breaking change |
| Mover lógica de generación a un Controller | Sí — viola Regla 1 |
| Consumir un Provider directamente en un Engine | Sí — viola Regla 5 |
| Hacer que el Planner llame al LLM | Sí — viola Regla 6 |

---

## AI Capability Registry

Todas las capacidades activas o planificadas deben seguir exactamente el mismo patrón. Comparten `KnowledgeEngine` e `InferenceRouter`.

| Capability | Estado | Pipeline | Endpoint |
|---|---|---|---|
| `FlashcardCapability` | ✅ v1.0 | Planner → Generator → Validator → Builder | `POST /ai/capabilities/flashcards` |
| `AnchorCapability` | ✅ v1.0 | Planner → Generator → Validator → Builder | `POST /ai/capabilities/anchor/generate` |
| `ConfusionDetectionCapability` | ✅ v1.0 | Loader → Builder → Detector → Builder | `GET /ai/capabilities/anchor/detect/:deckId` |
| `QuizCapability` | Planned | — | — |
| `SummaryCapability` | Planned | — | — |
| `ExplanationCapability` | Planned | — | — |
| `StudyPlanCapability` | Planned | — | — |
| `MindMapCapability` | Planned | — | — |

---

## Contexto de la Refactorización

**Antes (v0):** La generación dependía de que el LLM emitiera `%%DECK_ACTION%%{...}%%END%%`. Toda la lógica vivía en `aiController.js` (1700 líneas). Un fallo del modelo = un mazo vacío.

**Ahora (v1.0):** La intención se detecta en el cliente antes de llamar al LLM. El pipeline tiene contratos explícitos. El único contacto con la IA es `Generator`. El chat y las Capabilities son subsistemas completamente separados.

**El cambio más importante:** La IA dejó de ser una funcionalidad y se convirtió en un dominio con infraestructura compartida. Cada nueva Capability es más barata de construir que la anterior.

---

## Referencias

- [`CAPABILITY_PATTERN.md`](./CAPABILITY_PATTERN.md) — Patrón arquitectónico oficial
- [`backend/services/ai/`](../../backend/services/ai/) — Implementación del dominio
- [`mobile/src/services/ai/ConversationIntentResolver.ts`](../../mobile/src/services/ai/ConversationIntentResolver.ts) — Intent detection en cliente

---

## Roadmap de evolución del dominio

Estos ítems están documentados como evolución natural prevista. No se implementan hasta que un consumidor real los justifique (Invariante 6).

### FlashcardAggregate — Taxonomía unificada

Hoy existen `FlashcardDeckAggregate` (mazos completos) y `AnchorCardAggregate` (tarjetas individuales de diferenciación). La taxonomía futura los unificaría bajo:

```
FlashcardAggregate
├── RecallCard          (front/back clásica — FlashcardDeckAggregate hoy)
├── MultipleChoiceCard
├── BooleanCard
└── AnchorCard
    ├── DifferentiationAnchor  ← AnchorCardAggregate hoy
    ├── AnalogyAnchor
    ├── MnemonicAnchor
    └── TimelineAnchor
```

Cuando esta taxonomía se formalice, `FlashcardDeckRepository.addAnchorCard` y `AnchorCardAggregate` se unificarán bajo `FlashcardAggregate`. El Repository seguirá siendo el mismo punto de persistencia.

### InferenceRouter → ModelProfile

El `InferenceRouter` actual enruta por rol funcional (Reasoning, Generation, Chat). La evolución natural es enrutar por perfil pedagógico:

```
ModelProfile
├── PedagogicalReasoning   (análisis de confusiones, evaluación de planes)
├── FastGeneration         (flashcards, anclas — baja latencia)
├── LongContext            (documentos extensos, resúmenes)
├── Vision                 (OCR, análisis de imágenes)
├── Summarization
├── Classification
├── Embedding
└── Translation
```

Ningún pipeline necesitaría cambiar. El Router decidiría internamente si usar Gemini, Groq, OpenAI o un modelo local según el perfil solicitado.

**Señal de cuándo introducirlo:** cuando dos Capabilities requieran el mismo modelo pero con perfiles distintos, o cuando la selección de modelo se vuelva un parámetro de configuración por usuario.

