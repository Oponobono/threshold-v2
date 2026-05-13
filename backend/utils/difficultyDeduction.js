/**
 * difficultyDeduction.js
 *
 * Deduce automáticamente la dificultad basada en:
 * 1. Tiempo de respuesta
 * 2. Longitud del texto (normalizado por WPM)
 * 3. Protección contra distracciones (timeout)
 *
 * Base científica: Response Time as Cognitive Load Indicator
 */

// Velocidad promedio de lectura: 200 palabras/minuto (WPM)
const AVERAGE_WPM = 200;
const MS_PER_MINUTE = 60000;

/**
 * Estima el tiempo de lectura basado en el número de palabras
 * 
 * @param {number} wordCount - Número de palabras en el texto
 * @returns {number} Tiempo estimado en milisegundos
 */
function estimateReadingTimeMs(wordCount) {
  const minutes = wordCount / AVERAGE_WPM;
  return Math.round(minutes * MS_PER_MINUTE);
}

/**
 * Normaliza el tiempo de respuesta restando el tiempo de lectura
 * Resultado: "Tiempo de Decisión" (el que realmente importa)
 * 
 * @param {number} totalResponseTimeMs - Tiempo total desde que se mostró la pregunta
 * @param {number} wordCount - Palabras en la pregunta + opciones
 * @returns {number} Tiempo de decisión normalizado en ms
 */
function normalizeResponseTime(totalResponseTimeMs, wordCount) {
  const estimatedReadingTime = estimateReadingTimeMs(wordCount);
  const decisionTime = Math.max(0, totalResponseTimeMs - estimatedReadingTime);
  return decisionTime;
}

/**
 * Deduce la dificultad desde el tiempo de respuesta normalizado
 * 
 * Niveles:
 * - "immediate" (< 3s): Respuesta instintiva, concepto bien automatizado
 * - "easy" (3-8s): Recuerdo fluido después de búsqueda mental exitosa
 * - "moderate" (8-15s): Procesamiento de opciones o duda breve
 * - "difficult" (> 15s): Lucha cognitiva, límite del olvido
 * 
 * @param {number} normalizedTimeMs - Tiempo de decisión normalizado
 * @param {boolean} isCorrect - ¿Fue la respuesta correcta?
 * @param {number} totalTimeMs - Tiempo total (para detectar distracciones)
 * @returns {Object} { difficulty, level, confidence, reason }
 */
function deduceDifficulty(normalizedTimeMs, isCorrect, totalTimeMs) {
  const normalizedSecs = normalizedTimeMs / 1000;
  const totalSecs = totalTimeMs / 1000;

  // Protección contra distracciones: si tardó >60s, probablemente se distrajo
  if (totalSecs > 60) {
    return {
      difficulty: 'moderate', // Default para no castigar distracciones
      level: 'distraction_detected',
      normalizedSeconds: normalizedSecs,
      confidence: 0.3,
      reason: `Tiempo total ${totalSecs.toFixed(1)}s > 60s. Posible distracción detectada. Se asigna dificultad neutra.`,
      shouldAffectSpacedRepetition: false, // No afecta el algoritmo de repaso
    };
  }

  let difficulty, level, confidence, reason;

  if (normalizedSecs < 3) {
    difficulty = 'immediate';
    level = 1;
    confidence = 0.95;
    reason = '⚡ Respuesta instantánea: concepto en memoria de trabajo';
  } else if (normalizedSecs < 8) {
    difficulty = 'easy';
    level = 2;
    confidence = 0.9;
    reason = '💚 Recuerdo fluido: búsqueda mental exitosa';
  } else if (normalizedSecs < 15) {
    difficulty = 'moderate';
    level = 3;
    confidence = 0.85;
    reason = '🟠 Esfuerzo moderado: procesamiento de opciones';
  } else {
    difficulty = 'difficult';
    level = 4;
    confidence = isCorrect ? 0.7 : 0.9;
    reason = isCorrect 
      ? '🔴 Lucha cognitiva: si acertó, fue por descarte'
      : '❌ Lucha cognitiva: no logró recordar';
  }

  return {
    difficulty,
    level,
    normalizedSeconds: Math.round(normalizedSecs * 10) / 10,
    totalSeconds: Math.round(totalSecs * 10) / 10,
    confidence,
    reason,
    shouldAffectSpacedRepetition: true,
  };
}

/**
 * Calcula la puntuación de velocidad relativa del usuario
 * Compara su tiempo con el promedio de otros usuarios
 * Útil para feedback: "Respondiste 40% más rápido que el mes pasado"
 * 
 * @param {number} userTimeMs - Tiempo del usuario actual
 * @param {number} averageTimeMs - Promedio histórico del usuario
 * @returns {number} Cambio porcentual (-50 = 50% más rápido, +30 = 30% más lento)
 */
function calculateSpeedImprovement(userTimeMs, averageTimeMs) {
  if (averageTimeMs === 0) return 0;
  const percentChange = ((averageTimeMs - userTimeMs) / averageTimeMs) * 100;
  return Math.round(percentChange);
}

/**
 * Genera feedback visual "elegante" (estilo Bento)
 * para mostrar al usuario que la app está midiendo su desempeño
 */
function generateMicroInteractionFeedback(difficulty, isCorrect) {
  const feedbackMap = {
    immediate: {
      color: '#00D9FF', // Cyan
      icon: '⚡',
      message: '¡Veloz!',
      animation: 'ray_pulse', // Efecto de rayo
      duration: 400,
    },
    easy: {
      color: '#10B981', // Verde
      icon: '💚',
      message: '¡Bien!',
      animation: 'soft_pulse',
      duration: 300,
    },
    moderate: {
      color: '#F97316', // Naranja
      icon: '🟠',
      message: '¡Ajustado!',
      animation: 'medium_pulse',
      duration: 300,
    },
    difficult: {
      color: '#EF4444', // Rojo
      icon: '🔴',
      message: '¡Desafío!',
      animation: 'intense_pulse',
      duration: 400,
    },
  };

  const base = feedbackMap[difficulty] || feedbackMap.moderate;

  return {
    ...base,
    borderColor: isCorrect ? base.color : '#888888',
    opacity: isCorrect ? 1 : 0.6,
  };
}

module.exports = {
  estimateReadingTimeMs,
  normalizeResponseTime,
  deduceDifficulty,
  calculateSpeedImprovement,
  generateMicroInteractionFeedback,
  AVERAGE_WPM,
};
