# Capability Pattern — Zyren AI Subsystem

**Versión:** 1.1  
**Fecha:** Agosto 2026  
**Alcance:** Toda nueva capacidad de IA dentro de Threshold debe seguir este patrón.

---

## Problema que resuelve

Sin un patrón, cada nueva capacidad de IA tiende a:
- Crecer dentro de un controlador existente
- Mezclar adquisición de conocimiento, lógica de negocio y persistencia
- Acoplarse a un proveedor de LLM específico
- Ser imposible de probar de forma aislada

El Capability Pattern es la solución estructural a ese problema.

---

## La Regla Fundamental

> **Una Capability es una unidad de trabajo, no una colección de funciones.**

Cada Capability encapsula exactamente una intención de usuario (`GenerateFlashcards`, `SummarizeDocument`, `CreateStudyPlan`, etc.) y la convierte en un resultado persistible.

---

## Taxonomía de Componentes del AI Domain

Cada pieza del subdominio de IA pertenece exactamente a uno de estos tipos. Si una pieza nueva no encaja en ninguna categoría, es una señal de diseño incompleto.

| Tipo | Responsabilidad única | Puede llamar al LLM |
|---|---|---|
| **Capability** | Punto de entrada de una capacidad de negocio. Orquesta KnowledgeEngine + Engine + Repository. | No |
| **Contract** | Define el contrato de entrada/salida entre módulos. Valida semántica. Sin lógica de negocio. | No |
| **Engine** | Orquesta el pipeline completo de una capacidad. Recibe KnowledgeModel, devuelve Aggregate. | No |
| **Pipeline Stage** | Ejecuta una única transformación atómica dentro del pipeline. | Solo `Generator` |
| **Knowledge Model** | Value Object inmutable. Representa el conocimiento consolidado listo para el pipeline. | No |
| **Plan** | Descriptor de estrategia. Define modo, cantidad, distribución, restricciones. Sin lógica. | No |
| **Aggregate** | Resultado del dominio listo para persistir. UUIDs generados aquí. Sin lógica de negocio. | No |
| **Repository** | Persistencia en SQLite. Solo escribe. No conoce el LLM, el Engine ni la Capability. | No |
| **Provider** | Adaptador hacia un proveedor externo de IA (Groq, Gemini, etc.). Estandariza la interfaz. | Sí |
| **Router** | Selecciona dinámicamente el Provider adecuado según el rol solicitado (reasoning, generation, chat). | No |
| **Knowledge Engine** | Adquisición de conocimiento. Lee fuentes (foto, audio, video, doc) y produce KnowledgeModel. | No |

> **Regla de naming:** El tipo siempre aparece en el nombre del archivo.
> `FlashcardCapability`, `GenerateFlashcardsRequest`, `FlashcardEngine`, `Generator`, `FlashcardDeckAggregate`, `FlashcardDeckRepository`, `GroqProvider`, `InferenceRouter`, `KnowledgeEngine`.

## Estructura Obligatoria

Toda Capability nueva debe crear exactamente esta estructura:

```
backend/services/ai/
├── contracts/
│   └── [Name]Request.js          ← Contrato de entrada validado
├── models/
│   ├── KnowledgeModel.js         ← Compartido (no duplicar)
│   └── [Name]Aggregate.js        ← Resultado del dominio
├── knowledge/
│   └── KnowledgeEngine.js        ← Compartido (no duplicar)
├── pipelines/
│   └── [name]/
│       ├── Planner.js            ← Estrategia (determinístico)
│       ├── PlanEvaluator.js      ← Validación pedagógica
│       ├── Generator.js          ← ÚNICA pieza que llama al LLM
│       ├── Validator.js          ← Validación estructural + calidad
│       └── [Name]Builder.js      ← Construye el Aggregate
├── engines/
│   └── [Name]Engine.js           ← Orquesta el pipeline
└── capabilities/
    └── [Name]Capability.js       ← Punto de entrada
```

```
backend/database/repositories/
└── [Name]Repository.js           ← Persistencia (SQL)

backend/controllers/
└── [name]Controller.js           ← HTTP controller (delgado)
```

---

## El Flujo Canónico

```
HTTP Request
    ↓
[Name]Controller                  ← valida body, extrae userId de JWT
    ↓
[Name]Request (contract)          ← valida semántica del contrato
    ↓
[Name]Capability.handle(request)
    │
    ├── KnowledgeEngine.consolidate(items)  → KnowledgeModel
    │       └── Lee fotos, audios, docs, videos de la BD
    │
    ├── incrementSyncCounterOnly()          → syncVersion
    │
    └── [Name]Engine.execute(knowledge, request, syncVersion)
            │
            ├── Planner.plan()             → [Name]Plan       (sin LLM)
            ├── PlanEvaluator.evaluate()   → EvaluationReport (sin LLM)
            ├── Generator.generate()       → RawResults[]     (CON LLM ← única llamada)
            ├── Validator.validate()       → ValidResults[]   (sin LLM)
            └── [Name]Builder.build()      → [Name]Aggregate  (sin LLM)
                ↓
    [Name]Repository.saveAggregate(aggregate)
                ↓
    return aggregate
```

**Regla de oro:** Solo `Generator` habla con el LLM. Ninguna otra pieza del pipeline hace llamadas de red.

---

## Contratos de Cada Capa

### [Name]Request
- Valida que los campos mínimos estén presentes
- Normaliza valores (e.g., `mode = 'flashcards'` → `mode = 'flashcard'`)
- Expone `isValid()` → boolean

### KnowledgeModel *(compartido)*
- `model.Text` → string consolidado
- `model.Sources` → array con trazabilidad por fuente
- `model.Metadata` → estadísticas del proceso
- `model.IsEmpty` → boolean
- `model.truncate(maxChars)` → string truncado para el LLM
- **Inmutable**: `Object.freeze` en construcción

### [Name]Plan
- Configuración de la generación (estrategia, cantidad, distribución)
- **No contiene lógica**. Es un descriptor.
- Puede evolucionar con: `difficulty`, `coverage`, `cardDistribution`, `constraints`

### EvaluationReport
- `isApproved: boolean`
- `plan: [Name]Plan`
- Puede evolucionar con: `gaps[]`, `redundancies[]`, `balanceScore`

### [Name]Aggregate
- Contiene todo lo necesario para persistir el resultado
- UUIDs generados aquí (no en el Repository)
- **No contiene lógica de negocio**

---

## Invariantes del Pipeline

| Invariante | Descripción |
|---|---|
| **Single LLM Call** | Solo `Generator` llama al LLM. Nunca el Planner, Evaluator, Validator ni Builder. |
| **Planner es determinístico** | No hace llamadas de red. Devuelve un plan a partir de los parámetros del request. |
| **Separation of concerns** | Adquisición (KnowledgeEngine) ≠ Generación (Engine) ≠ Persistencia (Repository) |
| **Aggregate inmutable post-build** | Una vez construido el Aggregate, nadie lo muta. |
| **Repository no conoce el LLM** | El Repository solo persiste. Nunca llama a la IA. |
| **Capability no conoce SQL** | La Capability orquesta pero nunca escribe SQL directamente. |
| **Regla 9 — Pipelines producen modelos del dominio** | Ningún Stage devuelve objetos HTTP ni estructuras de persistencia. El Aggregate es el límite del dominio. La traducción a respuesta HTTP es responsabilidad del Controller + Mapper. |
| **Regla 10 — Ningún Stage invoca otro Stage** | Toda la orquestación pertenece exclusivamente al Engine. Un Stage recibe sus inputs por parámetro y devuelve su output. Nunca importa ni invoca a otro Stage del mismo pipeline. |

---

## Cómo Agregar una Nueva Capability

Ejemplo: `QuizCapability`

### Paso 1 — Definir el contrato de entrada
```
backend/services/ai/contracts/GenerateQuizRequest.js
```
```js
class GenerateQuizRequest {
  constructor({ subjectId, userId, difficulty, questionCount, items }) { ... }
  isValid() { return !!this.subjectId && !!this.userId; }
}
```

### Paso 2 — Definir el Aggregate
```
backend/services/ai/models/QuizAggregate.js
```

### Paso 3 — Crear el Pipeline
```
backend/services/ai/pipelines/quiz/
  ├── QuizPlanner.js      ← determina dificultad y distribución por tema
  ├── PlanEvaluator.js    ← misma firma que el de Flashcards
  ├── QuizGenerator.js    ← system prompt específico para quizzes
  ├── QuizValidator.js    ← valida que las opciones no sean ambiguas
  └── QuizBuilder.js      ← construye QuizAggregate
```

### Paso 4 — Crear el Engine
```
backend/services/ai/engines/QuizEngine.js
```
```js
class QuizEngine {
  static async execute(knowledgeModel, request, syncVersion) {
    const plan = await QuizPlanner.plan(knowledgeModel, request);
    const report = PlanEvaluator.evaluate(plan, knowledgeModel);
    const questions = await QuizGenerator.generate(report, knowledgeModel, request);
    const validated = QuizValidator.validate(questions);
    return QuizBuilder.build(request, validated, syncVersion);
  }
}
```

### Paso 5 — Crear la Capability
```
backend/services/ai/capabilities/QuizCapability.js
```
La firma es siempre la misma: `static async handle(request)`.

### Paso 6 — Repository + Controller + Route
```
backend/database/repositories/QuizRepository.js
backend/controllers/quizController.js
backend/routes/ai.js → router.post('/ai/capabilities/quiz', quizController.generateQuiz)
```

**KnowledgeEngine no se duplica.** Todas las Capabilities comparten el mismo `KnowledgeEngine`.

---

## Sobre el ConversationIntentResolver

**Nota de diseño (v1.0):**

El `ConversationIntentResolver` actual es en realidad un **Command Resolver** — detecta comandos explícitos con patrones de regex.

Un `IntentResolver` real debería manejar:
```
"Tengo examen mañana."  →  { type: 'generate_deck' }
"No entiendo este tema." →  { type: 'generate_quiz' }
"Ayúdame a estudiar."   →  { type: 'suggest_capability' }
```

La evolución natural es:

```
Fase 1 (hoy):     Regex Patterns → command detection
Fase 2 (futuro):  Lightweight LLM call → intent classification
Fase 3 (visión):  Context-aware routing → multi-turn intent tracking
```

La implementación actual es correcta para Fase 1. El nombre se irá justificando a medida que crezca.

---

## Sobre PlanEvaluator

Hoy aprueba el plan sin análisis. Su potencial real:

```
PlanEvaluator.evaluate(plan, knowledgeModel) → EvaluationReport {
  isApproved: boolean,
  gaps: string[],          // conceptos en el texto no cubiertos por el plan
  redundancies: string[],  // conceptos duplicados
  balanceScore: number,    // 0-1: qué tan bien distribuidos están los tipos de tarjeta
  suggestedAdjustments: {} // cambios recomendados al plan
}
```

Eventualmente puede convertirse en el "profesor" que revisa el trabajo del Generator antes de persistirlo.

---

## Sobre Validator

La evolución sugerida:

```
Validator (actual) → SchemaValidator (estructura mínima)
                   → PedagogicalValidator (calidad didáctica)
                   → SafetyValidator (sin contenido inapropiado)
```

Cada validador recibe el array de items y devuelve `validatedItems[]`. Son stages acumulativos, no mutuamente excluyentes.

---

## Capabilities Futuras Previstas

| Capability | Engine | Descripción |
|---|---|---|
| `FlashcardCapability` | `FlashcardEngine` | ✅ Implementado |
| `QuizCapability` | `QuizEngine` | Quiz de preguntas abiertas con rúbrica |
| `SummaryCapability` | `SummaryEngine` | Resumen estructurado (keyPoints, conclusion) |
| `StudyPlanCapability` | `StudyPlanEngine` | Plan de estudio personalizado por fecha de examen |
| `MindMapCapability` | `MindMapEngine` | Grafo de conceptos jerárquico |

Todas comparten: `KnowledgeEngine`, `InferenceRouter`, el patrón de `Repository` y el endpoint base `/api/ai/capabilities/[name]`.

---

## Dirección Futura: ExecutionContext

> **Estado:** No implementado. Documentado como evolución natural prevista.

A medida que el número de Capabilities crezca, surgirá la necesidad de un objeto de contexto transversal que consolide los parámetros de ejecución comunes:

```js
ExecutionContext {
  userId,          // Identidad del ejecutor
  provider,        // Proveedor de IA preferido
  capability,      // Nombre de la capability activa
  correlationId,   // Trazabilidad end-to-end (request → LLM → DB)
  startedAt,       // Timestamp de inicio
  syncVersion,     // Versión de sincronización
  cancellationToken, // Para operaciones largas
  telemetry,       // Métricas de ejecución (latencia, tokens usados, etc.)
}
```

**Motivación:** Hoy cada Engine recibe `(knowledgeModel, request, syncVersion)`. Cuando existan 5+ Capabilities, ese conjunto de parámetros crecerá y cada Engine tendrá una firma diferente.

**Señal de cuándo introducirlo:** Cuando dos Engines tengan firmas incompatibles, o cuando la telemetría/trazabilidad cross-capability se vuelva necesaria.

**Impacto en el patrón:** El flujo canónico pasaría de:
```
Engine.execute(knowledgeModel, request, syncVersion)
```
a:
```
Engine.execute(knowledgeModel, context: ExecutionContext)
```

El `context` sería construido por la Capability y propagado a través del pipeline sin que cada stage necesite conocer los parámetros individualmente.

