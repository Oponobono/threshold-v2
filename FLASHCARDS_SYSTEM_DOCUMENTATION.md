# 📚 Sistema de Flashcards - Documentación Completa

## 📋 Índice

1. [Introducción General](#introducción-general)
2. [Arquitectura General](#arquitectura-general)
3. [Tipos de Ítems de Evaluación](#tipos-de-ítems-de-evaluación)
4. [Creación de Flashcards](#creación-de-flashcards)
5. [Estructura de Base de Datos](#estructura-de-base-de-datos)
6. [Presentación de Preguntas](#presentación-de-preguntas)
7. [Sistema de Evaluación](#sistema-de-evaluación)
8. [Algoritmos de Repetición Espaciada](#algoritmos-de-repetición-espaciada)
9. [Backend - Controladores y Rutas](#backend---controladores-y-rutas)
10. [Frontend - Componentes y Hooks](#frontend---componentes-y-hooks)
11. [Servicios de API](#servicios-de-api)
12. [Librerias Adicionales del Proyecto](#librerías-adicionales-del-proyecto)

---

## Introducción General

El sistema de **Flashcards** de Threshold es un módulo educativo avanzado que permite a los estudiantes crear, gestionar y estudiar ítems de evaluación multiformato con tecnología de Inteligencia Artificial para generación automática. El sistema incluye:

- ✅ **Generación automática de ítems** mediante LLM (Gemini/Groq)
- ✅ **Tres tipos de formato**: Flashcards clásicas (frente/reverso), Opción Múltiple (ECAES), Verdadero/Falso (V/F)
- ✅ **Repetición espaciada inteligente** con algoritmos SM-2 y FSRS
- ✅ **Compartición colaborativa** de mazos entre usuarios
- ✅ **Análisis académico** de dificultad y rendimiento
- ✅ **Sistema de "snoozed"** para posponer tarjetas
- ✅ **Soporte offline** con sincronización automática

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                    APLICACIÓN MOBILE (React Native)             │
├─────────────────────────────────────────────────────────────────┤
│  • FlashcardCreatorModal.tsx     (Modal de generación)          │
│  • FlashcardNewCardScreen.tsx    (Creación manual)              │
│  • FlashcardStudyScreen.tsx      (Pantalla de estudio)          │
│  • useFlashcardGenerator Hook    (Lógica de generación)         │
│  • evaluationStrategies.ts       (Motor de evaluación)          │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP REST + WebSockets
                   │ Offline cache (AsyncStorage)
┌──────────────────▼──────────────────────────────────────────────┐
│                      BACKEND (Express.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─ flashcardsController.js  (Lógica de CRUD)                  │
│  ├─ aiController.js          (Generación LLM - Gemini/Groq)    │
│  ├─ geminiService.js         (Integración Gemini + Vision)     │
│  ├─ sm2Algorithm.js          (Cálculo de repetición espaciada) │
│  ├─ atomicCardGenerator.js   (Fragmentación de tarjetas)       │
│  └─ analyticsController.js   (Métricas de desempeño)           │
└──────────────────┬──────────────────────────────────────────────┘
                   │ SQL
┌──────────────────▼──────────────────────────────────────────────┐
│                    BASE DE DATOS (SQLite/PostgreSQL)            │
├─────────────────────────────────────────────────────────────────┤
│  • flashcard_decks        (Mazos)                              │
│  • flashcards             (Tarjetas con tipos polimórficos)    │
│  • card_logs              (Historial de intentos)              │
│  • card_snoozes           (Tarjetas pospuestas)                │
│  • shared_decks           (Compartición colaborativa)          │
│  • learning_analytics     (Estadísticas por materia)           │
│  • review_predictions     (Predicciones FSRS)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tipos de Ítems de Evaluación

El sistema soporta **tres tipos de ítems polimórficos** almacenados en un único campo JSON flexible:

### 1️⃣ **Flashcard Clásica (frente/reverso)**

**Icono**: 🃏 | **item_type**: `flashcard`

**Estructura en BD**:
```json
{
  "front": "¿Cuál es la velocidad de la luz?",
  "back": "299,792,458 metros por segundo (≈ 3×10⁸ m/s)"
}
```

**Características**:
- Evaluación **subjetiva**: El usuario decide si lo sabía o no
- Requiere **revelar** la tarjeta (flip) antes de calificar
- Ideal para conceptos complejos, escenarios, análisis
- **Sin respuestas correctas automáticas**

**Campo en BD**: `content_json` (JSON) + legado `front`, `back` para compatibilidad

---

### 2️⃣ **Opción Múltiple - ECAES**

**Icono**: 🎯 | **item_type**: `multiple_choice`

**Estructura en BD**:
```json
{
  "question": "¿Cuál es el mecanismo de acción de la penicilina?",
  "options": [
    "Inhibición de proteasa del VIH",
    "Bloqueo de síntesis de pared celular bacteriana",
    "Inhibición de topoisomerasa II",
    "Bloqueo de síntesis de ácidos nucleicos"
  ],
  "correctIndex": 1
}
```

**Características**:
- Evaluación **automática y binaria**: Correcto/Incorrecto
- **No requiere** revelar (feedback inmediato)
- Nivel cognitivo: Análisis/Síntesis/Evaluación (Bloom 4-6)
- Distractores son **errores conceptuales reales** de la disciplina
- Calificación automática por IA

---

### 3️⃣ **Verdadero/Falso (V/F)**

**Icono**: ⚖️ | **item_type**: `boolean`

**Estructura en BD**:
```json
{
  "question": "La radiación ionizante siempre produce daño al ADN",
  "correctAnswer": false
}
```

**Características**:
- Evaluación **automática y binaria**: Verdadero/Falso
- **No requiere** revelar
- Contiene **sutiles falacias lógicas** para detectar comprensión real
- Ideal para validar principios fundamentales

---

## Creación de Flashcards

### A) Creación Manual

**Ubicación**: `mobile/src/components/FlashcardNewCardScreen.tsx`

**Flujo**:
1. Usuario selecciona **tipo de ítem** (Flashcard/ECAES/V/F)
2. Rellena formulario dinámico según tipo:
   - **Flashcard**: Frente + Reverso + Pista + Explicación
   - **Multiple Choice**: Pregunta + 4 Opciones + Índice Correcto + Pista + Explicación
   - **Boolean**: Afirmación + Respuesta Correcta + Pista + Explicación
3. Se envía POST a `/flashcard-decks/{deckId}/items` con:
   ```json
   {
     "item_type": "multiple_choice",
     "content_json": { "question": "...", "options": [...], "correctIndex": 2 },
     "hint": "Considere...",
     "explanation": "La respuesta correcta es B porque..."
   }
   ```

**Campos Opcionales** (aplican a todos los tipos):
- `hint` (50-100 caracteres): Empujón pedagógico sin revelar la respuesta
- `explanation` (80-150 caracteres): Lección magistral que enseña por qué la respuesta es correcta

---

### B) Generación Automática por IA

**Ubicación**: `mobile/src/components/FlashcardCreatorModal.tsx`

#### Paso 1: Seleccionar Fuente de Contenido
```
┌─ Texto (transcripción, resumen) ≥ 50 caracteres
├─ Imagen (base64): OCR + visión por IA
└─ Video (YouTube): Transcripción automática
```

#### Paso 2: Elegir Modo de Generación
```
┌─ Flashcard (40%)
├─ ECAES/Opción Múltiple (40%)
├─ Verdadero/Falso (20%)
└─ Mixto (combinación balanceada)
```

#### Paso 3: Generar con IA

**Flujo Técnico**:
```
1. useFlashcardGenerator Hook
   ↓
2. Valida entrada (texto ≥ 50 chars o imagen válida)
   ↓
3. Envía POST a /flashcard-decks/generate-from-text
   o /flashcard-decks/generate-from-image
   ↓
4. Backend:
   a) Intenta con Gemini (máxima calidad)
   b) Si falla → Fallback a Groq
   ↓
5. LLM genera ítems con Taxonomía de Bloom:
   - Nivel cognitivo 4+ (Análisis/Síntesis/Evaluación)
   - Pistas pedagógicas
   - Explicaciones magistrales
   - Distractores académicos realistas
   ↓
6. Frontend previsualiza ítems para edición
   ↓
7. Usuario confirma → Se guardan en BD
```

**Prompts Especializados**:

El sistema usa prompts adaptativos con:
- **Detección de disciplina**: Matemáticas, Medicina, Ingeniería, etc.
- **Nivel de profundidad**: Pregrado vs Posgrado
- **Distribución de formatos**: 40% múltiple, 40% flashcard, 20% V/F

Ejemplo de prompt adaptativo (ver `academicPromptBuilder.js`):
```
REQUISITOS OBLIGATORIOS:
✅ CADA ítem tiene: "type", "data", "hint", "explanation"
✅ CERO preguntas sobre metadatos del documento
✅ TODA pregunta es de nivel Análisis/Síntesis/Evaluación (Bloom 4-6)
✅ Distractores son errores conceptuales REALES de la disciplina
✅ Pistas son empujones al razonamiento (NO respuestas disfrazadas)
✅ Explicaciones son lecciones magistrales que ENSEÑAN, no solo confirman
```

---

## Estructura de Base de Datos

### 📊 Tabla: `flashcard_decks` (Mazos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Clave primaria auto-incrementada |
| `user_id` | INT | FK → `users.id` |
| `subject_id` | INT | FK → `subjects.id` (opcional, para organización) |
| `title` | TEXT | Nombre del mazo (ej. "Biología Celular") |
| `description` | TEXT | Descripción breve |
| `is_public` | BOOLEAN | ¿Compartible públicamente? |
| `total_reviews` | INT | Contador total de repasos |
| `created_at` | TIMESTAMP | Fecha de creación |

**Índices**: `(user_id, created_at)`, `(subject_id)`

**Cascadas**: Eliminar mazo → Elimina todas sus tarjetas, logs, y compras compartidas

---

### 📝 Tabla: `flashcards` (Tarjetas/Ítems)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Clave primaria |
| `deck_id` | INT | FK → `flashcard_decks.id` ON DELETE CASCADE |
| `item_type` | TEXT | `flashcard` \| `multiple_choice` \| `boolean` |
| `content_json` | TEXT | JSON polimórfico con estructura del ítem |
| `front` | TEXT | Legado: frente de tarjeta |
| `back` | TEXT | Legado: reverso de tarjeta |
| `hint` | TEXT | Pista pedagógica (opcional) |
| `explanation` | TEXT | Explicación magistral (opcional) |
| `status` | TEXT | `new` \| `learning` \| `review` |
| **SM-2 Fields** | | |
| `sm2_ease_factor` | REAL | Factor de facilidad (default 2.5) |
| `sm2_interval` | INT | Intervalo en días |
| `sm2_repetitions` | INT | Número de repeticiones exitosas |
| **FSRS Fields** | | |
| `fsrs_stability` | REAL | Estabilidad de memoria (default 1) |
| `fsrs_difficulty` | REAL | Dificultad deducida (0-10, default 0.5) |
| `fsrs_repetitions` | INT | Contador de repeticiones |
| **Programación Cognitiva** | | |
| `word_count` | INT | Palabras en la pregunta |
| `is_atomic` | BOOLEAN | ¿Es micro-tarjeta? |
| `parent_card_id` | INT | Si es atomic, referencia a tarjeta padre |
| **Métricas** | | |
| `view_count` | INT | Veces visto |
| `success_count` | INT | Veces correcto |
| `failure_count` | INT | Veces incorrecto |
| `next_review_date` | TIMESTAMP | Próxima revisión programada |
| `last_review_timestamp` | TIMESTAMP | Última revisión realizada |
| `created_at` | TIMESTAMP | Fecha de creación |

**Índices**: `(deck_id, status)`, `(next_review_date)`, `(fsrs_difficulty DESC)`

**Triggers Sugeridos**:
```sql
-- Trigger: Actualizar `view_count` automáticamente
CREATE TRIGGER update_view_count 
AFTER INSERT ON card_logs
BEGIN
  UPDATE flashcards SET view_count = view_count + 1
  WHERE id = NEW.card_id;
END;

-- Trigger: Actualizar `success_count` y `failure_count`
CREATE TRIGGER update_card_stats
AFTER INSERT ON card_logs
BEGIN
  UPDATE flashcards
  SET success_count = success_count + CASE WHEN NEW.result = 'correct' THEN 1 ELSE 0 END,
      failure_count = failure_count + CASE WHEN NEW.result = 'incorrect' THEN 1 ELSE 0 END
  WHERE id = NEW.card_id;
END;
```

---

### 📋 Tabla: `card_logs` (Historial de Intentos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | PK |
| `card_id` | INT | FK → `flashcards.id` ON DELETE CASCADE |
| `user_id` | INT | FK → `users.id` |
| `result` | VARCHAR(20) | `correct` \| `incorrect` |
| `response_time_ms` | INT | Tiempo en milisegundos |
| `difficulty_deduced` | VARCHAR(20) | `immediate` \| `easy` \| `moderate` \| `difficult` |
| `normalized_time_ms` | INT | Tiempo normalizado por complejidad |
| `text_length_words` | INT | Palabras en la pregunta |
| `timestamp` | TIMESTAMP | Cuando se hizo el intento |

**Propósito**: Análisis retrospectivo de dificultad, detección de tarjetas problemáticas, estadísticas por usuario.

**Queries Típicas**:
```sql
-- Tarjetas problemáticas (90%+ de fallos)
SELECT card_id, COUNT(*) as total, 
       SUM(CASE WHEN result='incorrect' THEN 1 ELSE 0 END) as failures,
       ROUND(100.0 * SUM(CASE WHEN result='incorrect' THEN 1 ELSE 0 END) / COUNT(*), 1) as failure_rate
FROM card_logs
GROUP BY card_id
HAVING failure_rate >= 90 AND total >= 10;

-- Tiempo promedio por tarjeta
SELECT card_id, AVG(response_time_ms) as avg_time
FROM card_logs
WHERE result = 'correct'
GROUP BY card_id;
```

---

### 🔗 Tabla: `shared_decks` (Compartición Colaborativa)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | PK |
| `deck_id` | INT | FK → `flashcard_decks.id` ON DELETE CASCADE |
| `shared_by_user_id` | INT | FK → `users.id` (propietario original) |
| `shared_to_user_id` | INT | FK → `users.id` (receptor) |
| `shared_at` | TIMESTAMP | Fecha de compartición |

**Constraint Único**: `(deck_id, shared_to_user_id)` - Un mazo solo puede compartirse una vez a cada usuario.

**Lógica**:
- Al compartir, se crea fila en `shared_decks`
- El usuario receptor ve el mazo en su lista
- No crea copia, es referencia (actualiza en tiempo real)
- El usuario receptor puede "dejar de seguir" (DELETE row)

---

### ⏸️ Tabla: `card_snoozes` (Tarjetas Pospuestas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | PK |
| `card_id` | INT | FK → `flashcards.id` ON DELETE CASCADE (UNIQUE) |
| `user_id` | INT | FK → `users.id` ON DELETE CASCADE |
| `snoozed_at` | TIMESTAMP | Cuando se pospuso |
| `resume_at` | TIMESTAMP | Cuando se reanuda el repaso |
| `snooze_duration_minutes` | INT | Duración (30, 240, 1440, 4320, ...) |
| `reason` | TEXT | Razón (opcional) |

**Propósito**: Permite posponer tarjetas sin cambiar su estado de repetición espaciada.

**Duraciones Típicas**:
- `30` min (después a más tarde hoy)
- `240` min (después en 4 horas)
- `1440` min (después mañana)
- `4320` min (después en 3 días)

**Constraint Único**: `card_id` - Una tarjeta solo puede estar pospuesta una vez.

---

### 📊 Tabla: `review_predictions` (Predicciones FSRS)

*Tabla auxiliar para cachear predicciones*

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | PK |
| `card_id` | INT | FK → `flashcards.id` ON DELETE CASCADE |
| `predicted_difficulty` | REAL | Dificultad predicha (0-10) |
| `predicted_retention` | REAL | Retención predicha (%) |
| `next_intervals` | TEXT | JSON: [1d, 3d, 7d, 21d, ...] |
| `computed_at` | TIMESTAMP | Cuándo se calculó |

---

### 📈 Tabla: `learning_analytics` (Estadísticas por Materia)

*Agregación rápida de métricas*

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | INT | FK |
| `subject_id` | INT | FK |
| `total_reviews` | INT | Total de repasos |
| `correct_reviews` | INT | Repasos correctos |
| `incorrect_reviews` | INT | Repasos incorrectos |
| `mastery_percentage` | REAL | Dominio (%) |
| `last_updated` | TIMESTAMP | Última actualización |

---

## Presentación de Preguntas

### 🃏 Flujo de Estudio (FlashcardStudyScreen)

```
┌────────────────────────────────┐
│ 1. Cargar mazo prioritizado    │
│ (tarjetas vencidas primero)    │
└────────────┬───────────────────┘
             │
┌────────────▼───────────────────┐
│ 2. Mostrar pregunta/escenario   │
├────────────────────────────────┤
│ "¿Cuál es la velocidad de      │
│  la luz en el vacío?"          │
│                                │
│ [Mostrar pista] [Saltar]       │
└────────────┬───────────────────┘
             │
        ┌────▼─────┐
        │ ¿Tipo?   │
        └────┬─────┘
        ┌────┴────┐
        │ Flashcard│ Multiple-Choice │ V/F
        └────┬─────┴────────────────┘
             │
    ╔════════╬════════╗
    ║        ║        ║
    ▼        ▼        ▼
 ┌──────┐ ┌──────┐ ┌─────┐
 │ Flip │ │Opción│ │V / F│
 └──┬───┘ └──┬───┘ └──┬──┘
    │        │       │
    ▼        ▼       ▼
┌─────────────────────────────┐
│ 3. Revelar respuesta/eval   │
├─────────────────────────────┤
│ "299,792,458 m/s"           │
│ [Explicación magistral...]  │
│                             │
│ [Difícil] [OK] [Fácil] ✓    │
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│ 4. Calcular FSRS/SM-2       │
│ → Próxima fecha de repaso   │
│ → Actualizar estabilidad    │
│ → Guardar en BD             │
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│ 5. Siguiente tarjeta        │
│ (si más quedan)             │
└─────────────────────────────┘
```

---

### 🎯 Mostrar Pistas

Las pistas se muestran **bajo demanda** (botón "Ver pista"):

```
Flujo:
1. Usuario toca [Mostrar pista]
2. Aparece animada (fade-in) la pista:
   "Considere la velocidad de propagación 
    de la luz en el espacio-tiempo..."
3. No revela la respuesta completa
4. Es un "empujón pedagógico" al pensamiento
```

---

### 📖 Mostrar Explicaciones

**Después de que el usuario responde**:

```
┌────────────────────────────────────────┐
│ RESPUESTA CORRECTA ✅                 │
├────────────────────────────────────────┤
│ Tu respuesta: 299,792,458 m/s          │
│ Respuesta correcta: 299,792,458 m/s    │
│                                        │
│ 📚 EXPLICACIÓN MAGISTRAL:             │
│                                        │
│ La velocidad de la luz es una          │
│ constante fundamental universal.       │
│ En el vacío, la luz viaja a            │
│ aproximadamente 3×10⁸ m/s.             │
│ Esta constante es crucial en la        │
│ teoría de la relatividad especial...   │
│                                        │
│ [Siguiente] [Anterior]                 │
└────────────────────────────────────────┘
```

---

## Sistema de Evaluación

El sistema implementa el **patrón Strategy** para evaluar diferentes tipos de ítems:

**Ubicación**: `mobile/src/utils/evaluationStrategies.ts`

### Estrategia 1: FlashcardStrategy

```typescript
interface FlashcardStrategy {
  requiresReveal: true  // Debe revelar antes de calificar
  
  evaluate(item, answer: 'learning' | 'review', responseTimeMs): EvaluationResult {
    return {
      itemId: item.id,
      itemType: 'flashcard',
      passed: answer === 'review',
      responseTimeMs,
      selfRating: answer
    }
  }
  
  getStatusUpdate(result): 'learning' | 'review' {
    return result.selfRating  // El usuario decide
  }
}
```

**Lógica**:
- Usuario ve tarjeta de frente
- Toca "Mostrar reverso" → Flip animation
- Ve respuesta correcta
- Elige: "Difícil (learning)" o "Fácil (review)"
- **NO hay evaluación objetiva**, es autoevaluación

---

### Estrategia 2: MultipleChoiceStrategy

```typescript
interface MultipleChoiceStrategy {
  requiresReveal: false  // Feedback inmediato
  
  evaluate(item, answer: number, responseTimeMs): EvaluationResult {
    const content = item.content as MultipleChoiceContent
    return {
      itemId: item.id,
      itemType: 'multiple_choice',
      passed: answer === content.correctIndex,
      responseTimeMs,
      selectedAnswer: answer
    }
  }
  
  getStatusUpdate(result): 'learning' | 'review' {
    return result.passed ? 'review' : 'learning'
  }
}
```

**Lógica**:
- Usuario ve pregunta + 4 opciones
- Toca una opción
- **Evaluación automática inmediata**:
  - ✅ Si `selectedAnswer === correctIndex` → CORRECT
  - ❌ Caso contrario → INCORRECT
- Calificación binaria

---

### Estrategia 3: BooleanStrategy

```typescript
interface BooleanStrategy {
  requiresReveal: false  // Feedback inmediato
  
  evaluate(item, answer: boolean, responseTimeMs): EvaluationResult {
    const content = item.content as BooleanContent
    return {
      itemId: item.id,
      itemType: 'boolean',
      passed: answer === content.correctAnswer,
      responseTimeMs,
      selectedAnswer: answer
    }
  }
  
  getStatusUpdate(result): 'learning' | 'review' {
    return result.passed ? 'review' : 'learning'
  }
}
```

---

### FactoryPattern para Instanciar Estrategias

```typescript
export const StrategyFactory = {
  getStrategy(type: EvaluationItemType): EvaluationStrategy {
    switch (type) {
      case 'flashcard':       return new FlashcardStrategy();
      case 'multiple_choice': return new MultipleChoiceStrategy();
      case 'boolean':         return new BooleanStrategy();
      default:                return new FlashcardStrategy();
    }
  },
};

// Uso:
const strategy = StrategyFactory.getStrategy(item.item_type);
const result = strategy.evaluate(item, userAnswer, responseTimeMs);
const newStatus = strategy.getStatusUpdate(result);
```

---

## Algoritmos de Repetición Espaciada

### 🧠 Algoritmo SM-2 (SuperMemo 2)

**Teoría**: Basado en la Curva del Olvido (Ebbinghaus) + Spacing Effect

**Parámetros**:

| Parámetro | Rango | Significado |
|-----------|-------|-------------|
| `q` (calidad) | 0-5 | Calidad de la respuesta |
| `EF` (Ease Factor) | ≥ 1.3 | Facilidad relativa |
| `I` (Interval) | Días | Intervalo entre repasos |
| `n` (Repetitions) | Contador | Repeticiones exitosas |

**Mapeo de Calidad**:
- `0` = Olvido completo
- `1` = Esfuerzo total para recordar
- `2` = Recuerdo difícil, pero correcto
- `3` = Recuerdo después de dudar
- `4` = Recuerdo con cierta dificultad
- `5` = Recuerdo perfecto

**Fórmula de Cálculo**:

```javascript
function calculateSM2(params) {
  const { quality, easeFactor = 2.5, interval = 1, repetitions = 0 } = params;

  // Paso 1: Calcular nuevo Ease Factor
  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;  // Límite mínimo

  // Paso 2: Determinar nuevo intervalo
  let newInterval, newReps;
  
  if (quality < 3) {
    // Calidad baja → Reiniciar
    newReps = 0;
    newInterval = 1;
  } else {
    // Calidad aceptable o mejor
    newReps = repetitions + 1;
    
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 3;
    else newInterval = Math.round(interval * newEF);
  }

  // Paso 3: Calcular próxima fecha
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    newEaseFactor: newEF,
    newInterval,
    newRepetitions: newReps,
    nextReviewDate
  };
}
```

**Ejemplo Práctico**:

```
Tarjeta: "¿Cuál es la mitocondria?"

Intento 1:
  - Calidad: 4 (recordé con cierta dificultad)
  - EF: 2.5 → 2.36
  - Interval: 1 → 1
  - Reps: 0 → 1
  - Próxima: Mañana

Intento 2 (mañana):
  - Calidad: 5 (perfecto)
  - EF: 2.36 → 2.5
  - Interval: 1 → 3
  - Reps: 1 → 2
  - Próxima: En 3 días

Intento 3 (en 3 días):
  - Calidad: 3 (con dudar)
  - EF: 2.5 → 2.36
  - Interval: 3 → 1 (reinicia)
  - Reps: 2 → 0
  - Próxima: Mañana
```

---

### 🚀 Algoritmo FSRS (Free Spaced Repetition Scheduler)

**Alternativa moderna a SM-2**: Considera más factores, mejor predicción.

**Parámetros**:

| Parámetro | Descripción |
|-----------|-------------|
| `stability` | Estabilidad de memoria (cuánto se recuerda después de n días) |
| `difficulty` | Dificultad inherente del ítem (0-10) |
| `retention` | Retención esperada (%) |
| `interval` | Días desde último repaso |

**Fórmula Simplificada**:

```javascript
function calculateFSRS(params) {
  const { quality, stability = 1, difficulty = 0.5, interval = 1, 
          repetitions = 0 } = params;

  // Factor de retención exponencial
  const retention = Math.exp(-interval / 36);

  // Nueva dificultad
  let newDifficulty = Math.max(0.1, 
    Math.min(10, difficulty + 0.1 - quality * 0.02));

  // Nueva estabilidad según calidad
  let newStability, newReps = repetitions;

  if (quality < 3) {
    newStability = stability * 0.72;
    newReps = 0;  // Reiniciar
  } else if (quality === 3) {
    newStability = stability * 1.26;
    newReps += 1;
  } else if (quality === 4) {
    newStability = stability * 1.77;
    newReps += 1;
  } else {
    newStability = stability * 2.36;
    newReps += 1;
  }

  // Nuevo intervalo
  const newInterval = Math.round(newStability * 9 * (1 - retention));

  return {
    newStability,
    newDifficulty,
    newRepetitions: newReps,
    newInterval: Math.max(1, newInterval),
    retention: Math.round(retention * 100)
  };
}
```

**Ventajas sobre SM-2**:
- ✅ Considera dificultad intrínseca del ítem
- ✅ Mejor predicción de retención
- ✅ Adapta intervalos dinámicamente
- ✅ Menos matemática teórica, más empírica

---

### 📊 Detección de Tarjetas Problemáticas

```javascript
function detectProblematicCard(stats) {
  const { totalAttempts, failureRate, avgResponseTimeMs } = stats;

  const issues = [];

  // Criterio 1: 90%+ de fallos
  if (totalAttempts >= 10 && failureRate >= 0.9) {
    issues.push({
      type: 'HIGH_FAILURE_RATE',
      severity: 'CRITICAL',
      message: `${(failureRate * 100).toFixed(1)}% fallan. 
                Probable: Pregunta mal redactada o concepto demasiado complejo.`
    });
  }

  // Criterio 2: Tiempo promedio > 30s
  if (avgResponseTimeMs > 30000) {
    issues.push({
      type: 'HIGH_RESPONSE_TIME',
      severity: 'WARNING',
      message: `Tiempo promedio: ${(avgResponseTimeMs / 1000).toFixed(1)}s. 
                Considere fragmentar en micro-tarjetas.`
    });
  }

  // Criterio 3: 60-89% de fallos
  if (totalAttempts >= 5 && failureRate >= 0.6 && failureRate < 0.9) {
    issues.push({
      type: 'MODERATE_DIFFICULTY',
      severity: 'INFO',
      message: `Tasa de fallo: ${(failureRate * 100).toFixed(1)}%. 
                Tarjeta desafiante pero abordable.`
    });
  }

  return {
    isProblem: issues.length > 0,
    issues,
    recommendation: issues.length > 0 ? 'REVIEW_OR_SPLIT' : 'HEALTHY'
  };
}
```

---

## Backend - Controladores y Rutas

### 📂 Estructura de Rutas

**Archivo**: `backend/routes/flashcards.js`

```javascript
// ─── Mazos (Decks) ──────────────────────────────────────────

GET    /flashcard-decks                      // Lista de mazos del usuario
GET    /flashcard-decks/with-metrics         // Mazos con prioridad de repaso
POST   /flashcard-decks                      // Crear nuevo mazo
PUT    /flashcard-decks/{deckId}             // Actualizar mazo
DELETE /flashcard-decks/{deckId}             // Eliminar mazo

// ─── Tarjetas (Cards) ──────────────────────────────────────

GET    /flashcard-decks/{deckId}/cards       // Obtener todas las tarjetas
GET    /flashcard-decks/{deckId}/cards/prioritized  // Tarjetas por prioridad
GET    /flashcards/{cardId}                  // Obtener una tarjeta
POST   /flashcard-decks/{deckId}/cards       // Crear tarjeta legacy
POST   /flashcard-decks/{deckId}/items       // Crear ítem polimórfico
PUT    /flashcards/{cardId}                  // Actualizar tarjeta
DELETE /flashcards/{cardId}                  // Eliminar tarjeta

// ─── Generación de IA ──────────────────────────────────────

POST   /flashcard-decks/generate-from-text   // Generar desde texto
POST   /flashcard-decks/generate-from-image  // Generar desde imagen

// ─── Revisión y Evaluación ────────────────────────────────

POST   /flashcards/{cardId}/review           // Registrar intento
PUT    /flashcards/{cardId}/status           // Cambiar estado

// ─── Compartición ──────────────────────────────────────────

POST   /flashcard-decks/{deckId}/share       // Compartir mazo
DELETE /flashcard-decks/{deckId}/share       // Quitar acceso compartido

// ─── Snoozed Cards ─────────────────────────────────────────

POST   /flashcards/{cardId}/snooze           // Posponer tarjeta
GET    /flashcards/{cardId}/snooze           // Ver estado de posposición
DELETE /flashcards/{cardId}/snooze           // Cancelar posposición
```

---

### 🎮 Controlador: `flashcardsController.js`

**Funciones Principales**:

#### `getFlashcardDecks(req, res)`
- **GET** `/flashcard-decks?user_id=123`
- Retorna todos los mazos del usuario (propios + compartidos)
- Incluye: `card_count`, `review_count`, `learning_count`, `new_count`, `mc_count`, `boolean_count`

```javascript
exports.getFlashcardDecks = (req, res) => {
  const userId = req.query.user_id;
  const query = `
    SELECT fd.*, s.name as subject_name, u.username as owner_username,
           COUNT(*) as card_count,
           COUNT(*) FILTER (WHERE fc.status='review') as review_count,
           ...
    FROM flashcard_decks fd
    JOIN users u ON fd.user_id = u.id
    LEFT JOIN subjects s ON fd.subject_id = s.id
    WHERE fd.user_id = ? 
       OR fd.id IN (SELECT deck_id FROM shared_decks WHERE shared_to_user_id = ?)
    GROUP BY fd.id
    ORDER BY fd.created_at DESC
  `;
  db.all(query, [userId, userId], (err, rows) => {
    res.json(rows);
  });
};
```

---

#### `createEvaluationItem(req, res)`
- **POST** `/flashcard-decks/{deckId}/items`
- Crear ítem polimórfico (flashcard, multiple_choice, boolean)
- **Body**:
  ```json
  {
    "item_type": "multiple_choice",
    "content_json": {
      "question": "¿Pregunta?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 2
    },
    "hint": "Pista",
    "explanation": "Explicación"
  }
  ```

```javascript
exports.createEvaluationItem = (req, res) => {
  const { deckId } = req.params;
  const { item_type, content_json, hint, explanation } = req.body;

  // Validar tipo
  const validTypes = ['flashcard', 'multiple_choice', 'boolean'];
  if (!validTypes.includes(item_type)) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }

  const contentStr = typeof content_json === 'string' 
    ? content_json 
    : JSON.stringify(content_json);

  // Calcular next_review_date: 7 días desde hoy
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + 7);

  db.run(
    `INSERT INTO flashcards 
     (deck_id, item_type, content_json, hint, explanation, status, next_review_date, 
      sm2_ease_factor, fsrs_stability, fsrs_difficulty) 
     VALUES (?, ?, ?, ?, ?, 'new', ?, 2.5, 1, 0.5)`,
    [deckId, item_type, contentStr, hint, explanation, nextReviewDate.toISOString()],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, ...req.body });
    }
  );
};
```

---

#### `recordCardReview(req, res)`
- **POST** `/flashcards/{cardId}/review`
- Registrar intento de repaso y calcular siguiente fecha
- **Body**:
  ```json
  {
    "userId": 123,
    "result": "correct",
    "responseTimeMs": 5000
  }
  ```

```javascript
exports.recordCardReview = (req, res) => {
  const { cardId } = req.params;
  const { userId, result, responseTimeMs } = req.body;

  // Obtener tarjeta actual
  db.get(
    `SELECT * FROM flashcards WHERE id = ?`,
    [cardId],
    (err, card) => {
      // Mapear resultado a calidad (0-5)
      let quality = result === 'correct' 
        ? (responseTimeMs < 3000 ? 5 : 4) 
        : 1;

      // Calcular FSRS
      const fsrsResult = calculateFSRS({
        quality,
        stability: card.fsrs_stability,
        difficulty: card.fsrs_difficulty,
        repetitions: card.fsrs_repetitions
      });

      // Actualizar tarjeta
      db.run(
        `UPDATE flashcards 
         SET fsrs_stability = ?, fsrs_difficulty = ?, fsrs_repetitions = ?,
             next_review_date = ?, status = 'review'
         WHERE id = ?`,
        [fsrsResult.newStability, fsrsResult.newDifficulty, 
         fsrsResult.newRepetitions, fsrsResult.nextReviewDate, cardId]
      );

      // Registrar en logs
      db.run(
        `INSERT INTO card_logs (card_id, user_id, result, response_time_ms)
         VALUES (?, ?, ?, ?)`,
        [cardId, userId, result, responseTimeMs]
      );

      res.json({
        success: true,
        nextReviewDate: fsrsResult.nextReviewDate,
        retention: fsrsResult.retention
      });
    }
  );
};
```

---

#### `shareDeck(req, res)`
- **POST** `/flashcard-decks/{deckId}/share`
- Compartir mazo con otro usuario usando su PIN
- **Body**:
  ```json
  {
    "user_id": 123,
    "recipient_pin": "ABCD1234"
  }
  ```

```javascript
exports.shareDeck = (req, res) => {
  const { deckId } = req.params;
  const { user_id, recipient_pin } = req.body;

  // 1. Buscar usuario por PIN
  db.get(
    `SELECT id, username, name FROM users WHERE share_pin = ?`,
    [recipient_pin.trim().toUpperCase()],
    (err, recipient) => {
      if (!recipient) return res.status(404).json({ error: 'Usuario no encontrado' });

      // 2. Verificar permiso del mazo
      db.get(
        `SELECT id FROM flashcard_decks WHERE id = ? AND user_id = ?`,
        [deckId, user_id],
        (err, deck) => {
          if (!deck) return res.status(403).json({ error: 'Sin permiso' });

          // 3. Insertar en shared_decks
          db.run(
            `INSERT INTO shared_decks (deck_id, shared_by_user_id, shared_to_user_id)
             VALUES (?, ?, ?)`,
            [deckId, user_id, recipient.id],
            function(err) {
              if (err && err.message.includes('UNIQUE')) {
                return res.json({ message: 'Mazo ya compartido' });
              }
              res.status(201).json({ 
                message: `Compartido con @${recipient.username}`,
                recipient_name: recipient.name
              });
            }
          );
        }
      );
    }
  );
};
```

---

### 🤖 Controlador de IA: `aiController.js`

#### `generateFlashcards(req, res)`
- **POST** `/api/ai/generate-flashcards`
- Genera ítems usando Gemini → Fallback Groq

```javascript
exports.generateFlashcards = async (req, res) => {
  const { context_text, count = 10, userRequest = '' } = req.body;

  try {
    let flashcards = [];
    let provider = '';

    // Intento 1: Gemini
    if (secrets.GEMINI_API_KEY) {
      try {
        flashcards = await geminiService.generateFlashcardsFromText(
          context_text, 
          count
        );
        provider = 'gemini';
      } catch (err) {
        console.warn('Gemini falló, intentando Groq...');
      }
    }

    // Fallback: Groq
    if (!flashcards.length) {
      flashcards = await geminiService.generateFlashcardsWithGroq(
        context_text, 
        count
      );
      provider = 'groq';
    }

    res.json({
      success: true,
      provider,
      flashcards,
      count: flashcards.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

---

### 🔌 Servicio Gemini: `geminiService.js`

#### Generación desde Texto

```javascript
async function generateFlashcardsFromText(contextText, count = 10) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    safetySettings: SAFETY_SETTINGS
  });

  // Construir prompt adaptativo
  const systemPrompt = buildAdaptivePrompt('mixed', count, contextText, 'posgrado');

  const finalPrompt = `${systemPrompt}

═══════════════════════════════════════════════════════════════════════════════
MATERIAL ACADÉMICO A ANALIZAR:
═══════════════════════════════════════════════════════════════════════════════

${contextText}

═══════════════════════════════════════════════════════════════════════════════
ACCIÓN:
═══════════════════════════════════════════════════════════════════════════════

Genera exactamente ${count} ítems de evaluación.
Distribución: 40% Opción Múltiple + 40% Flashcard + 20% Verdadero/Falso

REQUISITOS:
✅ CADA ítem: "type", "data", "hint", "explanation"
✅ CERO preguntas sobre metadatos
✅ TODAS de nivel Análisis/Síntesis/Evaluación (Bloom 4-6)
✅ Distractores son errores REALES de la disciplina
✅ Pistas: Empujones al razonamiento
✅ Explicaciones: Lecciones que enseñan

Responde ÚNICAMENTE el array JSON. CERO texto adicional.`;

  const result = await model.generateContent([{ text: finalPrompt }]);
  const response = result.response.text();

  // Parsear JSON
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  const items = JSON.parse(jsonMatch[0]);

  return processAtomicFlashcards(items);
}
```

---

#### Generación desde Imagen (OCR)

```javascript
async function generateFlashcardsFromImage(imageBase64, count = 10) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-vision",
    safetySettings: SAFETY_SETTINGS
  });

  const fileToGenerativeFile = await fileManager.uploadFile(
    Buffer.from(imageBase64, 'base64'),
    'image/jpeg'
  );

  const prompt = `Analiza esta imagen y genera ${count} ítems de evaluación académica...`;

  const result = await model.generateContent([
    { text: prompt },
    {
      fileData: {
        fileUri: fileToGenerativeFile.uri,
        mimeType: 'image/jpeg'
      }
    }
  ]);

  return parseJsonFromResponse(result.response.text());
}
```

---

## Frontend - Componentes y Hooks

### 📱 Componente: `FlashcardCreatorModal.tsx`

**Ubicación**: `mobile/src/components/FlashcardCreatorModal.tsx`

**Pasos**:
1. Usuario selecciona fuente (texto/imagen)
2. Elige modo (Flashcard/ECAES/V/F/Mixto)
3. Especifica cantidad de ítems
4. Frontend genera con IA
5. Previsualiza ítems editables
6. Confirma y guarda

```typescript
export const FlashcardCreatorModal: React.FC<FlashcardCreatorModalProps> = ({
  visible, onClose, onSuccess, content, imageBase64,
  contentType, title, subjectId, userId,
}) => {
  const { generate, loading, generatedDeck, clearGeneratedDeck } = useFlashcardGenerator();
  const [step, setStep] = useState<'input' | 'preview' | 'complete'>('input');
  const [cardCount, setCardCount] = useState('10');
  const [studyMode, setStudyMode] = useState<StudyMode>('flashcard');
  const [editableCards, setEditableCards] = useState<EditableCard[]>([]);

  const handleGenerateCards = async () => {
    const count = parseInt(cardCount);
    const result = await generate({
      text: content,
      imageBase64,
      count,
      title,
      subjectId,
      userId,
      mode: studyMode,
    });

    if (result.success && result.deck) {
      // Mapear respuesta a EditableCard[]
      const cards = (result.deck.cards || []).map(card => {
        const itemType = card.item_type || 'flashcard';
        
        if (itemType === 'multiple_choice') {
          return {
            id: card.id,
            question: card.content?.question,
            answer: '',
            type: itemType,
            options: card.content?.options,
            correctIndex: card.content?.correctIndex,
          };
        } else if (itemType === 'boolean') {
          return {
            id: card.id,
            question: card.content?.question,
            answer: '',
            type: itemType,
            options: ['Verdadero', 'Falso'],
            correctIndex: card.content?.correctAnswer ? 0 : 1,
          };
        } else {
          return {
            id: card.id,
            question: card.content?.front,
            answer: card.content?.back,
            type: itemType,
          };
        }
      });
      setEditableCards(cards);
      setStep('preview');
    }
  };

  const handleSaveDeck = async () => {
    setStep('complete');
    setTimeout(() => {
      onSuccess(generatedDeck?.id || 0);
    }, 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {/* ... UI para cada paso ... */}
    </Modal>
  );
};
```

---

### 🎯 Componente: `FlashcardNewCardScreen.tsx`

**Ubicación**: `mobile/src/components/FlashcardNewCardScreen.tsx`

**Pasos**:
1. Seleccionar tipo de ítem
2. Rellenar formulario dinámico
3. Agregar pista y explicación (opcionales)
4. Guardar en BD

```typescript
export const FlashcardNewCardScreen: React.FC<Props> = ({ 
  activeDeck, onBack, onCardCreated 
}) => {
  const [step, setStep] = useState<'selectType' | 'fillForm'>('selectType');
  const [selectedType, setSelectedType] = useState<EvaluationItemType>('flashcard');

  // Campos según tipo
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [mcQuestion, setMcQuestion] = useState('');
  const [mcOptions, setMcOptions] = useState(['', '', '', '']);
  const [mcCorrectIndex, setMcCorrectIndex] = useState(0);
  const [boolQuestion, setBoolQuestion] = useState('');
  const [boolAnswer, setBoolAnswer] = useState(true);
  const [hint, setHint] = useState('');
  const [explanation, setExplanation] = useState('');

  const handleSave = async () => {
    let contentJson;

    if (selectedType === 'flashcard') {
      contentJson = { front: front.trim(), back: back.trim() };
    } else if (selectedType === 'multiple_choice') {
      contentJson = { 
        question: mcQuestion.trim(), 
        options: mcOptions.map(o => o.trim()), 
        correctIndex: mcCorrectIndex 
      };
    } else {
      contentJson = { 
        question: boolQuestion.trim(), 
        correctAnswer: boolAnswer 
      };
    }

    const response = await fetchWithFallback(
      `/flashcard-decks/${activeDeck.id}/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: selectedType,
          content_json: contentJson,
          hint: hint.trim() || null,
          explanation: explanation.trim() || null,
        }),
      }
    );

    onCardCreated();
  };

  if (step === 'selectType') {
    return (
      <View>
        {TYPE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.type}
            onPress={() => { 
              setSelectedType(opt.type); 
              setStep('fillForm'); 
            }}
          >
            <Text>{opt.icon} {opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View>
      {/* Formulario dinámico según selectedType */}
      {selectedType === 'flashcard' && (
        <>
          <TextInput value={front} onChangeText={setFront} placeholder="Frente" />
          <TextInput value={back} onChangeText={setBack} placeholder="Reverso" />
        </>
      )}

      {selectedType === 'multiple_choice' && (
        <>
          <TextInput value={mcQuestion} onChangeText={setMcQuestion} placeholder="Pregunta" />
          {mcOptions.map((opt, i) => (
            <TextInput 
              key={i} 
              value={opt} 
              onChangeText={text => {
                const arr = [...mcOptions];
                arr[i] = text;
                setMcOptions(arr);
              }}
              placeholder={`Opción ${String.fromCharCode(65 + i)}`}
            />
          ))}
        </>
      )}

      {selectedType === 'boolean' && (
        <>
          <TextInput value={boolQuestion} onChangeText={setBoolQuestion} 
            placeholder="Afirmación" />
          <Switch value={boolAnswer} onValueChange={setBoolAnswer} />
        </>
      )}

      {/* Campos comunes */}
      <TextInput value={hint} onChangeText={setHint} placeholder="Pista" />
      <TextInput value={explanation} onChangeText={setExplanation} 
        placeholder="Explicación" />

      <Button title="Guardar" onPress={handleSave} />
    </View>
  );
};
```

---

### 🎓 Hook: `useFlashcardGenerator`

**Ubicación**: `mobile/src/hooks/useFlashcardGenerator.ts`

```typescript
export const useFlashcardGenerator = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedDeck, setGeneratedDeck] = useState<GeneratedDeck | null>(null);

  const generate = async (params: GenerateCardsParams) => {
    setLoading(true);
    setError(null);

    try {
      // Validar entrada
      if (!params.text && !params.imageBase64) {
        throw new Error('Se requiere texto o imagen');
      }

      if (params.text && params.text.trim().length < 50) {
        throw new Error('Texto demasiado corto (<50 caracteres)');
      }

      let result;

      if (params.imageBase64) {
        result = await generateFlashcardsFromImage({
          image_base64: params.imageBase64,
          count: params.count,
          title: params.title,
          subject_id: params.subjectId,
          user_id: params.userId,
          mode: params.mode || 'flashcard',
        });
      } else {
        result = await generateFlashcardsFromText({
          text: params.text,
          count: params.count,
          title: params.title,
          subject_id: params.subjectId,
          user_id: params.userId,
          mode: params.mode || 'flashcard',
        });
      }

      setGeneratedDeck(result);
      return { success: true, deck: result };
    } catch (err: any) {
      const errorMsg = err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    generate,
    loading,
    error,
    generatedDeck,
    clearError: () => setError(null),
    clearGeneratedDeck: () => setGeneratedDeck(null),
  };
};
```

---

## Servicios de API

### 📡 Servicio: `mobile/src/services/api/flashcards.ts`

```typescript
// Obtener todos los mazos del usuario
export const getFlashcardDecks = async (): Promise<FlashcardDeck[]> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcard-decks?user_id=${userId}`
  );
  return (await parseJsonSafely(response)) || [];
};

// Obtener mazos con prioridad de repaso
export const getFlashcardDecksWithMetrics = async (): Promise<FlashcardDeck[]> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcard-decks/with-metrics?user_id=${userId}`
  );
  return (await parseJsonSafely(response)) || [];
};

// Crear nuevo mazo
export const createFlashcardDeck = async (payload: {
  subject_id?: number;
  title: string;
  description?: string;
}) => {
  const userId = await getUserId();
  const response = await fetchWithFallback('/flashcard-decks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, user_id: userId }),
  });
  return await parseJsonSafely(response);
};

// Obtener tarjetas de un mazo
export const getFlashcards = async (deckId: number): Promise<Flashcard[]> => {
  const response = await fetchWithFallback(
    `/flashcard-decks/${deckId}/cards`
  );
  return (await parseJsonSafely(response)) || [];
};

// Obtener tarjetas prioritizadas
export const getFlashcardsPrioritized = async (deckId: number): Promise<Flashcard[]> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcard-decks/${deckId}/cards/prioritized?userId=${userId}`
  );
  return (await parseJsonSafely(response)) || [];
};

// Generar desde texto
export const generateFlashcardsFromText = async (payload: {
  text: string;
  count: number;
  title: string;
  subject_id: number;
  user_id: number;
  mode?: string;
}) => {
  const response = await fetchWithFallback(
    '/flashcard-decks/generate-from-text',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return await parseJsonSafely(response);
};

// Generar desde imagen
export const generateFlashcardsFromImage = async (payload: {
  image_base64: string;
  count: number;
  title: string;
  subject_id: number;
  user_id: number;
  mode?: string;
}) => {
  const response = await fetchWithFallback(
    '/flashcard-decks/generate-from-image',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return await parseJsonSafely(response);
};

// Compartir mazo
export const shareDeck = async (deckId: number, recipientPin: string) => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcard-decks/${deckId}/share`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        recipient_pin: recipientPin.trim().toUpperCase(),
      }),
    }
  );
  return await parseJsonSafely(response);
};

// Posponer tarjeta (Snooze)
export interface SnoozeStatus {
  isSnoozed: boolean;
  cardId: number;
  resumeAt?: string;
  durationMinutes?: number;
  timeUntilResume?: number;
}

export const snoozeCard = async (
  cardId: number,
  durationMinutes: number
): Promise<SnoozeStatus> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcards/${cardId}/snooze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, duration_minutes: durationMinutes }),
    }
  );
  return await parseJsonSafely(response);
};
```

---

## Librerías Adicionales del Proyecto

### 📦 Backend (Node.js)

```json
{
  "dependencies": {
    "@distube/ytdl-core": "^4.16.12",           // Descarga de videos YouTube
    "@google/generative-ai": "^0.24.1",         // SDK Gemini
    "bcrypt": "^6.0.0",                         // Hash de contraseñas
    "cors": "^2.8.6",                           // Cross-Origin Resource Sharing
    "dotenv": "^17.4.2",                        // Variables de entorno
    "express": "^5.2.1",                        // Framework web
    "express-rate-limit": "^8.5.1",             // Rate limiting
    "helmet": "^8.1.0",                         // Seguridad HTTP headers
    "jsonwebtoken": "^9.0.3",                   // JWT para autenticación
    "mammoth": "^1.12.0",                       // Parsing de .docx
    "morgan": "^1.10.1",                        // Logger de requests HTTP
    "multer": "^1.4.5-lts.1",                   // Upload de archivos
    "pdf-parse": "^1.1.1",                      // Parsing de PDFs
    "pdfkit": "^0.18.0",                        // Generación de PDFs
    "pg": "^8.20.0",                            // Driver PostgreSQL
    "sqlite3": "^6.0.1",                        // Driver SQLite
    "swagger-jsdoc": "^6.2.8",                  // Generación Swagger/OpenAPI
    "swagger-ui-express": "^5.0.1",             // UI para Swagger
    "uploadthing": "^7.7.4",                    // Upload de archivos a cloud
    "youtube-transcript": "^1.3.1",             // Obtener transcripciones YouTube
    "zod": "^4.4.3"                             // Validación de esquemas TypeScript
  }
}
```

### 📱 Frontend/Mobile (React Native + Expo)

```json
{
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",            // Iconos (Material, FontAwesome, etc)
    "@lottiefiles/dotlottie-react": "^0.13.5",  // Animaciones Lottie
    "@react-native-async-storage/async-storage": "2.2.0", // Almacenamiento local
    "@react-native-community/datetimepicker": "8.4.4",    // Date/Time picker
    "@react-native-community/netinfo": "11.4.1", // Info de red (offline detection)
    "@react-native-community/slider": "5.0.1",  // Slider component
    "@react-navigation/bottom-tabs": "^7.4.0",  // Navigation bottom tabs
    "@react-navigation/elements": "^2.6.3",     // Navigation elements
    "@react-navigation/native": "^7.1.8",       // Navigation core
    "@shopify/react-native-skia": "2.2.12",     // Dibujo 2D (Canvas-like)
    "expo": "~54.0.33",                         // Expo framework
    "expo-application": "~7.0.8",               // App info
    "expo-av": "~16.0.8",                       // Audio/Video
    "expo-camera": "~17.0.10",                  // Acceso a cámara
    "expo-clipboard": "~8.0.8",                 // Copiar al portapapeles
    "expo-constants": "~18.0.13",               // Constantes de app
    "expo-crypto": "~15.0.8",                   // Funciones criptográficas
    "expo-document-picker": "~14.0.8",          // Seleccionar documentos
    "expo-file-system": "~19.0.21",             // Sistema de archivos
    "expo-font": "~14.0.11",                    // Cargar fonts personalizadas
    "expo-haptics": "~15.0.8",                  // Retroalimentación háptica
    "expo-image": "~3.0.11",                    // Manejo de imágenes
    "expo-image-manipulator": "~14.0.8",        // Edición de imágenes
    "expo-image-picker": "~17.0.10",            // Selector de imágenes/cámara
    "expo-intent-launcher": "~13.0.8",          // Abrir apps externas
    "expo-linear-gradient": "~15.0.8",          // Gradientes lineales
    "expo-linking": "~8.0.11",                  // Deep linking
    "expo-local-authentication": "~17.0.8",     // Biometría
    "expo-media-library": "~18.2.1",            // Acceso a galería
    "expo-notifications": "~0.32.16",           // Notificaciones push
    "expo-print": "~15.0.8",                    // Imprimir documentos
    "expo-router": "~6.0.23",                   // Enrutamiento file-based
    "expo-secure-store": "~15.0.8",             // Almacenamiento seguro
    "expo-sensors": "~15.0.8",                  // Acelerómetro, giroscopio
    "expo-sharing": "~14.0.8",                  // Compartir archivos
    "expo-splash-screen": "~31.0.13",           // Splash screen
    "expo-sqlite": "~16.0.10",                  // SQLite local
    "expo-status-bar": "~3.0.9",                // Control de status bar
    "expo-symbols": "~1.0.8",                   // SF Symbols (iOS)
    "expo-system-ui": "~6.0.9",                 // UI del sistema
    "expo-web-browser": "~15.0.10",             // Navegador integrado
    "i18next": "^26.0.6",                       // Internacionalización (i18n)
    "lottie-react-native": "~7.3.1",            // Animaciones Lottie
    "pdf-lib": "^1.17.1",                       // Manipulación de PDFs
    "react": "19.1.0",                          // React core
    "react-dom": "19.1.0",                      // React para web
    "react-i18next": "^17.0.4",                 // Binding i18next con React
    "react-native": "0.81.5",                   // React Native core
    "react-native-chart-kit": "^6.12.0",        // Gráficos (barras, líneas, etc)
    "react-native-document-scanner-plugin": "^2.0.4", // Scanner OCR
    "react-native-gesture-handler": "~2.28.0",  // Gestos avanzados
    "react-native-haptic-feedback": "^3.0.0",   // Retroalimentación háptica
    "react-native-markdown-display": "^7.0.2",  // Renderizar Markdown
    "react-native-reanimated": "~4.1.1",        // Animaciones complejas
    "react-native-safe-area-context": "~5.6.0", // Manejo de safe areas
    "react-native-screens": "~4.16.0",          // Optimización de navigation
    "react-native-svg": "15.12.1",              // Soporte para SVGs
    "react-native-web": "~0.21.0",              // React Native en web
    "react-native-web-webview": "^1.0.2",       // WebView cross-platform
    "react-native-webview": "13.15.0",          // WebView nativo
    "react-native-worklets": "0.5.1",           // Worklets para Reanimated
    "react-native-youtube-iframe": "^2.4.1",    // Embed YouTube videos
    "uploadthing": "^7.7.4",                    // Upload de archivos
    "victory-native": "^36.9.2",                // Gráficos nativos
    "youtube-transcript": "^1.3.1",             // Obtener transcripciones
    "zustand": "^5.0.13"                        // State management (alternativa a Redux)
  },
  "devDependencies": {
    "@babel/helper-define-polyfill-provider": "^0.6.8",
    "@types/react": "~19.1.0",
    "eslint": "^9.25.0",
    "eslint-config-expo": "~10.0.0",
    "typescript": "~5.9.2"
  }
}
```

---

### 🔑 Variables de Entorno Requeridas

```bash
# Backend - .env

# Base de Datos
DB_TYPE=sqlite                    # sqlite o postgres
DATABASE_URL=./threshold.db       # Ruta SQLite o URL PostgreSQL

# LLM - Gemini (Preferido)
GEMINI_API_KEY=sk-...             # API key de Google Gemini

# LLM - Groq (Fallback)
GROQ_API_KEY=gsk-...              # API key de Groq

# Autenticación
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d

# Upload Files
UPLOADTHING_SECRET=sk-...
UPLOADTHING_APP_ID=...

# CORS
CORS_ORIGIN=http://localhost:3000,exp://...

# Puerto
PORT=5000
NODE_ENV=development
```

---

## 🎓 Resumen de Flujos Principales

### Flujo 1: Crear Tarjeta Manual

```
Usuario abre FlashcardNewCardScreen
  ↓
Selecciona tipo (Flashcard/ECAES/V/F)
  ↓
Rellena formulario dinámico
  ↓
POST /flashcard-decks/{id}/items
  ↓
Backend valida y inserta en BD
  ↓
Inicializa FSRS/SM-2 (next_review_date = hoy + 7 días)
  ↓
Retorna tarjeta creada
  ↓
Frontend muestra confirmación
```

---

### Flujo 2: Generar Tarjetas con IA

```
Usuario abre FlashcardCreatorModal
  ↓
Selecciona fuente (texto/imagen) y modo (F/MC/V)
  ↓
Especifica cantidad
  ↓
POST /flashcard-decks/generate-from-text (o image)
  ↓
Backend:
  1. Intenta Gemini
  2. Si falla → Groq
  3. LLM genera con prompts especializados
  4. Valida estructura JSON
  5. Inserta ítems en BD
  ↓
Frontend previsualiza ítems
  ↓
Usuario edita (opcional) y confirma
  ↓
Se guardan definitivamente
```

---

### Flujo 3: Estudiar Tarjetas

```
Usuario abre mazo
  ↓
GET /flashcard-decks/{id}/cards/prioritized
  ↓
Backend ordena por:
  1. Tarjetas vencidas (next_review_date <= hoy)
  2. Estado (learning > new > review)
  3. Dificultad (desc)
  4. Tasa de fallo (desc)
  ↓
Frontend muestra primera tarjeta
  ↓
Usuario ve pregunta + pista (opcional)
  ↓
Según tipo:
  - Flashcard: Flip → Ver reverso → Calificar
  - Multiple: Selecciona opción → Evaluación automática
  - Boolean: Toca V/F → Evaluación automática
  ↓
POST /flashcards/{id}/review { result, responseTimeMs }
  ↓
Backend:
  1. Calcula FSRS nuevo
  2. Actualiza next_review_date
  3. Registra en card_logs
  4. Actualiza learning_analytics
  ↓
Frontend muestra explicación magistral
  ↓
Siguiente tarjeta (loop)
```

---

### Flujo 4: Compartir Mazo

```
Usuario A presiona "Compartir"
  ↓
Ingresa PIN de Usuario B
  ↓
POST /flashcard-decks/{id}/share { recipient_pin }
  ↓
Backend:
  1. Busca usuario por PIN
  2. Verifica permiso del mazo
  3. Inserta en shared_decks
  ↓
Usuario B ve mazo en su lista
  ↓
Cambios en tiempo real
  ↓
Usuario B puede "dejar de seguir"
  ↓
DELETE shared_decks row
```

---

## 📊 Métricas y Análisis

El sistema recopila:
- **card_logs**: Cada intento (resultado, tiempo, dificultad deducida)
- **learning_analytics**: Dominio por materia (%)
- **review_predictions**: Predicciones FSRS para optimizar agenda

**Query para tarjetas problemáticas**:
```sql
SELECT fc.id, fc.item_type, COUNT(*) as total_attempts,
       ROUND(100.0 * SUM(CASE WHEN cl.result='incorrect' THEN 1 ELSE 0 END) / COUNT(*), 1) as failure_rate,
       AVG(cl.response_time_ms) as avg_response_time
FROM flashcards fc
LEFT JOIN card_logs cl ON fc.id = cl.card_id
WHERE fc.deck_id = ?
GROUP BY fc.id
HAVING failure_rate >= 60
ORDER BY failure_rate DESC;
```

---

## 🔐 Consideraciones de Seguridad

1. **Validación de entrada**: Todos los campos JSON se validan con `zod`
2. **Autenticación JWT**: Todos los endpoints requieren token
3. **Rate limiting**: Máximo 100 requests por 15 min
4. **CORS**: Configurado para dominios permitidos
5. **SQL Injection**: Uso de prepared statements
6. **Cifrado de contraseñas**: bcrypt con salt rounds = 10

---

## 📚 Conclusión

El sistema de Flashcards de Threshold es una implementación educativa completa que combina:
- ✅ **IA generativa** (Gemini/Groq) para creación automática
- ✅ **Polimorfismo de tipos** (Flashcard/ECAES/V-F)
- ✅ **Repetición espaciada inteligente** (SM-2 + FSRS)
- ✅ **Análisis académico** de dificultad y rendimiento
- ✅ **Colaboración** mediante compartición de mazos
- ✅ **Offline-first** con sincronización automática

Todo esto se integra en una arquitectura escalable backend-frontend con soporte para SQLite y PostgreSQL.

---

**Documento generado**: 20 de Mayo de 2026  
**Versión del Sistema**: 1.0  
**Último Update**: Integración FSRS + Estrategia Polimórfica

