# Zyren Architecture (August 2026)

Este documento define la arquitectura conceptual, responsabilidades y contratos del subsistema de Inteligencia Artificial de Threshold, conocido como **Zyren**. 
Esta arquitectura rige cualquier evolución futura relacionada con IA en el proyecto y funciona como un estándar congelado.

---

## 1. Filosofía Arquitectónica de Zyren

Zyren ya no es una simple "función de chat". Es el **Subsistema de Conocimiento y Razonamiento** de Threshold. 
Sigue estrictamente los principios arquitectónicos generales del sistema:

- **Responsabilidad Única (Threshold)**: Cada componente de IA tiene una sola razón para cambiar. Los planificadores planifican, los generadores escriben y los validadores validan.
- **Colaboración vs Expansión**: Si Zyren necesita hacer algo nuevo (ej. evaluar un resumen), no se añade un `if` al controlador existente. Se crea una nueva *Capability* y un nuevo *Engine* que colabore con los existentes.
- **Abstracción del Modelo**: Ningún componente de negocio o lógica pedagógica (como un planificador) conoce qué modelo de IA (Gemini, Llama, etc.) está ejecutando. 

---

## 2. Definición de Componentes

### 2.1. Intent Resolver (Capa de Cliente/Interacción)
- **Responsabilidad**: Escucha al usuario, analiza su lenguaje natural y clasifica su intención en un contrato estructurado (ej. `{ intent: "generate_flashcards", mode: "mixed" }`).
- **Restricciones**: No toma decisiones pedagógicas ni invoca modelos para generar contenido. Solo *entiende* qué quiere hacer el usuario.

### 2.2. Capability (Capa de Aplicación)
- **Responsabilidad**: Representa la "capacidad" de negocio que el sistema ofrece al usuario. Es el punto de entrada a un caso de uso (ej. `FlashcardCapability`, `QuizCapability`).
- **Restricciones**: No ejecuta el trabajo pesado. Recibe la petición, verifica permisos, prepara contratos de entrada (ej. `GenerateFlashcardsRequest`) y delega a los Engines correspondientes de dominio. Se registran en un `CapabilityRegistry`.

### 2.3. Knowledge Engine (Motor de Adquisición)
- **Responsabilidad**: Consolida las distintas fuentes de información (notas, PDFs, transcripciones, OCR) solicitadas por la Capability en un único `KnowledgeModel` unificado.
- **Restricciones**: No sabe *para qué* se usará la información. No conoce al "usuario" per se, solo procesa las "fuentes de conocimiento" que recibe.

### 2.4. Engine (Capa de Dominio)
- **Responsabilidad**: Orquesta un Pipeline completo para resolver el problema de la Capability (ej. `FlashcardEngine`, `SummaryEngine`). Responde al *¿Cómo se ejecuta?*.
- **Restricciones**: No interactúa con HTTP, ni con UI, ni con persistencia directa. Solo orquesta los pasos del Pipeline pasando contratos claros.

### 2.5. Pipeline (Capa de Procesamiento)
Es el conjunto inmutable de pasos secuenciales que ejecuta el Engine. En Zyren, un Pipeline típico de generación involucra:
1. **Planner**: Toma el `KnowledgeModel` y decide la estrategia (conceptos, dificultad, cobertura). Produce un `DeckPlan`.
2. **Plan Evaluator**: Evalúa el plan contra el conocimiento original (cobertura, redundancia, balance). Produce un `CoverageReport`.
3. **Generator**: Toma el plan validado y escribe el contenido final. Produce `GeneratedCards`.
4. **Validator (Structural & Pedagogical)**: Verifica que la respuesta cumple los esquemas de datos y principios de calidad de Threshold. Produce un `ValidatedDeck`.
5. **Deck Builder**: Toma la información validada y la ensambla en el agregado del dominio (`FlashcardDeckAggregate`).
- **Restricciones**: Los objetos no arbitrarios viajan entre los pasos; siempre usan contratos formales (Input/Output).

### 2.6. Repository (Capa de Persistencia)
- **Responsabilidad**: Recibe los aggregates finales del Pipeline (desde el `DeckBuilder`) y los persiste atómicamente en la base de datos local y/o cola de sincronización.

### 2.7. Inference Router (AI Model Registry)
- **Responsabilidad**: Enruta peticiones de inferencia hacia el modelo adecuado según su rol (Razonamiento, Visión, Transcripción, Chat). 
- **Restricciones**: Es la única capa que sabe que existen Gemini, Llama o Groq.

---

## 3. Contratos Obligatorios

Ningún flujo en Zyren debe funcionar mediante strings o JSON no validados que cruzan capas.

```typescript
// Ejemplo de Flujo de Contratos:
Request (GenerateFlashcardsRequest) 
  -> KnowledgeEngine 
  -> [KnowledgeModel] 
  -> Planner 
  -> [DeckPlan] 
  -> PlanEvaluator 
  -> [EvaluationReport] 
  -> Generator 
  -> [GeneratedCards] 
  -> StructuralValidator 
  -> PedagogicalValidator 
  -> [ValidatedDeck]
  -> DeckBuilder
  -> [FlashcardDeckAggregate]
```

## 4. Reglas Estrictas

1. **La UI nunca planifica ni genera**: El cliente solo declara su intención a través de la Capability correspondiente. El backend orquesta y ejecuta el Pipeline.
2. **El Pipeline nunca persiste**: El `DeckBuilder` ensambla; el `Repository` guarda. Nunca mezclarlos.
3. **El Planner nunca elige al modelo**: El Planner pide un modelo al `InferenceRouter` (ej. "Necesito un modelo de razonamiento"). 

Estas reglas aseguran que Zyren pueda escalar hacia decenas de Engines sin comprometer la estabilidad del sistema general.
