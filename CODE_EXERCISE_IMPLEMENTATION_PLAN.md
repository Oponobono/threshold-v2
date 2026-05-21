# PLAN DE IMPLEMENTACIÓN: IDE EMBEBIDO

## Integración de Ejercicios de Código Interactivos en Threshold

Especificación técnica completa y alineada con la arquitectura polimórfica actual de **Threshold**. Este documento detalla la implementación de un sistema de ejercicios de código (fill-in-the-blank, debugging, multiple-choice) manteniendo la coherencia arquitectónica, seguridad backend y UX móvil optimizada.

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura de Datos](#arquitectura-de-datos)
3. [Esquema Completo de code_exercise](#esquema-completo-de-code_exercise)
4. [Backend: Validación y Seguridad](#backend-validación-y-seguridad)
5. [Estrategia de Evaluación (Motor SM-2/FSRS)](#estrategia-de-evaluación-motor-sm2fsrs)
6. [Frontend: Componentes y UX](#frontend-componentes-y-ux)
7. [Generación Automática con IA](#generación-automática-con-ia)
8. [Plan de Validación de Código](#plan-de-validación-de-código)
9. [Cronograma Realista](#cronograma-realista)
10. [Base de Datos: Extensiones Mínimas](#base-de-datos-extensiones-mínimas)
11. [Fase 5: Academic Workflow Engine](#fase-5-academic-workflow-engine-policies-layer)
12. [Fase 6: Transcript & Analytics Engine](#fase-6-transcript--analytics-engine)

---

## Visión General

### Objetivo

Integrar **ejercicios interactivos de código** dentro del sistema polimórfico de flashcards, permitiendo que estudiantes resuelvan problemas de programación en contexto de estudio, con evaluación automática y seguimiento de progreso mediante FSRS/SM-2.

### Tipo de Ejercicio (MVP)

**`item_type: 'code_exercise'`** con subtipo `exerciseType`:
- `'fillintheblank'` - Rellenar espacios (Ej: método `.filter` faltante)
- `'debugging'` - Identificar y corregir errores (Backlog)
- `'multiplechoicecode'` - Seleccionar opción correcta (Backlog)

### Alineación Arquitectónica

| Componente | Integración |
|-----------|------------|
| **Polimorfismo** | ✅ Nuevo `item_type` en tabla `flashcards.item_type` |
| **Validación** | ✅ Middleware Zod en `validatorMiddleware.js` |
| **Evaluación** | ✅ Nueva estrategia en `evaluationStrategies.ts` |
| **BD** | ✅ Zero cambios en schema (todo en `content_json`) |
| **Almacenamiento** | ✅ `card_logs` extendido con `errorType` |
| **Estética** | ✅ Mantiene tema general, solo código en fondo oscuro |

---

## Arquitectura de Datos

### Principio de Diseño: Polimorfismo Limpio

Se **rechaza explícitamente** agregar columnas SQL nuevas. Todo vive en `content_json`:

```sql
-- NO se hace esto:
ALTER TABLE flashcards ADD COLUMN code_language TEXT;
ALTER TABLE flashcards ADD COLUMN code_content TEXT;

-- Se hace esto (ya existe):
UPDATE flashcards 
SET content_json = '{"type":"code_exercise", "language":"javascript", ...}'
WHERE item_type = 'code_exercise';
```

### Por Qué: Razones Técnicas

1. **Polimorfismo**: Ya está implementado (flashcard/multiple_choice/boolean)
2. **Escalabilidad**: Futuros tipos (video_question, image_labeling) sin cambios schema
3. **Integridad**: Validación centralizada en middleware
4. **Mantenibilidad**: Single source of truth en JSON

---

## Esquema Completo de code_exercise

### Estructura JSON Detallada

```json
{
  "type": "code_exercise",
  "language": "javascript",
  "exerciseType": "fillintheblank",
  
  "metadata": {
    "difficulty": "beginner",
    "topic": "array-methods",
    "estimatedTimeSeconds": 120,
    "learningOutcome": "Entender el uso de Array.filter()"
  },
  
  "markdownPrompt": "# Filtrar Números Pares\n\nCompleta la función de orden superior para filtrar números pares de un array.",
  
  "initialCode": "const filterPairs = (arr) => {\n  return arr.{{blank1}}((num) => num % 2 === 0);\n};",
  
  "solutionCode": "const filterPairs = (arr) => {\n  return arr.filter((num) => num % 2 === 0);\n};",
  
  "blanks": [
    {
      "id": "blank1",
      "correctAnswer": "filter",
      "alternatives": ["filter"],
      "hint": "Método nativo de Arrays que crea una copia filtrada de elementos que cumplen una condición.",
      "errorAnalysis": {
        "commonMistakes": ["map", "find", "forEach", "some", "every"],
        "acceptableSyntax": [
          "filter",
          ".filter",
          ".filter( )",
          "filter( )"
        ]
      }
    }
  ],
  
  "explanation": "El método **Array.filter()** recorre cada elemento del array y retorna un nuevo array con solo los elementos que cumplen la condición booleana especificada. En este caso, filtra números pares (num % 2 === 0). Alternativas incorrectas: map() transforma elementos, find() retorna un solo elemento, forEach() itera sin retornar nada.",
  
  "testCases": [
    {
      "input": "[1, 2, 3, 4, 5, 6]",
      "expectedOutput": "[2, 4, 6]",
      "description": "Array con números 1-6"
    },
    {
      "input": "[10, 15, 20]",
      "expectedOutput": "[10, 20]",
      "description": "Array con números pares e impares"
    },
    {
      "input": "[]",
      "expectedOutput": "[]",
      "description": "Array vacío"
    }
  ]
}
```

### Mapeo a Tabla flashcards

```javascript
// Cómo se guarda en BD:
{
  id: 123,
  deck_id: 45,
  item_type: 'code_exercise',
  content_json: '{ "type": "code_exercise", "language": "javascript", ... }',
  hint: null,  // Opcional: se puede usar o rellenar desde JSON
  explanation: null,  // Se toma de content_json.explanation
  status: 'new',
  next_review_date: '2026-05-27',
  fsrs_stability: 1,
  fsrs_difficulty: 0.5,
  ...otros campos SM-2/FSRS...
}
```

---

## Backend: Validación y Seguridad

### Esquema Zod (Middleware)

**Ubicación**: `backend/middlewares/validatorMiddleware.js`

```javascript
const { z } = require('zod');

// Esquema para blancos individuales
const codeBlankSchema = z.object({
  id: z.string().min(1),
  correctAnswer: z.string().min(1).max(200),
  alternatives: z.array(z.string()).optional(),
  hint: z.string().max(500).optional(),
  errorAnalysis: z.object({
    commonMistakes: z.array(z.string()).optional(),
    acceptableSyntax: z.array(z.string()).optional()
  }).optional()
});

// Esquema para ejercicio de código
const codeExerciseSchema = z.object({
  type: z.literal('code_exercise'),
  language: z.enum([
    'javascript',
    'python',
    'java',
    'cpp',
    'sql',
    'html',
    'css'
  ]),
  exerciseType: z.enum(['fillintheblank', 'debugging', 'multiplechoicecode']),
  
  metadata: z.object({
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    topic: z.string().max(100).optional(),
    estimatedTimeSeconds: z.number().min(10).max(600).optional(),
    learningOutcome: z.string().max(500).optional()
  }).optional(),
  
  markdownPrompt: z.string().min(5).max(1000),
  initialCode: z.string().min(5).max(10000),
  solutionCode: z.string().min(5).max(10000),
  
  blanks: z.array(codeBlankSchema).min(1),
  explanation: z.string().min(10).max(2000),
  
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    description: z.string().optional()
  })).optional()
});

// Esquema polimórfico global (existente + code_exercise)
const createItemSchema = z.object({
  item_type: z.enum(['flashcard', 'multiple_choice', 'boolean', 'code_exercise']),
  content_json: z.union([
    z.string(),
    codeExerciseSchema
  ]),
  hint: z.string().optional(),
  explanation: z.string().optional()
});

module.exports = {
  codeExerciseSchema,
  createItemSchema
};
```

### Middleware Interceptor

**Ubicación**: `backend/middlewares/validatorMiddleware.js`

```javascript
const { codeExerciseSchema, createItemSchema } = require('./schemas');

exports.validateNewItem = (req, res, next) => {
  try {
    // Parsear JSON si viene como string
    if (typeof req.body.content_json === 'string') {
      req.body.content_json = JSON.parse(req.body.content_json);
    }

    // Validación global
    const validated = createItemSchema.parse(req.body);

    // Si es code_exercise, validación adicional
    if (validated.item_type === 'code_exercise') {
      // Verificar que todos los {{blankX}} en initialCode están en blanks
      const placeholders = validated.content_json.initialCode.match(/{{(\w+)}}/g) || [];
      const blankIds = new Set(validated.content_json.blanks.map(b => b.id));

      placeholders.forEach(ph => {
        const id = ph.replace(/{{|}}/g, '');
        if (!blankIds.has(id)) {
          throw new Error(`Placeholder ${ph} no tiene definición en blanks`);
        }
      });

      // Verificar que solutionCode no tiene placeholders
      if (/{{/.test(validated.content_json.solutionCode)) {
        throw new Error('solutionCode no debe contener placeholders');
      }
    }

    // Pasar objeto validado al siguiente middleware
    req.validatedItem = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validación fallida',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }
    return res.status(400).json({
      error: 'JSON malformado o lógica inválida',
      message: error.message
    });
  }
};
```

### Integración en Rutas

**Ubicación**: `backend/routes/flashcards.js`

```javascript
const { validateNewItem } = require('../middlewares/validatorMiddleware');

// Crear ítem (existente, pero con validación mejorada)
router.post('/flashcard-decks/:deckId/items',
  validateNewItem,  // Middleware de validación
  flashcardsController.createEvaluationItem
);
```

---

## Estrategia de Evaluación (Motor SM-2/FSRS)

### Nueva Estrategia: CodeExerciseStrategy

**Ubicación**: `mobile/src/utils/evaluationStrategies.ts`

```typescript
/**
 * CodeExerciseStrategy
 * 
 * Estrategia para ejercicios de código con análisis de tipo de error.
 * - Error sintáctico: Penalización leve (usuario entiende la lógica)
 * - Error lógico: Penalización severa (deficiencia conceptual)
 * - Correcto: Refuerzo positivo
 */
export class CodeExerciseStrategy implements EvaluationStrategy {
  readonly requiresReveal = false;

  /**
   * Evalúa la respuesta del usuario contra la solución correcta
   */
  evaluate(
    item: EvaluationItem,
    answer: string,  // Respuesta del usuario
    responseTimeMs: number
  ): EvaluationResult {
    const content = item.content as CodeExerciseContent;
    
    // Análisis del tipo de error
    const errorAnalysis = this.analyzeAnswer(answer, content);
    
    // Mapear error a calidad SM-2 (0-5)
    const quality = this.mapErrorToQuality(errorAnalysis);

    return {
      itemId: item.id,
      itemType: 'code_exercise',
      passed: errorAnalysis.isCorrect,
      responseTimeMs,
      selectedAnswer: answer,
      
      // Extensión específica para código
      errorType: errorAnalysis.errorType,  // 'syntax' | 'logic' | 'correct'
      quality,  // Para SM-2
      correctAnswer: content.blanks?.[0]?.correctAnswer,
      hint: errorAnalysis.shouldShowHint ? content.blanks?.[0]?.hint : null
    };
  }

  /**
   * Mapear tipo de error a calidad SM-2
   * 
   * quality=5: Perfecto
   * quality=4: Respuesta correcta pero tiempo alto (>20s)
   * quality=3: Error sintáctico menor (el concepto está correcto)
   * quality=2: Error lógico (concepto incorrecto, pero estructuralmente válido)
   * quality=1: Error mayor o respuesta completamente incorrecta
   */
  private mapErrorToQuality(analysis: ErrorAnalysis): number {
    if (analysis.isCorrect) {
      // Tiempo rápido (<3s) = perfección
      return analysis.responseTimeMs < 3000 ? 5 : 4;
    }

    if (analysis.errorType === 'syntax') {
      // Error sintáctico: usuario comprende la lógica
      return 3;
    }

    if (analysis.errorType === 'logic') {
      // Error lógico: deficiencia conceptual profunda
      return 1;
    }

    return 1;
  }

  /**
   * Analizar respuesta del usuario contra soluciones posibles
   */
  private analyzeAnswer(userAnswer: string, content: CodeExerciseContent): ErrorAnalysis {
    const blank = content.blanks?.[0];
    if (!blank) return { isCorrect: false, errorType: 'logic' };

    const userTrimmed = userAnswer.trim();
    const correctAnswer = blank.correctAnswer.trim();

    // 1. Verificar exactitud directa
    if (userTrimmed === correctAnswer) {
      return {
        isCorrect: true,
        errorType: 'correct',
        shouldShowHint: false
      };
    }

    // 2. Verificar sintaxis aceptable (del array acceptableSyntax)
    const acceptableSyntax = blank.errorAnalysis?.acceptableSyntax || [];
    const isAcceptableSyntax = acceptableSyntax.some(syntax => {
      // Normalizar espacios
      return userTrimmed.replace(/\s+/g, '') === syntax.replace(/\s+/g, '');
    });

    if (isAcceptableSyntax) {
      return {
        isCorrect: true,
        errorType: 'syntax',  // Sintaxis válida pero no exacta
        shouldShowHint: false
      };
    }

    // 3. Detectar error lógico (opción común incorrecta)
    const commonMistakes = blank.errorAnalysis?.commonMistakes || [];
    const isCommonMistake = commonMistakes.some(mistake =>
      userTrimmed.toLowerCase().includes(mistake.toLowerCase())
    );

    if (isCommonMistake) {
      return {
        isCorrect: false,
        errorType: 'logic',
        isCommonMistake: true,
        shouldShowHint: true
      };
    }

    // 4. Error desconocido
    return {
      isCorrect: false,
      errorType: 'logic',
      isCommonMistake: false,
      shouldShowHint: true
    };
  }

  /**
   * Obtener nuevo estado basado en resultado
   */
  getStatusUpdate(result: EvaluationResult): 'learning' | 'review' {
    if (result.passed) return 'review';
    return 'learning';
  }
}

// Tipos auxiliares
interface ErrorAnalysis {
  isCorrect: boolean;
  errorType: 'syntax' | 'logic' | 'correct';
  isCommonMistake?: boolean;
  shouldShowHint?: boolean;
}

interface CodeExerciseContent {
  language: string;
  exerciseType: string;
  markdownPrompt: string;
  initialCode: string;
  solutionCode: string;
  blanks?: Array<{
    id: string;
    correctAnswer: string;
    hint?: string;
    errorAnalysis?: {
      commonMistakes?: string[];
      acceptableSyntax?: string[];
    };
  }>;
  explanation: string;
}
```

### Integración con StrategyFactory

**Ubicación**: `mobile/src/utils/evaluationStrategies.ts` (existente)

```typescript
export const StrategyFactory = {
  getStrategy(type: EvaluationItemType): EvaluationStrategy {
    switch (type) {
      case 'flashcard':       return new FlashcardStrategy();
      case 'multiple_choice': return new MultipleChoiceStrategy();
      case 'boolean':         return new BooleanStrategy();
      case 'code_exercise':   return new CodeExerciseStrategy();  // ← NUEVO
      default:                return new FlashcardStrategy();
    }
  },
};
```

### Impacto en card_logs

**Ubicación**: `backend/database/schema.js` (extensión de columna existente)

```javascript
// Columna ya existe: difficulty_deduced
// Se expande en significado para code_exercise:

card_logs: {
  columns: [
    { name: 'difficulty_deduced', type: 'VARCHAR(20)' },
    // Valores actuales: 'immediate', 'easy', 'moderate', 'difficult'
    // Nuevos para code_exercise: 'syntax_error', 'logic_error', 'correct'
  ]
}

// Registro de intento de código:
{
  card_id: 123,
  user_id: 456,
  result: 'incorrect',  // 'correct' o 'incorrect'
  response_time_ms: 8500,
  difficulty_deduced: 'logic_error',  // Nuevo valor
  normalized_time_ms: 8500,
  text_length_words: 15,
  timestamp: '2026-05-20 14:30:00'
}
```

---

## Frontend: Componentes y UX

### Principio de Estética

> **Solo el editor de código tiene fondo oscuro (#1E1E1E).** El resto de la UI mantiene la estética general de Threshold (colores, tipografía, espaciado).

```
┌─────────────────────────────────────────┐
│ Prompt (Fondo claro, tipografía normal) │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Editor de código - FONDO OSCURO     │ │ ← Solo aquí
│ │ const filterPairs = (arr) => {      │ │
│ │   return arr.[___Select___](...);   │ │
│ │ };                                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│ Panel de opciones (Fondo claro)         │
│ [filter] [map] [find] [forEach]         │
├─────────────────────────────────────────┤
│ [? Pista] (Colapsable)                  │
├─────────────────────────────────────────┤
│ [Verificar Respuesta]                   │
└─────────────────────────────────────────┘
```

### Componente Principal: CodeExerciseDisplay

**Ubicación**: `mobile/src/components/CodeExerciseDisplay.tsx`

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { CodeExerciseContent, EvaluationItem } from '../services/api/types';
import { StrategyFactory } from '../utils/evaluationStrategies';
import { SyntaxHighlighter } from '../components/SyntaxHighlighter';
import { BlankSelector } from './BlankSelector';
import { CollapsibleHint } from './CollapsibleHint';

interface CodeExerciseDisplayProps {
  item: EvaluationItem;
  onAnswer: (result: any) => void;
  onSkip: () => void;
}

export const CodeExerciseDisplay: React.FC<CodeExerciseDisplayProps> = ({
  item,
  onAnswer,
  onSkip,
}) => {
  const { t } = useTranslation();
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedbackShown, setFeedbackShown] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);

  const content = item.content as CodeExerciseContent;
  const strategy = StrategyFactory.getStrategy(item.item_type);
  const startTime = Date.now();

  /**
   * Renderizar código con espacios en blanco interactivos
   */
  const renderCodeWithInteractiveGaps = () => {
    let renderedCode = content.initialCode;

    // Reemplazar {{blank1}}, {{blank2}}, etc. con componentes interactivos
    content.blanks?.forEach(blank => {
      const selectedValue = selectedAnswers[blank.id] || '';
      const displayText = selectedValue || `[${t('common.selectOption')}]`;

      renderedCode = renderedCode.replace(
        new RegExp(`{{${blank.id}}}`, 'g'),
        `【${displayText}】`  // Marcador especial para UI
      );
    });

    return renderedCode;
  };

  /**
   * Manejar selección de respuesta
   */
  const handleSelectAnswer = (blankId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [blankId]: answer
    }));
  };

  /**
   * Verificar respuesta
   */
  const handleVerify = async () => {
    setIsVerifying(true);
    const responseTime = Date.now() - startTime;

    // Obtener respuesta del usuario (primer blank)
    const firstBlankId = content.blanks?.[0]?.id;
    const userAnswer = selectedAnswers[firstBlankId] || '';

    // Evaluar con estrategia
    const result = strategy.evaluate(item, userAnswer, responseTime);

    setFeedback(result);
    setFeedbackShown(true);
    setIsVerifying(false);

    // Enviar resultado al servidor después de mostrar feedback
    setTimeout(() => {
      onAnswer(result);
    }, 2000);
  };

  /**
   * UI de Feedback
   */
  if (feedbackShown) {
    const isCorrect = feedback.passed;
    return (
      <View style={styles.feedbackContainer}>
        <View style={[
          styles.feedbackCard,
          { backgroundColor: isCorrect ? '#C8E6C9' : '#FFCDD2' }
        ]}>
          <Ionicons
            name={isCorrect ? 'checkmark-circle' : 'close-circle'}
            size={48}
            color={isCorrect ? '#2E7D32' : '#C62828'}
            style={styles.feedbackIcon}
          />
          <Text style={[
            styles.feedbackText,
            { color: isCorrect ? '#1B5E20' : '#B71C1C' }
          ]}>
            {isCorrect ? t('common.correct') : t('common.incorrect')}
          </Text>

          {!isCorrect && feedback.errorType === 'logic' && (
            <Text style={styles.errorExplanation}>
              {t('code.logicError')}: Revisión de concepto necesaria
            </Text>
          )}

          {!isCorrect && feedback.errorType === 'syntax' && (
            <Text style={styles.errorExplanation}>
              {t('code.syntaxError')}: Sintaxis correcta pero incompleta
            </Text>
          )}
        </View>

        {/* Mostrar explicación magistral */}
        <View style={styles.explanationCard}>
          <Text style={styles.explanationTitle}>{t('common.explanation')}</Text>
          <Text style={styles.explanationText}>{content.explanation}</Text>
        </View>

        {/* Botones de siguiente */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.nextButton} onPress={onSkip}>
            <Text style={styles.nextButtonText}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /**
   * UI Principal
   */
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Prompt */}
      <View style={styles.promptSection}>
        <Text style={styles.promptText}>{content.markdownPrompt}</Text>
      </View>

      {/* Editor de código (FONDO OSCURO AQUÍ) */}
      <View style={styles.codeEditorContainer}>
        <SyntaxHighlighter
          code={renderCodeWithInteractiveGaps()}
          language={content.language}
          theme="dark"  // ← ÚNICO LUGAR CON FONDO OSCURO
          readOnly={false}
        />
      </View>

      {/* Selectores de respuesta para cada blank */}
      <View style={styles.selectorsContainer}>
        {content.blanks?.map((blank, index) => (
          <BlankSelector
            key={blank.id}
            blankId={blank.id}
            blank={blank}
            selected={selectedAnswers[blank.id]}
            onSelect={(answer) => handleSelectAnswer(blank.id, answer)}
            isFirst={index === 0}
          />
        ))}
      </View>

      {/* Pista Colapsable */}
      {content.blanks?.[0]?.hint && (
        <CollapsibleHint hint={content.blanks[0].hint} />
      )}

      {/* Botón Verificar */}
      <TouchableOpacity
        style={[styles.verifyButton, isVerifying && styles.verifyButtonDisabled]}
        onPress={handleVerify}
        disabled={!selectedAnswers[content.blanks?.[0]?.id || ''] || isVerifying}
        activeOpacity={0.7}
      >
        <Text style={styles.verifyButtonText}>
          {isVerifying ? t('common.verifying') : t('code.checkAnswer')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  promptSection: {
    marginBottom: 20,
  },
  promptText: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  codeEditorContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',  // ← FONDO OSCURO DEL EDITOR
    borderWidth: 1,
    borderColor: '#333333',
  },
  selectorsContainer: {
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  feedbackCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  feedbackIcon: {
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorExplanation: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  explanationCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.text.secondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  nextButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Componente: BlankSelector

**Ubicación**: `mobile/src/components/BlankSelector.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface BlankSelectorProps {
  blankId: string;
  blank: any;
  selected: string | undefined;
  onSelect: (answer: string) => void;
  isFirst?: boolean;
}

export const BlankSelector: React.FC<BlankSelectorProps> = ({
  blankId,
  blank,
  selected,
  onSelect,
  isFirst,
}) => {
  const [showOptions, setShowOptions] = useState(false);

  // Opciones: correctAnswer + commonMistakes
  const options = [
    blank.correctAnswer,
    ...(blank.errorAnalysis?.commonMistakes || []),
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Opción para: {blankId}</Text>

      {/* Botón selector */}
      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => setShowOptions(true)}
      >
        <Text style={[
          styles.selectButtonText,
          selected && styles.selectedText
        ]}>
          {selected || 'Seleccionar opción'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={theme.colors.primary} />
      </TouchableOpacity>

      {/* Modal de opciones (Chips en grilla) */}
      <Modal
        visible={showOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar respuesta</Text>
              <TouchableOpacity onPress={() => setShowOptions(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsGrid}>
              {options.map((option, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.optionChip,
                    selected === option && styles.optionChipSelected,
                  ]}
                  onPress={() => {
                    onSelect(option);
                    setShowOptions(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      selected === option && styles.optionChipTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                  {selected === option && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectButtonText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  selectedText: {
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  optionsGrid: {
    flexDirection: 'column',
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionChipText: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
```

### Componente: CollapsibleHint

**Ubicación**: `mobile/src/components/CollapsibleHint.tsx`

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface CollapsibleHintProps {
  hint: string;
}

export const CollapsibleHint: React.FC<CollapsibleHintProps> = ({ hint }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggleExpand}>
        <View style={styles.headerContent}>
          <Ionicons name="lightbulb" size={20} color={theme.colors.warning} />
          <Text style={styles.headerText}>Pista</Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.text.secondary}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  content: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.text.secondary,
  },
});
```

---

## Generación Automática con IA

### Prompt Especializado para Ejercicios de Código

**Ubicación**: `backend/utils/academicPromptBuilder.js` (nueva sección)

```javascript
/**
 * Construir prompt especializado para generar ejercicios de código
 */
function buildCodeExercisePrompt(topic, language, difficulty, count = 5) {
  const difficultyDesc = {
    beginner: 'principiante (1-2 líneas, conceptos básicos)',
    intermediate: 'intermedio (3-5 líneas, métodos y lógica condicional)',
    advanced: 'avanzado (5-10 líneas, estructuras de datos y funciones)',
  };

  return `
═══════════════════════════════════════════════════════════════════════════════
GENERAR EJERCICIOS DE CÓDIGO - RELLENAR ESPACIOS
═══════════════════════════════════════════════════════════════════════════════

Tema: ${topic}
Lenguaje: ${language}
Nivel: ${difficultyDesc[difficulty]}
Cantidad: ${count} ejercicios

REQUISITOS OBLIGATORIOS:
✅ FORMATO JSON VÁLIDO - Un array de objetos
✅ CADA ejercicio tiene: type, language, exerciseType, markdownPrompt, initialCode, solutionCode, blanks, explanation
✅ initialCode contiene EXACTAMENTE UN {{blank1}}, {{blank2}}, etc.
✅ solutionCode NO contiene placeholders (es el código perfecto sin {{...}})
✅ Cada blank tiene: id, correctAnswer, alternatives, hint, errorAnalysis
✅ commonMistakes son ERRORES REALES que cometen estudiantes de este nivel
✅ acceptableSyntax incluye variaciones válidas (ej: ".filter", "filter( )")
✅ Explicación es magistral (80-150 palabras) que enseña el concepto

ESTRUCTURA EXACTA DEL JSON:
[
  {
    "type": "code_exercise",
    "language": "${language}",
    "exerciseType": "fillintheblank",
    "metadata": {
      "difficulty": "${difficulty}",
      "topic": "${topic}",
      "estimatedTimeSeconds": 120,
      "learningOutcome": "Entender [concepto específico]"
    },
    "markdownPrompt": "Completa la función para [descripción]. No uses [método incorrecto].",
    "initialCode": "const nombreFunc = (params) => {\\n  return {{blank1}};\\n};",
    "solutionCode": "const nombreFunc = (params) => {\\n  return metodoCorrect(x);\\n};",
    "blanks": [
      {
        "id": "blank1",
        "correctAnswer": "metodoCorrect(x)",
        "alternatives": ["metodoCorrect(x)"],
        "hint": "Considera que necesitas [descripción sin revelar].",
        "errorAnalysis": {
          "commonMistakes": ["metodoIncorrect", "otraOpcion", "errorComun"],
          "acceptableSyntax": ["metodoCorrect(x)", "metodoCorrect( x )", ".metodoCorrect(x)"]
        }
      }
    ],
    "explanation": "El método metodoCorrect() hace [qué]. En este caso aplicamos [por qué]. Alternativas incorrectas: metodoIncorrect() hace [qué incorrecto]."
  }
]

VALIDACIÓN:
- Cada initialCode es código VÁLIDO en ${language} (excepto el placeholder)
- solutionCode es código EJECUTABLE en ${language}
- Sin ambigüedad: un solo {{blankX}} por ejercicio
- Cada commonMistake es un error genuino (no adivinanza)

RESPONDE SOLO EL ARRAY JSON. CERO TEXTO ADICIONAL.
═══════════════════════════════════════════════════════════════════════════════
`;
}

module.exports = {
  buildCodeExercisePrompt,
  // ... otros exports existentes
};
```

### Controlador de Generación

**Ubicación**: `backend/controllers/aiController.js` (nueva función)

```javascript
/**
 * Generar ejercicios de código usando LLM (Gemini → Fallback Groq)
 */
exports.generateCodeExercises = async (req, res) => {
  const {
    topic,
    language = 'javascript',
    difficulty = 'beginner',
    count = 5,
    subject_id,
    user_id,
  } = req.body;

  if (!topic || !subject_id || !user_id) {
    return res.status(400).json({
      error: 'Faltan campos: topic, subject_id, user_id',
    });
  }

  console.log(`[GenerateCodeExercises] topic=${topic}, lang=${language}, level=${difficulty}`);

  try {
    let exercises = [];
    let provider = '';

    // Intentar con Gemini
    if (secrets.GEMINI_API_KEY) {
      try {
        console.log('[GenerateCodeExercises] Intentando Gemini...');
        exercises = await geminiService.generateCodeExercisesFromText(
          topic,
          language,
          difficulty,
          count
        );
        provider = 'gemini';
        console.log(`[GenerateCodeExercises] ✅ Gemini: ${exercises.length} ejercicios`);
      } catch (err) {
        console.warn('[GenerateCodeExercises] ⚠️ Gemini falló:', err.message);
      }
    }

    // Fallback a Groq
    if (!exercises.length) {
      const groqApiKey = secrets.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({
          error: 'Ningún LLM disponible (Gemini y Groq desconfigurados)',
        });
      }
      console.log('[GenerateCodeExercises] Usando Groq...');
      exercises = await geminiService.generateCodeExercisesWithGroq(
        topic,
        language,
        difficulty,
        count
      );
      provider = 'groq';
      console.log(`[GenerateCodeExercises] ✅ Groq: ${exercises.length} ejercicios`);
    }

    res.json({
      success: true,
      provider,
      exercises,
      count: exercises.length,
      quality: 'academic',
    });
  } catch (err) {
    console.error('[GenerateCodeExercises] Error:', err.message);
    res.status(500).json({
      error: 'Error generando ejercicios de código',
      details: err.message,
    });
  }
};
```

### Ruta Agregada

**Ubicación**: `backend/routes/flashcards.js`

```javascript
/**
 * @swagger
 * /api/flashcard-decks/generate-code-exercises:
 *   post:
 *     summary: Generar ejercicios de código con IA
 *     tags: [Flashcards]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic:
 *                 type: string
 *                 example: "Array.filter() en JavaScript"
 *               language:
 *                 type: string
 *                 enum: [javascript, python, java, cpp, sql, html, css]
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *               count:
 *                 type: number
 *                 example: 5
 *               subject_id:
 *                 type: number
 *               user_id:
 *                 type: number
 */
router.post('/flashcard-decks/generate-code-exercises',
  validateNewItem,
  aiController.generateCodeExercises
);
```

---

## Plan de Validación de Código

### Estrategia de Validación (MVP)

Para el MVP, usamos **Pattern Matching** en el servidor, NO ejecución de código:

```javascript
/**
 * Validador de respuestas de código - Pattern Matching
 * 
 * Ubicación: backend/utils/codeValidator.js
 */

const normalizeCode = (code) => code
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

/**
 * Validar respuesta de ejercicio de código
 * @returns { isCorrect, quality, feedback }
 */
function validateCodeAnswer(userAnswer, blank) {
  const userNormalized = normalizeCode(userAnswer);
  const correctNormalized = normalizeCode(blank.correctAnswer);

  // 1. Exactitud directa
  if (userNormalized === correctNormalized) {
    return {
      isCorrect: true,
      quality: 5,
      feedback: 'Respuesta perfecta',
    };
  }

  // 2. Sintaxis aceptable
  const acceptableSyntax = blank.errorAnalysis?.acceptableSyntax || [];
  for (const syntax of acceptableSyntax) {
    if (userNormalized === normalizeCode(syntax)) {
      return {
        isCorrect: true,
        quality: 4,  // Sintaxis válida
        feedback: 'Sintaxis correcta, aunque no exacta',
      };
    }
  }

  // 3. Error común documentado
  const commonMistakes = blank.errorAnalysis?.commonMistakes || [];
  for (const mistake of commonMistakes) {
    if (userNormalized.includes(normalizeCode(mistake))) {
      return {
        isCorrect: false,
        quality: 2,  // Error lógico
        feedback: `Error: confundiste con ${mistake}. Revisa la pista.`,
        isCommonMistake: true,
      };
    }
  }

  // 4. Error desconocido
  return {
    isCorrect: false,
    quality: 1,
    feedback: 'Respuesta incorrecta. Lee la explicación.',
    isCommonMistake: false,
  };
}

module.exports = { validateCodeAnswer, normalizeCode };
```

### Roadmap: Ejecución Remota (Fase 2)

Para futuro, implementar sandbox seguro:

```javascript
/**
 * Concepto: Sandbox Docker para ejecución segura
 * 
 * Fase 2 - NOT MVP
 */

// Estructura propuesta:
// 1. User submits code → Backend validates schema
// 2. Backend spawns Docker container (timeout 5s)
// 3. Container ejecuta código + test cases
// 4. Captura stdout/stderr
// 5. Compara con expected output
// 6. Destruye container
// 7. Retorna resultado

// Seguridad:
// - Sin acceso a filesystem
// - Sin acceso a network
// - Timeout estricto
// - Resource limits (CPU, memoria)
```

---

## Cronograma Realista

### Fase 0: Preparación (2-3 días)

```
[ ] Definir schema JSON completo (1h)
[ ] Crear validaciones Zod (2-3h)
[ ] Configurar middlewares (1-2h)
[ ] Setup inicial en rama feature (1h)
───────────────────────────────
Total: 5-7 horas
```

### Fase 1: Backend (3-4 días)

```
[ ] Middleware de validación (2h)
[ ] CodeExerciseStrategy en evaluationStrategies.ts (3-4h)
[ ] Extender card_logs (1h)
[ ] Tests unitarios (2-3h)
[ ] Generación automática con prompts (2-3h)
[ ] Endpoint POST /generate-code-exercises (1h)
───────────────────────────────
Total: 11-14 horas
```

### Fase 2: Frontend (3-5 días)

```
[ ] CodeExerciseDisplay component (4-5h)
[ ] BlankSelector component (2-3h)
[ ] CollapsibleHint component (1-2h)
[ ] SyntaxHighlighter integración (1-2h)
[ ] Integración en FlashcardStudyScreen (2-3h)
[ ] Tests E2E (2-3h)
[ ] Ajustes de UX/estética (1-2h)
───────────────────────────────
Total: 13-20 horas
```

### Fase 3: Integración y Testing (2-3 días)

```
[ ] Tests de flujo end-to-end (3-4h)
[ ] Testing en dispositivo real (2-3h)
[ ] Optimización de performance (2-3h)
[ ] Documentación (1-2h)
[ ] Code review y ajustes (2-3h)
───────────────────────────────
Total: 10-15 horas
```

### Cronograma Total

```
Preparación:     1-2 días
Backend:         3-4 días
Frontend:        3-5 días
Integration:     2-3 días
───────────────────────────────
MVP:             9-14 días (~2 semanas)
```

**Dependencias clave**:
- Backend → Frontend (esperar schema estable)
- Schema validación → Middleware (no pueden ser paralelos)

---

## Base de Datos: Extensiones Mínimas

### ✅ NO Se Modifica

```sql
-- Tabla flashcards: SIN cambios
-- Tabla flashcard_decks: SIN cambios
-- Tabla card_logs: SIN cambios en estructura
```

### ✅ Extensión de Valores (NOT NULL)

```sql
-- card_logs.difficulty_deduced
-- Valores nuevos (sin alter):
'syntax_error'    -- Error sintáctico menor
'logic_error'     -- Error conceptual
'correct'         -- Respuesta correcta

-- Valores existentes (compatible):
'immediate'       -- <3s
'easy'            -- 3-8s
'moderate'        -- 8-15s
'difficult'       -- >15s
```

### ✅ Query de Análisis (Nuevo)

```sql
-- Detectar ejercicios de código problemáticos
SELECT 
  fc.id,
  fc.content_json ->> 'language' as language,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN cl.difficulty_deduced = 'logic_error' THEN 1 ELSE 0 END) as logic_errors,
  ROUND(100.0 * SUM(CASE WHEN cl.difficulty_deduced = 'logic_error' THEN 1 ELSE 0 END) / COUNT(*), 1) as logic_error_rate,
  SUM(CASE WHEN cl.difficulty_deduced = 'syntax_error' THEN 1 ELSE 0 END) as syntax_errors
FROM flashcards fc
LEFT JOIN card_logs cl ON fc.id = cl.card_id
WHERE fc.item_type = 'code_exercise'
GROUP BY fc.id
HAVING logic_error_rate >= 60
ORDER BY logic_error_rate DESC;
```

---

## Resumen Ejecutivo

| Aspecto | Decisión |
|---------|----------|
| **Tipo de Ítem** | `item_type: 'code_exercise'` (polimórfico) |
| **Almacenamiento** | `content_json` (zero schema changes) |
| **Validación** | Zod middleware + Backend-first |
| **Evaluación** | CodeExerciseStrategy (SM-2 compatible) |
| **Ejecución** | Pattern matching MVP (Sandbox fase 2) |
| **Estética** | Fondo oscuro SOLO en editor código |
| **IA** | Gemini → Groq fallback |
| **Cronograma** | 2 semanas MVP |
| **Seguridad** | Validación servidor, sin ejecución remota |

---

## Checklist de Implementación

### Backend
- [ ] Esquema Zod definido y tested
- [ ] Middleware de validación integrado
- [ ] CodeExerciseStrategy implementada
- [ ] card_logs extendido con errorType
- [ ] Prompts para generación automática
- [ ] Endpoints POST `/generate-code-exercises`
- [ ] Tests unitarios (80%+ coverage)

### Frontend
- [ ] CodeExerciseDisplay component
- [ ] BlankSelector component
- [ ] CollapsibleHint component
- [ ] Integración en FlashcardStudyScreen
- [ ] SyntaxHighlighter con tema oscuro (solo editor)
- [ ] Tests E2E
- [ ] Performance optimized

### Base de Datos
- [ ] Zero schema changes
- [ ] Query de análisis de problemas
- [ ] Backup pre-deploy

### Documentation
- [ ] README actualizado
- [ ] API docs (Swagger)
- [ ] Component docs (Storybook ready)
- [ ] Architecture decision record

---

**Versión**: 1.0  
**Última actualización**: 20 de Mayo de 2026  
**Estado**: Ready for Implementation
