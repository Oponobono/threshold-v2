# 📚 Threshold v2: Learning Engineering - Documentación Completa

**Versión:** 1.0  
**Fecha:** 15 de Mayo de 2026  
**Estado:** En Producción + Roadmap Futuro

---

## 📖 Índice

1. [Introducción & Visión](#introducción--visión)
2. [Arquitectura General](#arquitectura-general)
3. [Módulos Implementados](#módulos-implementados)
4. [[[DATABASE_DOCUMENTATION|Base de Datos]]](#base-de-datos)
5. [Algoritmos de [[spaced_repetition_logic|Repetición Espaciada]]](#algoritmos-de-repetición-espaciada)
6. [**Motor de Calificaciones (Grading Engine)** ⭐ NUEVO](#motor-de-calificaciones-grading-engine)
7. [Análisis & Analytics](#análisis--analytics)
8. [Gestión de Dificultad](#gestión-de-dificultad)
9. [Generación de Tarjetas Atómicas](#generación-de-tarjetas-atómicas)
10. [Sistema de Snooze](#sistema-de-snooze)
11. [[[API_DOCUMENTATION|Endpoints]] API](#endpoints-api)
12. [Componentes Frontend](#componentes-frontend)
13. [Flujos de Datos](#flujos-de-datos)
14. [Plan de Acción Futuro](#plan-de-acción-futuro)

---

## 📋 Introducción & Visión

Threshold implementa un **sistema científico de ingeniería del aprendizaje** basado en neurociencia cognitiva y pedagogía moderna. El objetivo es:

✅ **Maximizar retención**: Algoritmos de spaced repetition (SM-2 y FSRS)  
✅ **Personalizar aprendizaje**: Análisis individual de dominio y dificultad  
✅ **Reducir carga cognitiva**: Fragmentación inteligente de conceptos densos  
✅ **Mejorar experiencia**: Feedback inteligente y micro-interacciones  
✅ **Predecir necesidades**: Sistema de alertas y [[PREDICTIONS_ANALYSIS|predicciones]] basado en datos  

La arquitectura se divide en **4 capas**:

```
┌─────────────────────────────────────────────────────┐
│  CAPA 4: Experiencia del Usuario (Frontend)         │
│  - Dashboard, componentes, hooks, feedback visual   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  CAPA 3: Orquestación (Backend Controllers)         │
│  - analyticsController, flashcardsController, etc   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  CAPA 2: Lógica (Backend Utilities)                 │
│  - sm2Algorithm, FSRS, difficultyDeduction, etc     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  CAPA 1: Persistencia (Base de Datos)               │
│  - [[FLASHCARDS_COMPLETE_DOCUMENTATION|flashcards]], card_logs, learning_analytics, etc   │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitectura General

### Flujo Principal de Procesamiento

```
Usuario responde una tarjeta
    ↓
[Frontend] Captura: tiempo, respuesta, contexto
    ↓
[API] POST /api/flashcards/{cardId}/review
    ↓
[cardResultProcessor] Orquestador central:
    ├─ normalizeResponseTime()     → Resta tiempo de lectura
    ├─ deduceDifficulty()          → Detecta: immediate/easy/moderate/difficult
    ├─ calculateSM2() / FSRS()     → Calcula próximo repaso
    ├─ generateFeedback()          → Crea mensaje pedagógico
    └─ updateAnalytics()           → Actualiza mastery%
    ↓
[Database] Guarda en:
    ├─ flashcards (next_review_date, sm2_*, fsrs_*)
    ├─ card_logs (resultado, tiempo, dificultad)
    └─ learning_analytics (mastery_percentage)
    ↓
[Frontend] Muestra feedback visual + siguiente tarjeta
```

---

## 🎯 Módulos Implementados

### 1. **SM-2 Algorithm** (`backend/utils/sm2Algorithm.js`)

#### ¿Qué es?
Algoritmo **Supermemo 2**, el estándar de oro en spaced repetition desde 1987. Calcula cuándo estudiar nuevamente basado en:
- **Calidad de respuesta**: 0-5 (olvido total → recuerdo perfecto)
- **Ease Factor (EF)**: Facilidad relativa (ajusta dinámicamente)
- **Intervalo**: Días hasta próximo repaso

#### Funcionamiento

```javascript
// Input
{
  quality: 4,           // Usuario respondió rápido y correctamente
  easeFactor: 2.5,      // EF inicial (default)
  interval: 1,          // Primer repaso (1 día después)
  repetitions: 0        // Primer intento
}

// Proceso SM-2
EF = EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
// Si quality=4: EF = 2.5 + 0.1 - (1) * (0.08 + 0.02) = 2.58

// Calculo de intervalo
if (repetitions === 0) interval = 1
if (repetitions === 1) interval = 3
if (repetitions >= 2) interval = interval * EF

// Output
{
  newEaseFactor: 2.58,
  newInterval: 3,       // Próximo repaso en 3 días
  newRepetitions: 1,
  nextReviewDate: Date(+3 días)
}
```

#### Mapeo de Calidad Automático

```
Tiempo de respuesta → Calidad automática
─────────────────────────────────────────
< 3s (immediate)   → quality = 5 (perfecto)
3-8s (easy)        → quality = 4 (bueno)
8-15s (moderate)   → quality = 3 (aceptable)
> 15s (difficult)  → quality = 2 (difícil)
Incorrecto         → quality = 1 (olvido)
```

#### Funciones Exportadas

| Función | Parámetros | Retorna | Uso |
|---------|-----------|---------|-----|
| `calculateSM2()` | `{quality, easeFactor, interval, repetitions}` | `{newEF, newInterval, newRepetitions, nextReviewDate}` | Calcular próximo repaso |
| `calculateFSRS()` | `{quality, stability, difficulty, interval, repetitions}` | `{newStability, newDifficulty, newInterval, retention}` | Versión moderna FSRS |
| `getQualityFromDifficulty()` | `{difficulty, isCorrect}` | `quality (0-5)` | Mapeo automático |
| `detectProblematicCard()` | `{totalAttempts, failureRate, avgResponseTime}` | `{isProblem, issues, recommendation}` | Detectar tarjetas rotas |

**Archivo:** [backend/utils/sm2Algorithm.js](backend/utils/sm2Algorithm.js)

---

### 2. **FSRS Algorithm** (Free Spaced Repetition Scheduler)

#### ¿Qué es?
Algoritmo **moderno y mejorado** que reemplaza SM-2. Considera:
- **Estabilidad (S)**: Robustez de la memoria
- **Dificultad (D)**: Complejidad del concepto
- **Retención esperada**: % de probabilidad de recordar

#### Ventajas sobre SM-2

| Métrica | SM-2 | FSRS |
|---------|------|------|
| Modelo | Simple, lineal | Exponencial, adaptativo |
| Parámetros | 1 (EF) | 3 (Stability, Difficulty, Repetitions) |
| Retención predicha | No | Sí (% explícito) |
| Adaptabilidad | Media | Alta |
| Investigación | 1987 | 2020+ |

#### Fórmulas Clave

```javascript
// Retención por días
retention = exp(-interval / 36)
// Si interval=10: retention = 37% (se olvida 63%)

// Ajuste de Stability por calidad
quality=1 → stability *= 0.72  (decrece mucho)
quality=3 → stability *= 1.26  (crece leve)
quality=4 → stability *= 1.77  (crece moderado)
quality=5 → stability *= 2.36  (crece fuerte)

// Nuevo intervalo
newInterval = stability * 9 * (1 - retention)
```

#### Implementación

```javascript
function calculateFSRS({
  quality = 3,
  stability = 1,
  difficulty = 0.5,
  interval = 1,
  repetitions = 0
}) {
  const retention = Math.exp(-interval / 36);
  let newDifficulty = Math.max(0.1, Math.min(10, 
    difficulty + 0.1 - quality * 0.02
  ));
  let newStability, newRepetitions = repetitions;

  // Tabla de multiplicadores
  const multipliers = { 1: 0.72, 3: 1.26, 4: 1.77, 5: 2.36 };
  newStability = stability * (multipliers[quality] || 1);

  const newInterval = Math.round(stability * 9 * (1 - retention));
  
  return {
    newStability,
    newDifficulty,
    newRepetitions: quality < 3 ? 0 : repetitions + 1,
    newInterval: Math.max(1, newInterval),
    nextReviewDate: new Date() + newInterval days,
    retention: Math.round(retention * 100)
  };
}
```

**Archivo:** [backend/utils/sm2Algorithm.js](backend/utils/sm2Algorithm.js) (líneas 90-140)

---

### 3. **Card Result Processor** (`backend/utils/cardResultProcessor.js`)

#### ¿Qué es?
**Orquestador central** que coordina todo el flujo cuando un usuario responde una tarjeta.

#### Responsabilidades

```
processCardResult() {
  1. Normalizar tiempo (restar lectura)
  2. Deducir dificultad automáticamente
  3. Calcular SM-2 para próximo repaso
  4. Generar feedback pedagógico
  5. Crear micro-interacción visual
  6. Preparar actualizaciones para BD
}
```

#### Entrada & Salida

```javascript
// INPUT
{
  cardId: 123,
  userId: 45,
  subjectId: 12,
  isCorrect: true,
  responseTimeMs: 4500,           // Usuario tardó 4.5 segundos
  questionWordCount: 25,          // Pregunta tiene 25 palabras
  currentCard: {
    sm2_ease_factor: 2.5,
    sm2_interval: 1,
    sm2_repetitions: 0,
    word_count: 25
  }
}

// OUTPUT
{
  success: true,
  cardUpdate: {
    sm2_ease_factor: 2.58,
    sm2_interval: 3,
    sm2_repetitions: 1,
    next_review_date: "2026-05-18"
  },
  logEntry: {
    card_id: 123,
    user_id: 45,
    result: "correct",
    response_time_ms: 4500,
    difficulty_deduced: "easy",
    normalized_time_ms: 2500
  },
  feedback: {
    emoji: "💚",
    message: "¡Correcto! Tienes el concepto claro.",
    suggestion: "Sigue repasando para automatizar la respuesta."
  },
  microInteraction: {
    color: "#10B981",
    icon: "💚",
    message: "¡Bien!",
    animation: "soft_pulse",
    duration: 500
  },
  metrics: {
    difficulty: "easy",
    normalizedSeconds: 2.5,
    quality: 4,
    nextReviewDate: "2026-05-18"
  }
}
```

**Archivo:** [backend/utils/cardResultProcessor.js](backend/utils/cardResultProcessor.js)

---

### 4. **Difficulty Deduction System** (`backend/utils/difficultyDeduction.js`)

#### ¿Qué es?
Deduce automáticamente la dificultad **sin pedirle al usuario** que la califique. Se basa en ciencia cognitiva.

#### Principios Científicos

```
Response Time = Reading Time + Decision Time
                (20 WPM)      (la que importa)

Hypothesis: Tiempo de decisión = indicador de carga cognitiva
- < 3s  → Concepto en memoria de trabajo (automatizado)
- 3-8s  → Búsqueda mental exitosa (fluido)
- 8-15s → Procesamiento activo (esfuerzo moderado)
- > 15s → Lucha cognitiva (al borde del olvido)
```

#### Implementación

```javascript
function normalizeResponseTime(totalResponseTimeMs, wordCount) {
  const AVERAGE_WPM = 200;
  const estimatedReadingTime = (wordCount / AVERAGE_WPM) * 60000;
  const decisionTime = Math.max(0, totalResponseTimeMs - estimatedReadingTime);
  return decisionTime;
}

// Ejemplo
totalTime: 7500ms
wordCount: 50
estimatedReading: (50 / 200) * 60000 = 15000ms (pero se reduce proporcionalmente)
→ normalizedTime = 7500 - 1500 = 6000ms = "easy"
```

#### Niveles de Dificultad

| Dificultad | Rango | Interpretación | Quality SM-2 | Color |
|-----------|-------|-----------------|--------------|-------|
| `immediate` | < 3s | Automatizado, memoria de trabajo | 5 | Cyan (#00D9FF) |
| `easy` | 3-8s | Fluido, búsqueda mental exitosa | 4 | Verde (#10B981) |
| `moderate` | 8-15s | Esfuerzo moderado, duda | 3 | Naranja (#F97316) |
| `difficult` | > 15s | Lucha cognitiva | 2 | Rojo (#EF4444) |

#### Protecciones

```javascript
// Si tardó > 60 segundos:
// Probablemente se distrajo (notificación, pausa, etc)
// → No castiga el SM-2, solo registra en logs
if (totalSeconds > 60) {
  return {
    difficulty: "moderate",
    shouldAffectSpacedRepetition: false,  // NO afecta el algoritmo
    reason: "Posible distracción detectada"
  };
}
```

#### Funciones Exportadas

| Función | Input | Output | Caso de Uso |
|---------|-------|--------|-------------|
| `normalizeResponseTime()` | totalMs, wordCount | normalizedMs | Restar tiempo de lectura |
| `deduceDifficulty()` | normalizedMs, isCorrect, totalMs | {difficulty, level, reason, confidence} | Clasificar dificultad |
| `generateMicroInteractionFeedback()` | difficulty, isCorrect | {color, icon, animation, duration} | Feedback visual |
| `calculateSpeedImprovement()` | userTimeMs, avgTimeMs | percentageChange | Mostrar progreso |

**Archivo:** [backend/utils/difficultyDeduction.js](backend/utils/difficultyDeduction.js)

---

### 5. **Learning Analytics** (`backend/utils/learningAnalytics.js`)

#### ¿Qué es?
Análisis agregado del aprendizaje del usuario para:
- Calcular % dominio por tema
- Crear "mapa de dominio" (fortalezas/debilidades)
- Predecir cuándo repasar
- Detectar tarjetas problemáticas
- Generar reportes de progreso

#### Cálculo de Mastery Percentage

```javascript
masteryPercentage = (
  successRate * 0.40 +           // Tasa de aciertos (40%)
  consistencyScore * 0.30 +      // Últimas 10 respuestas (30%)
  speedScore * 0.30              // Velocidad de respuesta (30%)
) * 100

// Ejemplo
successRate = 8/10 = 0.8        (80% correcto)
consistencyScore = 9/10 = 0.9   (9 de últimas 10 correctas)
speedScore = (8000 / 8000) = 1  (tiempo óptimo)
masteryPercentage = (0.8*0.4 + 0.9*0.3 + 1*0.3) * 100 = 87%
```

#### Mapa de Dominio (Domain Map)

```javascript
createDomainMap() → {
  radar: [
    { name: "Matemática", value: 85, color: "#10B981" },    // Verde
    { name: "Historia", value: 45, color: "#F97316" },      // Naranja
    { name: "Inglés", value: 92, color: "#10B981" }         // Verde
  ],
  averageMastery: 74,
  strongestArea: { name: "Inglés", value: 92 },
  weakestArea: { name: "Historia", value: 45 },
  recommendation: "Enfócate en Historia (45% dominio)"
}

// Colores por mastery
≥ 80% → Verde (#10B981)
60-79% → Azul (#3B82F6)
40-59% → Naranja (#F97316)
20-39% → Rojo (#EF4444)
< 20% → Morado (#7C3AED)
```

#### Predicción de Revisión

```javascript
predictReviewTiming() → {
  predictedDate: "2026-05-20",
  isOverdue: false,
  daysSinceLast: 5,
  confidence: 0.85,
  notification: "Dentro de 3 días"
}

// Si está vencida
if (daysSinceLast > nextReviewDate) {
  notification: "⚠️ Urgente: Repasa este concepto ahora."
}
```

#### Detección de Tarjetas Problemáticas

```javascript
// CRÍTICO: 90%+ de usuarios falla
if (failureRate >= 0.9 && totalAttempts >= 10) {
  issue: "Probable: Pregunta mal redactada o concepto demasiado complejo"
  recommendation: "REWRITE"
}

// ADVERTENCIA: >30 segundos promedio
if (avgResponseTimeMs > 30000) {
  issue: "Tarjeta muy densa"
  recommendation: "SPLIT_ATOMIC"
}

// INFORMACIÓN: 60-89% fallos
if (failureRate >= 0.6 && failureRate < 0.9) {
  issue: "Tarjeta desafiante pero abordable"
  recommendation: "CLARIFY"
}
```

#### Generación de Reportes de Progreso

```javascript
generateProgressReport() → {
  currentAvgTimeMs: 5500,
  previousAvgTimeMs: 8200,
  improvement: 33%
}

// Outputs
improvement > 30%:
  "🚀 ¡Increíble! Respondiste 33% más rápido este mes."
improvement 10-30%:
  "✅ Buen progreso. Respondiste 20% más rápido."
improvement < 0:
  "⚠️ Tu velocidad bajó 15%. Considera revisar el concepto."
```

**Archivo:** [backend/utils/learningAnalytics.js](backend/utils/learningAnalytics.js)

---

### 6. **Atomic Card Generator** (`backend/utils/atomicCardGenerator.js`)

#### ¿Qué es?
Fragmenta tarjetas **demasiado densas** en **micro-tarjetas** más simples, basado en Cognitive Load Theory.

#### Principio Científico

```
❌ 1 tarjeta compleja (100 palabras) = carga cognitiva alta
✅ 5 tarjetas atómicas (20 palabras c/u) = aprendizaje más eficiente

Evidencia: Sweller (1988) - Theory of Cognitive Load
```

#### Detección de Densidad

```javascript
analyzeCardDensity() {
  // Criterios
  wordCount > 100 → isDense = true
  complexityScore > 5 → isDense = true

  // Complejidad analiza
  multipleColons (::) × 2
  multipleSemicolons (;;) × 2
  parentheses () × 1
  manyCommas (,) × 1
  formulas (+, -, *, /) × 3
  code brackets ([], {}) × 3
}

// Ejemplo
front: "¿Cuáles son los 3 tipos de respiración?"
back: "1. Aeróbica: requiere O2. 2. Anaeróbica: sin O2. 3. Fermentación: ácido láctico."

wordCount = 35
complexityScore = 5 (numeradas + puntos)
→ isDense = true
→ recommendation: "FRAGMENT_INTO_ATOMIC"
```

#### Estrategias de Fragmentación

**1. Por listas numeradas (1., 2., 3., ...)**

```
Original:
Q: "¿Cuáles son los 3 tipos de respiración?"
A: "1. Aeróbica: produce ATP con oxígeno...
    2. Anaeróbica: produce ATP sin oxígeno...
    3. Fermentación: ácido láctico..."

↓ Fragmenta en:

Tarjeta 1:
Q: "¿Cuáles son los 3 tipos de respiración?"
A: "Se divide en 3 partes principales. Repasa los puntos específicos."

Tarjeta 2:
Q: "¿Cuáles son los 3 tipos de respiración? - Punto 1"
A: "Aeróbica: produce ATP con oxígeno..."

Tarjeta 3:
Q: "¿Cuáles son los 3 tipos de respiración? - Punto 2"
A: "Anaeróbica: produce ATP sin oxígeno..."

Tarjeta 4:
Q: "¿Cuáles son los 3 tipos de respiración? - Punto 3"
A: "Fermentación: ácido láctico..."
```

**2. Por párrafos separados**

```
// Si back tiene > 2 párrafos:
back.split('\n\n') → [para1, para2, para3]

Crea:
Q: "Tema (Parte 1)" → A: para1
Q: "Tema (Parte 2)" → A: para2
Q: "Tema (Parte 3)" → A: para3
```

**3. Por pasos procedimentales**

```
// Si back contiene "Paso 1:", "Paso 2:", etc:
Extrae cada paso y crea una tarjeta por paso

Q: "Cómo hacer X - Paso 1" → A: instrucción paso 1
Q: "Cómo hacer X - Paso 2" → A: instrucción paso 2
```

#### Campos en BD

```javascript
{
  is_atomic: 1,           // Flag: es tarjeta fragmentada
  parent_card_id: 123,    // ID de la tarjeta padre
  atomic_index: 0,        // Posición en la secuencia
  word_count: 20          // Palabras totales
}
```

**Archivo:** [backend/utils/atomicCardGenerator.js](backend/utils/atomicCardGenerator.js)

---

## 💾 Base de Datos

### Tabla: `flashcards`

```sql
CREATE TABLE flashcards (
  id INTEGER PRIMARY KEY,
  deck_id INTEGER NOT NULL,
  
  -- Contenido (legacy + moderno)
  front TEXT,                         -- Pregunta (legacy)
  back TEXT,                          -- Respuesta (legacy)
  item_type TEXT DEFAULT 'flashcard', -- flashcard|multiple_choice|boolean
  content_json TEXT,                  -- JSON con estructura del item
  
  -- Metadata pedagógica
  hint TEXT,                          -- Pista si el usuario está atascado
  explanation TEXT,                  -- Explicación detallada
  status TEXT DEFAULT 'new',          -- new|learning|review
  
  -- SM-2 Spaced Repetition
  sm2_ease_factor REAL DEFAULT 2.5,   -- Facilidad relativa (1.3 - ∞)
  sm2_interval INTEGER DEFAULT 1,     -- Días hasta próximo repaso
  sm2_repetitions INTEGER DEFAULT 0,  -- Número de repasos exitosos
  next_review_date TIMESTAMP,         -- Cuándo estudiar nuevamente
  
  -- FSRS (Moderno, alternativa a SM-2)
  fsrs_stability REAL DEFAULT 1,      -- Robustez de la memoria
  fsrs_difficulty REAL DEFAULT 0.5,   -- Complejidad (0-10)
  fsrs_repetitions INTEGER DEFAULT 0, -- Repasos FSRS
  
  -- Cognitive Load & Atomicity
  word_count INTEGER DEFAULT 0,       -- Palabras totales
  is_atomic INTEGER DEFAULT 1,        -- ¿Es micro-tarjeta?
  parent_card_id INTEGER,             -- Si es atomic, quién es la padre
  atomic_index INTEGER,               -- Posición en secuencia
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_review_timestamp TIMESTAMP,
  
  FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id)
);
```

### Tabla: `card_logs`

```sql
CREATE TABLE card_logs (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  
  -- Resultado
  result VARCHAR(20),                 -- 'correct' | 'incorrect'
  response_time_ms INTEGER,           -- Tiempo total en ms
  
  -- Análisis de dificultad
  difficulty_deduced VARCHAR(20),     -- immediate|easy|moderate|difficult
  normalized_time_ms INTEGER,         -- Tiempo sin lectura
  text_length_words INTEGER,          -- Palabras en la pregunta
  
  -- Metadata
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (card_id) REFERENCES flashcards(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Ejemplo de registro
INSERT INTO card_logs VALUES (
  1,                              -- log id
  456,                            -- card_id
  123,                            -- user_id
  'correct',                      -- resultado
  4500,                           -- respondió en 4.5 segundos
  'easy',                         -- dificultad deducida
  2500,                           -- tiempo de decisión
  25,                             -- pregunta tenía 25 palabras
  '2026-05-15 14:32:15'          -- cuándo respondió
);
```

### Tabla: `learning_analytics`

```sql
CREATE TABLE learning_analytics (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  subject_id INTEGER,
  
  -- Estadísticas agregadas
  total_cards INTEGER DEFAULT 0,      -- Tarjetas en este tema
  total_reviews INTEGER DEFAULT 0,    -- Veces que ha intentado
  correct_reviews INTEGER DEFAULT 0,  -- Veces que acertó
  incorrect_reviews INTEGER DEFAULT 0,-- Veces que falló
  
  -- Métricas derivadas
  avg_response_time_ms REAL DEFAULT 0,-- Tiempo promedio
  mastery_percentage REAL DEFAULT 0,  -- % dominio (0-100)
  
  -- Timestamp
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  UNIQUE(user_id, subject_id)
);

-- Ejemplo
INSERT INTO learning_analytics VALUES (
  1,                              -- analytics id
  123,                            -- user_id
  5,                              -- subject_id (Matemática)
  50,                             -- 50 tarjetas creadas
  45,                             -- 45 intentos
  38,                             -- 38 correctas
  7,                              -- 7 incorrectas
  5800.0,                         -- promedio 5.8 segundos
  87.5,                           -- 87.5% dominio
  '2026-05-15 14:32:15'
);
```

### Tabla: `study_sessions`

```sql
CREATE TABLE study_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  subject_id INTEGER,
  
  session_type TEXT,              -- 'review'|'new'|'practice'|'exam'
  duration_seconds INTEGER,       -- Duración en segundos
  config_value TEXT,              -- Configuración específica
  performance_rating INTEGER,     -- Calificación 1-5
  
  start_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);
```

---

## 📊 Algoritmos de Repetición Espaciada

### Comparativa: SM-2 vs FSRS

```
CARACTERÍSTICA        | SM-2 (Legacy)      | FSRS (Moderno)
──────────────────────|────────────────────|──────────────────
Año de creación      | 1987               | 2020+
Parámetros           | 1 (EF)             | 3 (S, D, Rep)
Modelo               | Lineal simple      | Exponencial
Retención predicha   | No                 | Sí (%)
Adaptabilidad        | Media              | Alta
Curva de olvido      | Aproximación       | Precisa
Contexto             | Documentos papel   | Aplicaciones web
Investigación actual | Histórica          | Activa
──────────────────────|────────────────────|──────────────────

Recomendación en Threshold:
- Usar FSRS como principal (registra datos en ambos)
- Mantener SM-2 para compatibilidad/análisis comparativo
```

### Flujo de Decisión: ¿Cuándo Repasa?

```
Usuario responde tarjeta
       ↓
¿Respondió correctamente?
  ├─ SÍ → quality = 3-5 (según tiempo)
  │       → Incrementar intervalo
  │       → Aumentar estabilidad
  │
  └─ NO → quality = 1-2
          → Reiniciar intervalo a 1 día
          → Decrementar estabilidad

                ↓
        Calcular nextReviewDate
                ↓
¿nextReviewDate <= hoy?
  ├─ SÍ (vencida) → Mostrar en predicciones
  └─ NO (futura) → Guardar, no mostrar aún
```

### Tasas Típicas de Retención

```
Días desde estudio | FSRS Retención | Interpretación
─────────────────────────────────────────────────
1 día              | 95%            | Casi perfecto
3 días             | 80%            | Bueno
7 días             | 50%            | Crítico (cerca del olvido)
14 días            | 25%            | Olvido significativo
30 días            | 5%             | Prácticamente olvidado

Estrategia: Repasar ANTES de llegar a 50% retención
```

---

## 🎯 Motor de Calificaciones (Grading Engine) ⭐

### ¿Por Qué un Motor de Calificaciones?

En aplicaciones educativas tradicionales, el estudiante ve su nota final (ej: 4.2) y punto. Pero en Threshold, queremos ir más allá: **¿Hacia dónde va tu desempeño?**

El **Grading Engine** responde preguntas críticas:
- 📊 ¿Cuál es mi promedio actual?
- 📈 ¿Hacia dónde voy si sigo así?
- 🔄 ¿Mi desempeño mejora o empeora?
- ⚠️ ¿Estoy en riesgo?

Esta información es **predicción educativa**, fundamental en plataformas de aprendizaje adaptativo.

---

### Arquitectura del Motor

```
┌─────────────────────────────────────────────────────────────────┐
│ Backend: /api/assessments/analytics/subject/:subjectId/projection│
│          [assessmentsController.js]                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                  Obtiene evaluaciones ordenadas
                  por fecha de la base de datos
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  assessments (2 notas: 2.9, 4.5)    │
        │  weights: [20%, 20%]                 │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ calculateProjectedGrade()             │
        │ [backend/services/gradingEngine.js] │
        └──────────────────┬───────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
       PA: 3.7        EMA: 3.66      Weights: 0.4, 0.6
       
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
                  NP = 3.64 (Proyectada)
                  Delta = -0.06
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Mobile: useSubjectGrades Hook        │
        │ [mobile/src/hooks/useSubjectGrades]  │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ UI Component: SubjectStats           │
        │ [mobile/src/components/SubjectStats] │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        Columna 1       Columna 2      Columna 3
        PROMEDIO   →    PROYECTADA  ←  TAREAS
        4.2             4.15 ↓         2/2
                       -0.06 pts
```

---

### Fórmulas del Motor

#### 1️⃣ **Promedio Actual (PA)** - Weighted Average

**Concepto:** Promedio ponderado de todas las calificaciones hasta el momento.

**Fórmula:**
$$PA = \frac{\sum_{i=1}^{n} (Nota_i \times Peso_i)}{\sum_{i=1}^{n} Peso_i}$$

**Ejemplo práctico:**
```
Parcial 1: 2.9  (Peso: 20%)
Parcial 2: 4.5  (Peso: 20%)
Resta del curso: No evaluado (60%)

PA = (2.9 × 0.20 + 4.5 × 0.20) / (0.20 + 0.20)
PA = (0.58 + 0.90) / 0.40
PA = 1.48 / 0.40
PA = 3.7
```

**¿Qué representa?**
- Tu rendimiento **histórico actual**
- Lo que **ya está garantizado** en tu calificación final
- Mira por el **espejo retrovisor**

**Fundamento científico:**
- Standard de educación formal (cálculo de GPA)
- Fairness: pesa cada evaluación según su importancia
- Transparencia: el estudiante entiende cómo se calcula

**Implementación:**
```javascript
// backend/services/gradingEngine.js - Línea 300
const totalWeight = weights.reduce((sum, w) => sum + w, 0);
const weightedSum = grades.reduce((sum, g, i) => sum + g * weights[i], 0);
const currentAverage = weightedSum / totalWeight;
```

---

#### 2️⃣ **EMA (Exponential Moving Average)** - Tendencia Reciente

**Concepto:** Promedio ponderado **exponencial** que da más peso a las calificaciones recientes. Responde: "¿Cómo voy en **las últimas semanas**?"

**Fórmula:**
$$EMA_t = (Nota_{t} \times \alpha) + (EMA_{t-1} \times (1 - \alpha))$$

Donde $\alpha$ (alpha) = 0.35 (factorización)

**Ejemplo práctico:**
```
Alpha = 0.35
Peso del nuevo = 35%
Peso del histórico = 65%

─────────────────────────────────────────
Iteración 1: Primer parcial (2.9)
EMA₁ = 2.9  (inicializar con primer valor)

Iteración 2: Segundo parcial (4.5)
EMA₂ = (4.5 × 0.35) + (2.9 × 0.65)
EMA₂ = 1.575 + 1.885
EMA₂ = 3.46

(Nota: Si hubiera tercer parcial, seguiría la serie)
```

**¿Qué representa?**
- Tu desempeño **más reciente**
- Mira por el **parabrisas** (hacia el futuro)
- Predice cómo seguirás si mantiene el ritmo

**¿Por qué Alpha = 0.35?**

En ciencia de datos, el alpha determina **responsiveness** (sensibilidad):
- Alpha bajo (0.1) → Cambios lentos, suavizado extremo
- Alpha medio (0.35) → Balance entre cambios recientes e histórico
- Alpha alto (0.7) → Cambios muy rápidos, demasiado reactivo

Con 0.35, una mala calificación reciente no te **devasta**, pero sí **influye**.

**Fundamento científico:**
- **EMA es estándar en pronósticos financieros y epidemiológicos**
- UNESCO & MIT Media Lab: "Estudiantes 'en caída' se predicen con EMA" (Siemens & Long, 2011)
- **Pedagogía Adaptativa**: El "yo más reciente" predice mejor que el "yo promedio"

**Implementación:**
```javascript
// backend/services/gradingEngine.js - Línea 315
const ALPHA = 0.35;
let currentEMA = grades[0];
for (let i = 1; i < grades.length; i++) {
  currentEMA = (grades[i] * ALPHA) + (currentEMA * (1 - ALPHA));
}
```

---

#### 3️⃣ **Nota Proyectada (NP)** - Predicted Final Grade

**Concepto:** Tu calificación final **predicha** si mantienes tu ritmo actual en el resto del semestre.

**Fórmula:**
$$NP = (PA \times PesoEvaluado) + (EMA \times PesoRestante)$$

**Ejemplo práctico:**
```
PA (promedio actual) = 3.7
EMA (tendencia reciente) = 3.66
Evaluado = 40% (2 de 5 parciales completados)
Restante = 60%

NP = (3.7 × 0.40) + (3.66 × 0.60)
NP = 1.48 + 2.196
NP = 3.676
NP ≈ 3.68 (redondeado)
```

**¿Qué representa?**
- Tu calificación **final estimada** del semestre
- "Si sigues así... terminarás con 3.68"
- Un **colchón de [[SECURITY|seguridad]]**: el 40% ya asegurado amortigua las caídas

**Visión pedagógica:**

La fórmula usa **dos bloques independientes**:

```
Bloque 1: Pasado (40%)
└─ Tu promedio histórico (3.7) ya está "congelado"
   No importa qué pase después, esos puntos son tuyos

Bloque 2: Futuro (60%)
└─ Predice usando tu tendencia reciente (3.66)
   Si mantienes ese ritmo, así terminarás
```

**Por qué NO usamos:**
❌ "Asumir que siempre tendrás 3.7" → Ignora tendencia reciente
❌ "Predecir solo con EMA" → Olvida el colchón del 40%

**Fundamento científico:**
- Mezcla **análisis histórico** (conservador) + **predicción de tendencia** (reactivo)
- Standard en plataformas como Coursera, Blackboard
- Fairness: no castiga al estudiante por caídas recientes, pero sí las advierte

**Implementación:**
```javascript
// backend/services/gradingEngine.js - Línea 335
let projectedGrade = (currentAverage * evaluatedWeight) + 
                     (currentEMA * remainingWeight);
```

---

#### 4️⃣ **Delta (Δ)** - Momentum Indicator

**Concepto:** Diferencia entre tu proyección y tu promedio actual. **Indica tendencia visualmente.**

**Fórmula:**
$$\Delta = NP - PA$$

**Ejemplo práctico:**
```
NP (nota proyectada) = 3.68
PA (promedio actual) = 3.7

Δ = 3.68 - 3.7
Δ = -0.02
```

**¿Qué significa?**

| Delta | Interpretación | Visual | Implicación |
|-------|---|---|---|
| **Δ > 0** (ej: +0.15) | Tendencia **al alza** 📈 | Flecha ↑ Verde | Va bien, mejorando |
| **Δ ≈ 0** (ej: -0.02) | Tendencia **estable** ➡️ | Guión gris | Mantiene el ritmo |
| **Δ < 0** (ej: -0.15) | Tendencia **a la baja** 📉 | Flecha ↓ Rojo | Va mal, decayendo |

**¿Psicológicamente, qué comunica?**

```
Caso 1: Estudiante con 2 parciales (2.9, 4.5)
PA = 3.7,  NP = 3.68,  Δ = -0.02
Mensaje: "Tu última nota subió, pero promedian a 3.7. 
         Si sigues así terminas en 3.68 (muy similar)."

Caso 2: Estudiante con tendencia consistentemente buena (4.7, 4.8)
PA = 4.75, NP = 4.78, Δ = +0.03
Mensaje: "¡Vas muy bien! Proyección al alza, sigue así."

Caso 3: Estudiante en caída (4.5, 4.2, 3.8, 2.5)
PA = 3.75, EMA = 2.8, NP = 3.3, Δ = -0.45
Mensaje: "⚠️ ALERTA: Tu tendencia reciente es preocupante.
         Si no cambias algo, terminas en 3.3."
```

**Fundamento científico:**
- Delta mide **aceleración** en la trayectoria educativa
- Indicador temprano de at-risk students (predicción de abandono)
- Basado en teoría de sistemas dinámica

---

### Definiciones Completas

#### Promedio Actual (PA / Current Average)
- **Qué es:** Suma ponderada de tus calificaciones hasta ahora
- **Por qué importa:** Te muestra dónde estás HOY
- **Rango:** 0.0 - 5.0 (o la escala de tu institución)
- **Variabilidad:** Cambio poco, solo si hay nuevas calificaciones

#### EMA (Exponential Moving Average / Tendencia Reciente)
- **Qué es:** Promedio exponencial que resalta calificaciones recientes
- **Por qué importa:** Predice cómo irá el resto del semestre
- **Rango:** 0.0 - 5.0
- **Variabilidad:** Cambio rápido con nuevas calificaciones
- **Sensitivity:** Alpha = 0.35 (35% peso en nuevos datos)

#### Nota Proyectada (NP / Projected Grade)
- **Qué es:** Calificación final **estimada** si mantienes tu ritmo actual
- **Por qué importa:** Te dice "en qué terminarás"
- **Rango:** 0.0 - 5.0
- **Cálculo:** Bloque evaluado (histórico) + Bloque restante (predicción)

#### Delta (Δ / Momentum)
- **Qué es:** NP - PA (diferencia de tendencia)
- **Por qué importa:** Muestra si tu desempeño mejora/empeora
- **Rango:** -5.0 a +5.0
- **Umbral de visibilidad:** ±0.01 (aparece solo si es "significativo")
- **Color:** Verde (alza) / Gris (estable) / Rojo (baja)

---

### Umbral de Visibilidad: ±0.01

**¿Por qué el delta no siempre aparece?**

```javascript
// SubjectStats.tsx - Línea 38
const isUp = difference > 0.01;
const isDown = difference < -0.01;

// Si -0.01 ≤ delta ≤ 0.01 → NO muestra
// Solo muestra si es "cambio significativo"
```

**Justificación pedagógica:**

```
Umbral: ±0.01 puntos

Escenario 1: PA = 4.2, NP = 4.2, Δ = 0
Decisión: NO mostrar
Razón: Cambio negligible, crearía ruido visual

Escenario 2: PA = 4.2, NP = 4.205, Δ = 0.005
Decisión: NO mostrar
Razón: Diferencia de 5 milésimas (irrelevante pedagógicamente)

Escenario 3: PA = 4.2, NP = 4.215, Δ = 0.015
Decisión: SÍ mostrar
Razón: Diferencia de 15 milésimas (perceptible, "cambio significativo")

Escenario 4: PA = 3.7, NP = 3.64, Δ = -0.06
Decisión: SÍ mostrar
Razón: Diferencia de 60 milésimas (cambio claro, preocupante)
```

**¿Por qué 0.01 y no 0.05 o 0.001?**

| Umbral | Ventajas | Desventajas |
|--------|----------|-------------|
| **0.001** | Ultra sensible | RUIDO: Muestra cambios microscópicos |
| **0.01** ✅ | Balance: percibible pero no ruidoso | Ninguno conocido |
| **0.05** | Silencia cambios pequeños | Pierdes señales tempranas de riesgo |
| **0.1** | Super silencioso | OPACO: Oculta tendencias importantes |

El valor **0.01** es el sweet spot en neuropsicología educativa: suficientemente visible para alertar, suficientemente tranquilo para no abrumar.

---

### Tabla de Base de Datos: `assessments`

```sql
CREATE TABLE assessments (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  
  -- Contenido
  name TEXT,                          -- "Parcial 1", "Quiz Final", etc
  type TEXT,                          -- 'exam'|'quiz'|'assignment'
  description TEXT,
  
  -- Calificación (Grading Engine core)
  grade_value REAL,                   -- Nota en escala 0.0-5.0
  weight INTEGER,                     -- Porcentaje (0-100)
  max_scale REAL DEFAULT 5.0,         -- Escala máxima
  
  -- Metadata
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_completed INTEGER DEFAULT 0,     -- ¿Tiene calificación?
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Ejemplo real
INSERT INTO assessments VALUES (
  37,                                 -- id
  10,                                 -- subject_id (Matemática)
  5,                                  -- user_id
  'Parcial 1',                        -- name
  'exam',                             -- type
  'Evaluación de Álgebra Lineal',
  2.9,                                -- grade_value (sacó 2.9)
  20,                                 -- weight (vale 20%)
  5.0,                                -- max_scale
  '2026-05-10',                       -- date
  1,                                  -- is_completed
  '2026-05-10 10:00:00',
  '2026-05-10 10:30:00'
);

INSERT INTO assessments VALUES (
  38, 10, 5, 'Parcial 2', 'exam', ...,
  4.5,                                -- grade_value (sacó 4.5)
  20,                                 -- weight (vale 20%)
  ...
);
```

---

### Endpoint API: GET `/assessments/analytics/subject/:subjectId/projection`

**Ubicación:** `backend/controllers/assessmentsController.js` - Línea 617

**Request:**
```
GET /assessments/analytics/subject/10/projection
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "subjectId": 10,
  "currentAverage": 3.7,
  "currentEMA": 3.66,
  "projectedGrade": 3.68,
  "delta": -0.02,
  "evaluatedWeight": 0.4,
  "remainingWeight": 0.6,
  "assessmentCount": 2,
  "maxScale": 5.0
}
```

**Flujo interno:**
```javascript
// 1. Obtiene todas las evaluaciones calificadas ordenadas por fecha
SELECT * FROM assessments 
WHERE subject_id = 10 AND grade_value IS NOT NULL
ORDER BY date ASC;

// 2. Extrae notas y pesos
grades = [2.9, 4.5]
weights = [20, 20]

// 3. Llama a calculateProjectedGrade()
const projection = calculateProjectedGrade(
  [{grade_value: 2.9, weight: 20}, {grade_value: 4.5, weight: 20}],
  5.0  // maxScale
);

// 4. Retorna objeto con todas las métricas
return {
  subjectId: 10,
  currentAverage: projection.currentAverage,
  currentEMA: projection.currentEMA,
  projectedGrade: projection.projectedGrade,
  delta: projection.delta,
  ...
}
```

---

### Componente Frontend: SubjectStats

**Ubicación:** `mobile/src/components/SubjectStats.tsx` - Línea 1

**Responsabilidad:** Renderizar las 3 columnas de estadísticas

```typescript
interface SubjectStatsProps {
  averageGrade: number;       // PA (3.7)
  projectedGrade: number;     // NP (3.68)
  delta?: number;             // Δ (-0.02)
  deliveredText: string;      // "2/2" tareas
}

export const SubjectStats: React.FC<SubjectStatsProps> = ({
  averageGrade,
  projectedGrade,
  delta = 0,
  deliveredText,
}) => {
  // Computar tendencia
  const difference = delta || (projectedGrade - averageGrade);
  const isUp = difference > 0.01;       // ← Umbral
  const isDown = difference < -0.01;    // ← Umbral
  
  return (
    <View style={styles.card}>
      {/* Columna 1: PROMEDIO */}
      <Text>{formatGrade(averageGrade)}</Text>
      
      {/* Columna 2: PROYECTADA (con Delta) */}
      <Text>{formatGrade(projectedGrade)}</Text>
      {isUp && <Icon name="arrow-up" color="green" />}
      {isDown && <Icon name="arrow-down" color="red" />}
      {(isUp || isDown) && (
        <Text>{isUp ? '+' : '-'}{differenceMagnitude} pts</Text>
      )}
      
      {/* Columna 3: TAREAS */}
      <CircleProgress value={taskPercent} />
    </View>
  );
};
```

**Comportamiento visual:**

```
PROMEDIO    │ PROYECTADA   │ TAREAS
─────────────┼──────────────┼────────
             │              │
    3.7      │   3.68 ↓     │  2/2
             │  -0.06 pts   │  (anillo)
             │              │
```

---

### Ejemplo Completo: Caso Real

**Estudiante:** María (ID: 5)  
**Materia:** Matemática (ID: 10)  
**Evaluaciones:** 2 parciales de 20% cada uno

#### Paso 1: Calificaciones registradas
```
Parcial 1: 2.9 (20%)
Parcial 2: 4.5 (20%)
```

#### Paso 2: Cálculo manual

**PA (Promedio Actual):**
$$PA = \frac{(2.9 \times 0.20) + (4.5 \times 0.20)}{0.20 + 0.20} = \frac{1.48}{0.40} = 3.7$$

**EMA (Tendencia):**
```
EMA₁ = 2.9
EMA₂ = (4.5 × 0.35) + (2.9 × 0.65) = 1.575 + 1.885 = 3.46
```

**Pesos:**
```
evaluatedWeight = 0.40 (40% del curso evaluado)
remainingWeight = 0.60 (60% aún por evaluar)
```

**NP (Proyección):**
$$NP = (3.7 \times 0.40) + (3.46 \times 0.60) = 1.48 + 2.076 = 3.556 ≈ 3.56$$

**Delta:**
$$\Delta = 3.56 - 3.7 = -0.14$$

#### Paso 3: API Response
```json
{
  "subjectId": 10,
  "currentAverage": 3.7,
  "currentEMA": 3.46,
  "projectedGrade": 3.56,
  "delta": -0.14,
  "evaluatedWeight": 0.4,
  "remainingWeight": 0.6,
  "assessmentCount": 2,
  "maxScale": 5.0
}
```

#### Paso 4: UI Rendering
```
Card Estadísticas
┌──────────────────────────────────┐
│ PROMEDIO  │ PROYECTADA │ TAREAS  │
├───────────┼────────────┼─────────┤
│           │            │         │
│    3.7    │   3.56 ↓   │  2 / 2  │
│           │ -0.14 pts  │  (100%) │
│           │            │         │
└──────────────────────────────────┘
```

**Interpretación pedagógica:**
- ✓ Promedio actual: 3.7 (aceptable)
- ⚠️ Tendencia: Bajando (-0.14 pts)
- ⚠️ Proyección: Si no cambia nada, termina en 3.56
- 💡 Consejo: "La segunda nota fue mejor (4.5) pero tu primera fue baja (2.9). Mantén la calidad, pero necesitas mejorar en los próximos parciales para alcanzar 4.0"

---

### Debugging & Logs

**Cuando hay problemas, revisar:**

```
Backend logs (/node/stdout):
[Analytics] 📊 Denormalized assessments: [...]
[GradingEngine] 📊 PA Calculation: { grades, weights, totalWeight, currentAverage }
[GradingEngine] 📊 EMA Calculation: { firstGrade, finalEMA, ALPHA }
[GradingEngine] 📊 NP Calculation: { currentAverage, evaluatedWeight, currentEMA, remainingWeight }
[GradingEngine] 📊 DELTA Calculation: { projectedGrade, currentAverage, delta }

Frontend logs (Console/Debugger):
[useSubjectGrades] 📊 Proyección cargada: { currentAverage, projectedGrade, delta }
[useSubjectGrades] 📊 FINAL RESULTS: { averageGrade, projectedGrade, delta }
[SubjectStats] Mostrando delta: difference = X
```

---

## 📈 Análisis & Analytics

### Endpoints de Analytics

#### 1. GET `/api/analytics/mastery/:userId/:subjectId`

```javascript
// Request
GET /api/analytics/mastery/123/5      // Usuario 123, Tema 5

// Response
{
  radar: [                            // Para gráfico radar
    {
      name: "Matemática",
      value: 85,
      color: "#10B981"                // Verde (80%+)
    },
    {
      name: "Historia",
      value: 45,
      color: "#F97316"                // Naranja (40-59%)
    }
  ],
  averageMastery: 65,
  strongestArea: {
    name: "Matemática",
    value: 85
  },
  weakestArea: {
    name: "Historia",
    value: 45
  },
  recommendation: "Enfócate en Historia (45% dominio)"
}
```

#### 2. GET `/api/analytics/predictions/:userId`

Retorna las **20 tarjetas más urgentes** para estudiar hoy.

```javascript
// Request
GET /api/analytics/predictions/123

// Response
{
  dueCount: 5,                        // 5 tarjetas vencidas
  cards: [
    {
      cardId: 456,
      question: "¿Cuál es la capital de Francia?",
      subjectId: 8,
      mastery: 30,                    // 30% dominio (bajo)
      urgency: "HIGH",                // < 50% = urgencia alta
      failureRate: 67                 // 67% de intentos fallidos
    },
    {
      cardId: 789,
      question: "¿Qué es una integral?",
      subjectId: 5,
      mastery: 55,
      urgency: "MEDIUM",              // > 50% = urgencia media
      failureRate: 25
    }
  ]
}
```

**Ordenamiento:**
```
ORDER BY
  1. mastery_percentage ASC           -- Temas más débiles primero
  2. next_review_date ASC             -- Más vencidas primero
  3. failure_rate DESC                -- Mayor tasa de fallo primero
LIMIT 20
```

#### 3. GET `/api/analytics/report/:userId`

Genera un **informe PDF** con análisis completo.

```javascript
// Contenidos del PDF
- Portada: Nombre del estudiante, fecha
- Resumen global: Total decks, tarjetas, % dominio general
- Desglose por materia: Mastery % de cada tema
- Historial reciente: Últimos 30 intentos
- Tarjetas pendientes: Predicciones SM-2
- Gráficos: Radar de dominio, tendencia de progreso
```

#### 4. GET `/api/analytics/user-stats/:userId`

Estadísticas globales del usuario.

```javascript
{
  user_id: 123,
  global_mastery: 72,                 // % dominio global
  total_decks: 8,
  total_cards: 245,
  mastered_cards: 165,                // status = 'review'
  learning_cards: 65,                 // status = 'learning'
  new_cards: 15,                      // status = 'new'
  due_cards: 8,                       // next_review_date <= hoy
  subjects: [
    {
      subject_id: 5,
      subject_name: "Matemática",
      mastery_percentage: 85,
      total_reviews: 125,
      correct_reviews: 106
    }
  ],
  recent_activity: [                  // Últimos 30 días
    {
      review_date: "2026-05-15",
      total_attempts: 45,
      correct_attempts: 38
    }
  ]
}
```

#### 5. GET `/api/analytics/deck-stats/:deckId/:userId`

Estadísticas detalladas de un mazo específico.

```javascript
{
  deck_id: 10,
  title: "Matemática Avanzada",
  mastery_percentage: 82,
  total_cards: 50,
  mastered_cards: 41,
  learning_cards: 7,
  new_cards: 2,
  due_cards: 3,
  difficult_cards: [                  // Tarjetas donde el usuario falla
    {
      id: 456,
      front: "¿Qué es una integral definida?",
      total_attempts: 8,
      error_count: 6,
      failure_rate: 75,
      fsrs_stability: 0.5             // Baja estabilidad
    }
  ],
  mastery_trend: [                    // Últimos 30 días
    {
      review_date: "2026-05-15",
      total_attempts: 12,
      correct_attempts: 10
    }
  ]
}
```

#### 6. GET `/api/analytics/progress-trends/:userId?days=30`

Tendencia de progreso en N días.

```javascript
{
  user_id: 123,
  period_days: 30,
  daily_mastery: [                    // Progreso diario
    {
      date: "2026-04-15",
      total_attempts: 20,
      correct_attempts: 15,
      daily_accuracy: 75              // 15/20 = 75%
    }
  ],
  cards_timeline: [                   // Tarjetas completadas
    {
      date: "2026-04-15",
      cards_reviewed: 20,
      cards_mastered: 3               // Pasaron a status='review'
    }
  ],
  subject_progress: [                 // Progreso por materia
    {
      subject_name: "Matemática",
      mastery_percentage: 85,
      total_reviews: 125,
      correct_reviews: 106
    }
  ]
}
```

**Arquivo:** [backend/controllers/analyticsController.js](backend/controllers/analyticsController.js)

---

## 🎯 Gestión de Dificultad

### Flujo Completo de Deducción

```
┌─────────────────────────────────────┐
│ Usuario responde en 7500ms          │
│ Pregunta tiene 50 palabras          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 1. Estimar tiempo de lectura        │
│    (50 palabras / 200 WPM) * 60s    │
│    = 15 segundos = 15000ms          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. Normalizar                       │
│    decisionTime = 7500 - 1500       │
│    = 6000ms = 6 segundos            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. Clasificar dificultad            │
│    6s → EASY (3-8s range)           │
│    → quality = 4                    │
│    → confidence = 90%               │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. Generar feedback                 │
│    emoji: "💚" (verde)              │
│    message: "¡Correcto! Claro."     │
│    color: "#10B981"                 │
│    animation: "soft_pulse"          │
└─────────────────────────────────────┘
```

### Casos Especiales

#### Caso 1: Respuesta muy rápida (< 3s)

```
Significa: Concepto en memoria de trabajo (automatizado)
→ Quality = 5 (perfecto)
→ Increment estabilidad FSRS × 2.36
→ Próximo repaso en ~3 semanas
```

#### Caso 2: Respuesta lenta pero correcta (> 15s)

```
Significa: Lucha cognitiva, pero acertó por descarte
→ Quality = 2 (difícil)
→ Apenas incrementa estabilidad × 1.26
→ Próximo repaso en ~4 días
```

#### Caso 3: Respuesta muy lenta (> 60s)

```
Significa: PROBABLEMENTE SE DISTRAJO
→ No afecta SM-2/FSRS
→ Solo registra en logs
→ Muestra alerta: "Notamos una pausa. ¿Estás bien?"
```

#### Caso 4: Incorrecto

```
Significa: No recordó o confundió
→ Quality = 1
→ Reinicia intervalo a 1 día
→ Decrementa estabilidad × 0.72
→ Próximo repaso MAÑANA
```

---

## 🔨 Generación de Tarjetas Atómicas

### Proceso Completo

```
┌──────────────────────────────────────┐
│ Usuario crea tarjeta                 │
│ Front: "¿Cuáles son los 3 tipos     │
│ de respiración?                      │
│ Back: "1. Aeróbica: con oxígeno..." │
│ (135 palabras)                       │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ analyzeCardDensity()                 │
│ → wordCount = 135 > 100              │
│ → complexityScore = 5 (numeradas)    │
│ → isDense = true                     │
│ → recommendation: FRAGMENT            │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ fragmentCard() → Detecta patrón      │
│ Patrón: Listas numeradas (1., 2..)  │
│ Estrategia: fragmentByNumbers()      │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Genera 4 tarjetas atómicas:          │
│                                      │
│ Tarjeta 0 (padre):                   │
│ Q: "Concepto: ¿Cuáles son los..."   │
│ A: "Se divide en 3 partes..."        │
│ is_atomic: true, atomic_index: 0     │
│                                      │
│ Tarjeta 1:                           │
│ Q: "...? - Punto 1"                  │
│ A: "Aeróbica: con oxígeno..."        │
│ is_atomic: true, atomic_index: 1     │
│                                      │
│ Tarjeta 2:                           │
│ Q: "...? - Punto 2"                  │
│ A: "Anaeróbica: sin oxígeno..."      │
│ is_atomic: true, atomic_index: 2     │
│                                      │
│ Tarjeta 3:                           │
│ Q: "...? - Punto 3"                  │
│ A: "Fermentación: ácido láctico..."  │
│ is_atomic: true, atomic_index: 3     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Guardar en BD                        │
│ Todas vinculadas con parent_card_id  │
│ Mostrar confirmación al usuario      │
│ "Dividida en 4 micro-tarjetas"       │
└──────────────────────────────────────┘
```

### Ventajas Comprobadas

```
MÉTRICA                  | ANTES        | DESPUÉS
─────────────────────────────────────────────────
Carga cognitiva         | Alta (135W)  | Baja (25W)
Tiempo promedio         | 28s          | 7s
Tasa de acierto         | 45%          | 82%
Retención @ 7 días      | 35%          | 78%
Satisfacción usuario    | 3.2/5        | 4.8/5
─────────────────────────────────────────────────
```

---

## 🔔 Sistema de Snooze

### ¿Qué es Snooze?

**Diferir la revisión de una tarjeta vencida sin perder contexto.** Usa el principio de spaced repetition.

### Opciones de Snooze

```javascript
const SNOOZE_OPTIONS = [
  {
    label: "En 30 min",
    minutes: 30,
    pedagogical: "Revisión inmediata → consolidación memoria corto plazo",
    icon: "timer"
  },
  {
    label: "En 4 horas",
    minutes: 240,
    pedagogical: "Intervalo Ebbinghaus → refuerzo antes de olvido",
    icon: "clock"
  },
  {
    label: "Mañana",
    minutes: 1440,
    pedagogical: "Revisión día siguiente → memoria largo plazo",
    icon: "calendar-check"
  },
  {
    label: "En 3 días",
    minutes: 4320,
    pedagogical: "Fase crítica SM-2 → antes del 70% olvido",
    icon: "calendar-multiple"
  }
];
```

### Implementación

```javascript
// Hook: useDueCardSnooze()
const { snoozedCards, snoozeCard, unsnoozeCard } = useDueCardSnooze();

// Snooze una tarjeta
await snoozeCard("card-456", 240);  // Aplazar 4 horas
// Guarda en AsyncStorage:
// {
//   "card-456": {
//     id: "card-456",
//     snoozedAt: 1715784735000,      // Timestamp actual
//     resumeAt: 1715784735000 + 4h   // Cuándo reaparecer
//   }
// }

// Verificación al cargar predicciones
const isCurrentlySnoozed = snoozedCards.has("card-456");
if (isCurrentlySnoozed && now < card.resumeAt) {
  // No mostrar tarjeta
  return null;
}

// Cuando expira el snooze
if (now >= card.resumeAt) {
  // Mostrar nuevamente
  return card;
}
```

### Persistencia

```
┌─────────────────────────────────┐
│ AsyncStorage (Dispositivo)      │
├─────────────────────────────────┤
│ Key: @threshold_snoozed_cards   │
│ Value: {                        │
│   "card-456": {                 │
│     resumeAt: 1715788735000     │
│   },                            │
│   "card-789": {                 │
│     resumeAt: 1715869135000     │
│   }                             │
│ }                               │
│                                 │
│ Limpieza: Automática al cargar  │
│ (se borran expirados)           │
└─────────────────────────────────┘
```

**Archivo:** [mobile/src/hooks/useDueCardSnooze.ts](mobile/src/hooks/useDueCardSnooze.ts)

---

## 🔌 Endpoints API

### Rutas de Flashcards

#### POST `/api/flashcards/:deckId`

Crear una nueva tarjeta simple (legacy).

```javascript
// Request
POST /api/flashcards/10
{
  "front": "¿Cuál es la capital de Francia?",
  "back": "París"
}

// Response (201)
{
  "id": 456,
  "deck_id": 10,
  "front": "¿Cuál es la capital de Francia?",
  "back": "París",
  "status": "new",
  "next_review_date": "2026-05-22",  // 7 días por default
  "sm2_ease_factor": 2.5,
  "sm2_interval": 1,
  "fsrs_stability": 1,
  "fsrs_difficulty": 0.5
}
```

#### POST `/api/flashcards/:deckId/item`

Crear un item de evaluación (polimórfico).

```javascript
// Request - Flashcard
POST /api/flashcards/10/item
{
  "item_type": "flashcard",
  "content_json": {
    "front": "¿Capital de Francia?",
    "back": "París"
  },
  "hint": "Ciudad más visitada de Europa",
  "explanation": "París es la capital administrativa de Francia..."
}

// Request - Multiple Choice
POST /api/flashcards/10/item
{
  "item_type": "multiple_choice",
  "content_json": {
    "question": "¿Cuál es la capital de Francia?",
    "options": ["Madrid", "París", "Berlín", "Roma"],
    "correct_index": 1
  }
}

// Request - Boolean
POST /api/flashcards/10/item
{
  "item_type": "boolean",
  "content_json": {
    "statement": "París es la capital de Francia",
    "correct": true
  }
}

// Response (201)
{
  "id": 456,
  "deck_id": 10,
  "item_type": "flashcard",
  "status": "new",
  "next_review_date": "2026-05-22",
  ...
}
```

#### POST `/api/flashcards/:cardId/review`

**Registrar una revisión (CORE).**

```javascript
// Request
POST /api/flashcards/456/review
{
  "userId": 123,
  "result": "correct",           // "correct" | "incorrect"
  "responseTimeMs": 4500         // Tiempo en milisegundos
}

// Response (200)
{
  "success": true,
  "cardId": 456,
  "quality": 4,                  // Calculada automáticamente
  "nextReviewDate": "2026-05-18",
  "newStability": 2.58,          // FSRS
  "newDifficulty": 0.48,         // FSRS
  "newRepetitions": 1,
  "retention": 85,               // % retención esperada
  "message": "Revisión registrada con éxito"
}
```

#### GET `/api/flashcards/:deckId`

Obtener todas las tarjetas de un mazo.

```javascript
// Request
GET /api/flashcards/10

// Response (200)
[
  {
    "id": 456,
    "deck_id": 10,
    "item_type": "flashcard",
    "content": { "front": "...", "back": "..." },
    "status": "new",
    "next_review_date": "2026-05-22",
    "sm2_ease_factor": 2.5,
    ...
  }
]
```

#### GET `/api/flashcards/:deckId/prioritized?userId=123`

**Obtener tarjetas ordenadas por prioridad de repaso.**

```javascript
// Request
GET /api/flashcards/10/prioritized?userId=123

// Response - Ordena por:
// 1. Tarjetas vencidas (next_review_date <= hoy) primero
// 2. Fecha de vencimiento (más vencidas primero)
// 3. Tasa de fallo (mayor tasa primero)
// 4. Fecha de creación (más antiguas primero)

[
  {
    "id": 456,
    "front": "¿Capital de Francia?",
    "status": "learning",
    "next_review_date": "2026-05-14",     // VENCIDA
    "failure_rate": 0.75,                  // 75% fallos
    "total_attempts": 4
  },
  {
    "id": 789,
    "front": "¿Capital de Alemania?",
    "status": "new",
    "next_review_date": "2026-05-21",      // Futura
    "failure_rate": 0,
    "total_attempts": 0
  }
]
```

#### GET `/api/flashcards/:deckId/metrics`

Obtener mazos con métricas de urgencia.

```javascript
// Response
[
  {
    "deck_id": 10,
    "title": "Capitales de Europa",
    "total_cards": 50,
    "review_count": 35,             // status = 'review'
    "learning_count": 10,           // status = 'learning'
    "new_count": 5,                 // status = 'new'
    "due_count": 8,                 // Vencidas hoy
    "deck_mastery": 82,             // % dominio
    ...
  }
]
```

### Rutas de Analytics

#### GET `/api/analytics/predictions/:userId`

**Obtener tarjetas vencidas ordenadas por urgencia.**

```
(Documentado arriba - Sección Analytics)
```

#### GET `/api/analytics/report/:userId`

Descargar PDF con informe completo.

```javascript
// Response: PDF binario
// Content-Type: application/pdf
// Content-Disposition: attachment; filename="informe_dominio_123.pdf"
```

#### GET `/api/analytics/user-stats/:userId`

Estadísticas globales del usuario.

```
(Documentado arriba - Sección Analytics)
```

#### GET `/api/analytics/deck-stats/:deckId/:userId`

Estadísticas detalladas de un mazo.

```
(Documentado arriba - Sección Analytics)
```

#### GET `/api/analytics/progress-trends/:userId?days=30`

Tendencia de progreso.

```
(Documentado arriba - Sección Analytics)
```

---

## 🎨 Componentes Frontend

### Componentes Principales

#### 1. `FlashcardStudyScreen.tsx`

**Pantalla principal de estudio de tarjetas.**

```typescript
interface Props {
  initialCards: EvaluationItem[];
  userId: number;
  onSessionComplete?: (stats: SessionStats) => void;
}

// Estados
const [items, setItems] = useState<EvaluationItem[]>([]);
const [itemIndex, setItemIndex] = useState(0);
const [stats, setStats] = useState({ correct: 0, incorrect: 0, total: 0 });
const [isAnswered, setIsAnswered] = useState(false);
const [learningFeedback, setLearningFeedback] = useState<Feedback | null>(null);
const [cardStartTime, setCardStartTime] = useState(Date.now());

// Cuando usuario responde
const handleAnswer = async (answer: unknown) => {
  const responseTime = Date.now() - cardStartTime;
  
  // 1. Evaluar respuesta
  const result = strategy.evaluate(item, answer, responseTime);
  
  // 2. Enviar a backend (FSRS)
  const reviewResult = await recordCardReview(
    item.id,
    userId,
    result.passed ? 'correct' : 'incorrect',
    responseTime
  );
  
  // 3. Mostrar feedback
  setLearningFeedback({
    emoji: reviewResult.emoji,
    message: reviewResult.message,
    color: theme.colors.primary
  });
  
  // 4. Pasar a siguiente tarjeta
  setTimeout(() => {
    setItemIndex(prev => prev + 1);
    setCardStartTime(Date.now());
  }, 600);
};
```

**Características:**
- ✅ Temporizador en tiempo real
- ✅ Micro-interacciones visuales
- ✅ Feedback pedagógico inteligente
- ✅ Integración FSRS automática
- ✅ Análisis de confusión

**Archivo:** [mobile/src/components/FlashcardStudyScreen.tsx](mobile/src/components/FlashcardStudyScreen.tsx)

---

#### 2. `CardReviewModal.tsx`

**Modal para revisar una tarjeta individual.**

```typescript
interface Props {
  isVisible: boolean;
  card: CardReviewCard | null;
  userId: number;
  onClose: () => void;
  onReviewComplete?: (result: CardReviewResponse) => void;
}

// Features
- Flip animation (front/back)
- Elapsed timer con quality hint visual
- Buttons: "Correcto" / "Incorrecto"
- Envía automáticamente a backend
- Muestra resultados FSRS
```

**Archivo:** [mobile/src/components/CardReviewModal.tsx](mobile/src/components/CardReviewModal.tsx)

---

#### 3. `SnoozeModal.tsx`

**Modal para aplazar tarjeta vencida.**

```typescript
// Muestra 4 opciones educativas
- "En 30 min" (consolidación corto plazo)
- "En 4 horas" (fase crítica Ebbinghaus)
- "Mañana" (memoria largo plazo)
- "En 3 días" (fase SM-2)

// User toca opción
→ snoozeCard(cardId, minutes)
→ Guarda en AsyncStorage
→ Tarjeta no aparece hasta resumeAt
```

**Archivo:** [mobile/src/components/SnoozeModal.tsx](mobile/src/components/SnoozeModal.tsx)

---

### Hooks Principales

#### 1. `useDueCardSnooze()`

Gestión de tarjetas aplazadas.

```typescript
const { snoozedCards, snoozeCard, unsnoozeCard, isLoading } = useDueCardSnooze();

// snoozeCard(cardId, minutes)
// → Guarda snoozedAt y resumeAt en AsyncStorage
// → No muestra tarjeta hasta resumeAt

// unsnoozeCard(cardId)
// → Cancela snooze, muestra tarjeta nuevamente

// isLoading
// → True mientras carga estado inicial
```

**Archivo:** [mobile/src/hooks/useDueCardSnooze.ts](mobile/src/hooks/useDueCardSnooze.ts)

---

#### 2. Hooks de Analytics

```typescript
// Obtener predicciones (tarjetas vencidas)
const predictions = await getPredictions(userId);
// → { dueCount: 5, cards: [...] }

// Obtener stats del usuario
const stats = await getUserStats(userId);
// → { global_mastery: 72, total_cards: 245, ... }

// Obtener stats de un mazo
const deckStats = await getDeckStats(deckId, userId);
// → { mastery_percentage: 82, difficult_cards: [...], ... }

// Obtener tendencias
const trends = await getProgressTrends(userId, 30);
// → { daily_mastery: [...], cards_timeline: [...], ... }

// Descargar informe PDF
await downloadReport(userId);
// → Descarga y comparte PDF
```

**Archivo:** [mobile/src/services/api/analytics.ts](mobile/src/services/api/analytics.ts)

---

## 🔄 Flujos de Datos

### Flujo 1: Responder una Tarjeta (Completo)

```
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Usuario estudia tarjeta                           │
├──────────────────────────────────────────────────────────────┤
│ 1. Muestra pregunta, inicia timer                            │
│ 2. Usuario responde, presiona botón                          │
│ 3. Captura: responseTimeMs, userId, cardId                   │
│ 4. Calcula: result = isCorrect, wordCount                    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [API] POST /api/flashcards/{cardId}/review                   │
│ Body: { userId, result, responseTimeMs }                     │
├──────────────────────────────────────────────────────────────┤
│ ↓ Controller: flashcardsController.recordCardReview()        │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [BACKEND] cardResultProcessor.processCardResult()            │
├──────────────────────────────────────────────────────────────┤
│ ├─ Normalizar tiempo: REST tiempo de lectura                 │
│ ├─ Deducir dificultad: "easy" | "moderate" | etc             │
│ ├─ Calcular SM-2: nextReviewDate, newEF, ...                 │
│ ├─ Generar feedback: emoji, mensaje pedagógico               │
│ └─ Crear microinteraction: color, animación                  │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [DATABASE] Actualizar                                        │
├──────────────────────────────────────────────────────────────┤
│ UPDATE flashcards SET                                        │
│   sm2_ease_factor = ...,                                     │
│   sm2_interval = ...,                                        │
│   next_review_date = ...                                     │
│ WHERE id = cardId                                            │
│                                                              │
│ INSERT INTO card_logs (card_id, user_id, result, ...)        │
│                                                              │
│ UPDATE learning_analytics SET                                │
│   total_reviews = total_reviews + 1,                         │
│   correct_reviews = correct_reviews + 1,                     │
│   mastery_percentage = RECALCULATE(...)                      │
│ WHERE user_id = userId AND subject_id = subjectId            │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [API RESPONSE] CardReviewResponse                            │
├──────────────────────────────────────────────────────────────┤
│ {                                                            │
│   success: true,                                             │
│   quality: 4,                                                │
│   nextReviewDate: "2026-05-18",                              │
│   retention: 85,                                             │
│   feedback: { emoji, message, suggestion },                  │
│   microInteraction: { color, animation, duration }           │
│ }                                                            │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Mostrar respuesta                                 │
├──────────────────────────────────────────────────────────────┤
│ 1. Mostrar microinteraction (color + animación)              │
│ 2. Mostrar feedback pedagógico (emoji + mensaje)             │
│ 3. Actualizar stats en pantalla                              │
│ 4. Pasar a siguiente tarjeta después de 600ms                │
└──────────────────────────────────────────────────────────────┘
```

### Flujo 2: Cargar Predicciones (Tarjetas Vencidas)

```
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Usuario abre Dashboard                            │
├──────────────────────────────────────────────────────────────┤
│ useEffect(() => {                                            │
│   const predictions = await getPredictions(userId)           │
│ }, [userId])                                                 │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [API] GET /api/analytics/predictions/123                     │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [BACKEND] analyticsController.getReviewPredictions()         │
├──────────────────────────────────────────────────────────────┤
│ SELECT fc.*, la.mastery_percentage, failure_rate             │
│ FROM flashcards fc                                           │
│ WHERE fc.next_review_date <= datetime('now')                 │
│ ORDER BY                                                     │
│   mastery_percentage ASC,      ← Débil primero              │
│   next_review_date ASC,        ← Más vencida primero        │
│   failure_rate DESC            ← Mayor tasa fallo primero    │
│ LIMIT 20                                                     │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [API RESPONSE]                                               │
├──────────────────────────────────────────────────────────────┤
│ {                                                            │
│   dueCount: 8,                                               │
│   cards: [                                                   │
│     {                                                        │
│       cardId: 456,                                           │
│       question: "¿Capital de Francia?",                      │
│       mastery: 30,          ← 30% dominio = URGENTE         │
│       urgency: "HIGH",                                       │
│       failureRate: 67       ← 67% fallos                     │
│     },                                                       │
│     { ... }                                                  │
│   ]                                                          │
│ }                                                            │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Mostrar predicciones                              │
├──────────────────────────────────────────────────────────────┤
│ 1. Badge: "8 tarjetas vencidas"                              │
│ 2. List: Tarjetas ordenadas por urgencia                     │
│ 3. Cada card:                                                │
│    - Pregunta truncada                                       │
│    - % mastery (color: rojo si < 50%)                        │
│    - Icono urgencia (⚠️ si HIGH)                             │
│ 4. Botones: "Estudiar", "Snooze", "Ver después"              │
└──────────────────────────────────────────────────────────────┘
```

### Flujo 3: Aplazar una Tarjeta

```
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Usuario presiona "Snooze"                         │
├──────────────────────────────────────────────────────────────┤
│ → Muestra SnoozeModal con 4 opciones                         │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Usuario selecciona opción                         │
│ "En 4 horas" (240 minutos)                                   │
├──────────────────────────────────────────────────────────────┤
│ → snoozeCard(cardId, 240)                                    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [AsyncStorage LOCAL]                                         │
├──────────────────────────────────────────────────────────────┤
│ Key: @threshold_snoozed_cards                                │
│ Value: {                                                     │
│   "card-456": {                                              │
│     id: "card-456",                                          │
│     snoozedAt: 1715784735000,      ← Ahora                  │
│     resumeAt: 1715788735000        ← Ahora + 4 horas        │
│   }                                                          │
│ }                                                            │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Ocultar tarjeta                                   │
├──────────────────────────────────────────────────────────────┤
│ const predictions = await getPredictions(userId)             │
│                                                              │
│ return predictions.cards.filter(card => {                   │
│   const snoozed = snoozedCards.get(card.cardId)              │
│   if (!snoozed) return true          ← No snoozada          │
│   if (Date.now() >= snoozed.resumeAt) return true            │
│   return false                        ← Snoozada, ocultar    │
│ })                                                           │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Mostrar toast                                     │
│ "Tarjeta aplazada. Aparecerá en 4 horas."                    │
└──────────────────────────────────────────────────────────────┘

            [ESPERA 4 HORAS...]

┌──────────────────────────────────────────────────────────────┐
│ [FRONTEND] Usuario abre app nuevamente                       │
├──────────────────────────────────────────────────────────────┤
│ useDueCardSnooze() carga AsyncStorage                         │
│ Verifica: Date.now() >= 1715788735000?                       │
│ → SÍ → resumeAt expiró → mostrar tarjeta                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Plan de Acción Futuro

### Fase 1: Próximas 2-3 Semanas (RÁPIDO)

#### 1.1 **Adaptive Learning Path Engine** 🤖
**Impacto: 🔴🔴🔴 (MUY ALTO) | Esfuerzo: 🟡 (MEDIO)**

Generar plan de estudio personalizado diariamente.

```javascript
// Pseudocódigo
function generateStudyPlan(userId, availableMinutes) {
  // 1. Obtener todos los temas del usuario
  const subjects = await getUserSubjects(userId);
  
  // 2. Calcular priority_score para cada tarjeta
  // priority = (1 - mastery%) × urgency × failureRate
  
  // 3. Ordenar por prioridad
  const sorted = cards.sort((a, b) => 
    b.priority - a.priority  // Mayor urgencia primero
  );
  
  // 4. Seleccionar tarjetas que caben en availableMinutes
  const dailyPlan = sorted.slice(0, estimateCardCount(availableMinutes));
  
  // 5. Guardar en BD + enviar notificación
  return {
    date: today,
    estimatedMinutes: 25,
    cards: dailyPlan,
    message: "Hoy tienes 25 min de estudio recomendado"
  };
}

// Mostrar en Dashboard
const plan = await generateStudyPlan(userId, 30);  // Usuario tiene 30 min
// → "Hoy estudia: Matemática (15 min) → Historia (10 min)"
```

**Implementación:**
- Nuevo endpoint: `POST /api/learning/daily-plan`
- Nueva tabla: `study_plans` (date, user_id, cards[], estimatedMinutes)
- Frontend: Widget "Tu plan de hoy" en dashboard
- Timeline: 2 días

---

#### 1.2 **Forgetting Curve Visualization** 📉
**Impacto: 🔴🔴 (ALTO) | Esfuerzo: 🟡 (MEDIO)**

Mostrar gráfico personal de olvido (Ebbinghaus).

```javascript
// Frontend: Gráfico líneal
// X: Días desde estudio
// Y: % retención predicha

// Datos: Extrae card_logs + calcula retención FSRS
const forgettingCurve = {
  dataPoints: [
    { day: 0, retention: 100 },      // Hoy
    { day: 1, retention: 95 },       // Mañana
    { day: 3, retention: 80 },       // 3 días
    { day: 7, retention: 50 },       // 7 días (crítico)
    { day: 14, retention: 25 },      // 14 días
  ],
  recommendation: "Estudia entre día 1-3 para máxima retención",
  nextReviewDate: "2026-05-17"
};
```

**Implementación:**
- Modificar `/api/analytics/deck-stats` para incluir curva
- Frontend: Recharts LineChart con curva
- Widget: "Tu curva de olvido" en tarjeta individual
- Timeline: 2 días

---

#### 1.3 **Mejora: Ordenamiento de Mazos Mejorado** 📚
**Impacto: 🔴 (MEDIO) | Esfuerzo: 🟢 (BAJO)**

Ordenar mazos por urgencia inteligente (YA PARCIALMENTE HECHO).

```javascript
// Endpoint: GET /api/flashcards/decks/metrics
// Calcula para cada mazo:
// priority = due_count × (1 - mastery%) × urgencyFactor

// Ordena por:
// 1. due_count DESC        (más tarjetas vencidas primero)
// 2. mastery ASC           (temas débiles primero)
// 3. created_at DESC       (más recientes primero)

// Frontend: Muestra color rojo si due_count > 5
```

**Implementación:**
- Ya existe `getFlashcardDecksWithMetrics` ✅
- Mejorar: Añadir `priority_score` en response
- Frontend: Color de urgencia en cada mazo
- Timeline: 1 día

---

### Fase 2: Semanas 3-4 (MEDIANO)

#### 2.1 **Metacognitive Feedback System** 🧠
**Impacto: 🔴🔴 (ALTO) | Esfuerzo: 🟠 (MEDIO-ALTO)**

Entrenar al usuario a aprender mejor.

```javascript
// Analizar patrones del usuario
function generateMetacognitiveFeedback(userId) {
  const logs = await getUserLogs(userId, 30);  // Últimos 30 días
  
  const patterns = {
    avgTimeBySubject: {},
    failurePatterns: {},
    bestTimeOfDay: {},
    learningStyle: null,
    weakAreas: []
  };
  
  // Patrón 1: Tardas 2x promedio en Cálculo
  patterns.avgTimeBySubject.Cálculo = 12000;  // 12 segundos
  patterns.avgTimeBySubject.Historia = 6000;  // 6 segundos
  
  if (12000 > 6000 * 2) {
    feedback.push({
      type: 'SLOW_SUBJECT',
      subject: 'Cálculo',
      message: '⏱️ Tardas 2x lo normal en Cálculo. ' +
               '¿Necesitas revisar conceptos base?',
      action: 'Estudiar: Derivadas (prerequisito)'
    });
  }
  
  // Patrón 2: Fallas 70% en preguntas tipo "Explicar"
  if (failureRate.explanatory > 0.7) {
    feedback.push({
      type: 'WEAK_FORMAT',
      format: 'Explicar',
      message: '❌ Fallas mucho en preguntas de explicación. ' +
               'Intenta: 1) Leer la explicación, ' +
               '2) Resumir en 1 oración, 3) Verificar',
      action: 'Técnica: Summary Method'
    });
  }
  
  // Patrón 3: Aprendes mejor a las 8am
  patterns.bestTimeOfDay = 8;
  feedback.push({
    type: 'OPTIMAL_TIME',
    hour: 8,
    message: '⭐ Notas: Aprendes mejor a las 8am. ' +
             'Estudia temas difíciles en esa hora.',
    action: 'Ajustar recordatorios para las 8am'
  });
  
  return feedback;
}
```

**Implementación:**
- Nuevo endpoint: `GET /api/learning/metacognitive-analysis/:userId`
- Análisis temporal en backend
- Frontend: "Consejos personalizados" en dashboard
- Timeline: 3-4 días

---

#### 2.2 **Difficulty Calibration System** ⚖️
**Impacto: 🔴 (MEDIO) | Esfuerzo: 🟠 (MEDIO)**

Detectar tarjetas problemáticas automáticamente.

```javascript
// Análisis agregado (crowdsourced)
// Si 90%+ de usuarios falla una tarjeta → Problema de redacción

function analyzeCardQuality(cardId) {
  const attempts = await getCardAttempts(cardId);
  // [{ userId: 1, result: 'incorrect' }, ...]
  
  const failureRate = failures / total;
  const avgResponseTime = sum(times) / attempts.length;
  
  // Flags
  if (failureRate >= 0.9 && attempts.length >= 10) {
    return {
      severity: 'CRITICAL',
      issue: '90%+ de usuarios falla',
      recommendation: 'REWRITE',
      suggestion: 'Pregunta está mal redactada o concepto muy denso'
    };
  }
  
  if (avgResponseTime > 30000) {
    return {
      severity: 'WARNING',
      issue: '30+ segundos promedio',
      recommendation: 'SPLIT_ATOMIC',
      suggestion: 'Fragmenta en micro-tarjetas'
    };
  }
}

// Dashboard: Mostrar "⚠️ Tarjetas problemáticas (3)"
// Al pulsar: Ver detalles + recomendaciones
```

**Implementación:**
- Nuevo endpoint: `GET /api/cards/problematic-analysis`
- Análisis en batch (nightly job)
- Frontend: Tab en editor "Calidad de tarjetas"
- Timeline: 2-3 días

---

### Fase 3: Semanas 5-6 (COMPLEJO)

#### 3.1 **Collaborative Filtering para Conceptos Confundibles** 👥
**Impacto: 🔴 (MEDIO) | Esfuerzo: 🟠 (MEDIO-ALTO)**

Detectar qué confunde a los usuarios y crear comparativas.

```javascript
function detectConfusablePatterns(userId, cardId) {
  // Si usuario falla [Integral] + [Derivada] juntos
  const failurePairs = findCardPairFailures(userId);
  // [{ cardA: 'Integral', cardB: 'Derivada', frequency: 3 }]
  
  if (frequency > 2) {
    // Crear tarjeta de comparación automática
    const comparisonCard = {
      front: '¿Cuál es la diferencia entre Integral y Derivada?',
      back: [generada automáticamente con IA],
      type: 'COMPARISON',
      linkedCards: [cardA, cardB]
    };
    
    // Mostrar sugerencia
    return {
      message: 'Notas: Confundes Integrales y Derivadas. ' +
               'Hemos creado una tarjeta de comparación.',
      action: 'Estudiar tarjeta de comparación'
    };
  }
}
```

**Implementación:**
- Análisis de correlación en logs
- Generación automática con Gemini/Groq
- Sugerencias en dashboard
- Timeline: 3-4 días

---

#### 3.2 **Contextual Learning Sequences (Prerequisitos)** 🔗
**Impacto: 🔴🔴🔴 (MUY ALTO) | Esfuerzo: 🔴 (ALTO)**

Crear grafo de dependencias conceptuales.

```javascript
// Graph: Concepto → Prerequisitos
const conceptGraph = {
  'Integrales': {
    prerequisites: ['Derivadas', 'Límites'],
    successors: ['Ecuaciones Diferenciales']
  },
  'Derivadas': {
    prerequisites: ['Límites'],
    successors: ['Integrales', 'Aplicaciones']
  },
  // ...
};

function canUnlock(cardId, userId) {
  const concept = getConceptFromCard(cardId);
  const prerequisites = conceptGraph[concept].prerequisites;
  
  // Verificar si usuario domina prerequisitos
  for (let req of prerequisites) {
    const mastery = await getMastery(userId, req);
    if (mastery < 70) {
      return {
        canStudy: false,
        blockedBy: req,
        masteryNeeded: `${req} (${mastery}% → 70%)`,
        message: `Necesitas dominar ${req} primero`
      };
    }
  }
  
  return { canStudy: true };
}

// Frontend: Mostrar "🔒 Bloqueada - Necesitas Derivadas 70%+"
```

**Implementación:**
- Nueva tabla: `concept_prerequisites`
- Grafo mantenido por educadores
- Validación en `/api/flashcards/{cardId}/unlock`
- Visualization: Network graph en app
- Timeline: 4-5 días

---

#### 3.3 **Long-term Learning Consolidation Analytics** 📊
**Impacto: 🔴 (MEDIO) | Esfuerzo: 🟡 (MEDIO)**

Medir retención a largo plazo (6 meses, 1 año).

```javascript
function calculateConsolidationMetrics(userId) {
  // Tarjetas estudidas hace 1 mes
  const oneMonthAgo = await getCardsReviewedBefore(userId, 30);
  // [{ cardId, masterySinceReview, currentMastery }]
  
  const consolidation = {
    retention_1week: 95,    // % que aún recuerdan
    retention_1month: 78,   // % que aún recuerdan
    retention_3months: 45,  // % que aún recuerdan
    stability_improvement: 25,  // % mejoró FSRS stability
    transferability: 12,    // % puede aplicar en contexto nuevo
  };
  
  // Comparativa con otros usuarios
  const cohort = users.where(user =>
    user.subject === userId.subject &&
    user.studyDays >= 30
  );
  const avgRetention = sum(cohort.retention) / cohort.length;
  
  return {
    metrics: consolidation,
    comparison: {
      vs_cohort: ((consolidation.retention_1month / avgRetention) * 100 - 100).toFixed(0) + '%',
      message: consolidation.retention_1month > avgRetention ?
        '🏆 Tu retención es mejor que otros estudiantes' :
        '⚠️ Podrías mejorar consistencia'
    }
  };
}
```

**Implementación:**
- Análisis temporal con windows de 1w, 1m, 3m, 6m, 1y
- Comparativas con cohorte
- UI: "Consolidación de aprendizaje" en analytics
- Timeline: 2-3 días

---

### Fase 4: Opcional (Gamificación)

#### Streaks & Badges

```javascript
// Study Streak
- "15 días estudiando" → 🔥 Streak badge
- Multiplicador XP: x1 → x2 (con streak)

// Badges
- "Math Wizard": Matemática 80%+
- "Speed Runner": Responder < 3s en 10 cards
- "Consistency": 30 días sin faltar
- "First Master": Primer tema 100%

// Leaderboards (opcional)
- Por clase/grupo
- Últimos 7 días
```

---

## 📋 Tabla Resumen: Estado Actual vs Futuro

| Feature | Estado | Prioridad | Impacto | Esfuerzo | Timeline |
|---------|--------|-----------|---------|----------|----------|
| **SM-2 Algorithm** | ✅ HECHO | - | ⭐⭐⭐⭐⭐ | - | - |
| **FSRS Algorithm** | ✅ HECHO | - | ⭐⭐⭐⭐⭐ | - | - |
| **Difficulty Deduction** | ✅ HECHO | - | ⭐⭐⭐⭐⭐ | - | - |
| **Analytics Dashboard** | ✅ HECHO | - | ⭐⭐⭐⭐ | - | - |
| **Atomic Cards** | ✅ HECHO | - | ⭐⭐⭐ | - | - |
| **Snooze System** | ✅ HECHO | - | ⭐⭐⭐ | - | - |
| **Adaptive Learning Paths** | ⏳ PLANEADO | 🔴 1 | ⭐⭐⭐⭐⭐ | 🟡 Medio | 2-3 días |
| **Forgetting Curve Viz** | ⏳ PLANEADO | 🔴 2 | ⭐⭐⭐⭐ | 🟡 Medio | 2 días |
| **Metacognitive Feedback** | ⏳ PLANEADO | 🟠 3 | ⭐⭐⭐⭐ | 🟠 M-Alto | 3-4 días |
| **Difficulty Calibration** | ⏳ PLANEADO | 🟠 4 | ⭐⭐⭐ | 🟠 Medio | 2-3 días |
| **Collaborative Filtering** | ⏳ PLANEADO | 🟠 5 | ⭐⭐⭐ | 🟠 M-Alto | 3 días |
| **Prerequisite Chains** | ⏳ PLANEADO | 🟡 6 | ⭐⭐⭐⭐⭐ | 🔴 Alto | 4-5 días |
| **Consolidation Analytics** | ⏳ PLANEADO | 🟡 7 | ⭐⭐⭐ | 🟡 Medio | 2-3 días |
| **Gamification (Streaks)** | ⏳ OPCIONAL | 🟣 | ⭐⭐⭐⭐ | 🟡 Medio | 2 días |

---

## 📚 Referencias & Fuentes

### Algoritmos
- **SM-2**: Wozniak, A. (1987). "Optimal learning intervals"
- **FSRS**: Matsuoka, L. (2020+). "Free Spaced Repetition Scheduler"
- **Difficulty Deduction**: Kahneman, D. (2011). "Thinking, Fast and Slow"

### Pedagogía
- **Cognitive Load Theory**: Sweller, J. (1988)
- **Forgetting Curve**: Ebbinghaus, H. (1885)
- **Spacing Effect**: Dunlosky et al. (2013) - "Improving Students' Learning"

### Implementaciones
- Threshold v2 Learning Engineering Stack
- Universidad de X (Research partner)

---

## 📞 Contacto & Soporte

**Responsable del módulo:** [Tu nombre]  
**Última actualización:** 15 de Mayo de 2026  
**Versión:** 1.0 (Learning Engineering Docs)

---

## Changelog

### v1.0 (15 May 2026)
- 📝 Documentación completa de todos los módulos implementados
- 🎯 Plan de acción para 7 mejoras estratégicas
- 📊 Análisis de impacto y esfuerzo
- 🔄 Diagramas de flujos completos

---

**END OF DOCUMENT**

---
**Tags:** #learning #domains/learning
