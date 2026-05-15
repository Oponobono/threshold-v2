/**
 * sm2Algorithm.js
 *
 * Implementación del Algoritmo SM-2 (Supermemo 2) para Repetición Espaciada.
 * Base científica: Curve of Forgetting (Ebbinghaus) + Spacing Effect
 *
 * Parámetros:
 * - q: Calidad de la respuesta (0-5)
 *   0 = Completo olvido
 *   1 = Esfuerzo total para recordar
 *   2 = Recuerdo difícil, correctamente
 *   3 = Recuerdo después de dudar
 *   4 = Recordé con cierta dificultad
 *   5 = Recuerdo perfectamente
 *
 * - EF (Ease Factor): Facilidad relativa (default 2.5)
 * - I (Interval): Días hasta el próximo repaso
 * - n (Repetitions): Número de repeticiones exitosas
 */

/**
 * Calcula la nueva calidad (0-5) basada en el rendimiento del usuario
 * deducido automáticamente desde el tiempo de respuesta
 */
function getQualityFromDifficulty(difficulty, isCorrect) {
  if (!isCorrect) return 1; // Si falló, calidad baja

  // Mapear dificultad deducida a calidad SM-2
  const qualityMap = {
    'immediate': 5,      // < 3s: Recuerdo perfecto
    'easy': 4,           // 3-8s: Recuerdo con cierta facilidad
    'moderate': 3,       // 8-15s: Recuerdo después de dudar
    'difficult': 2,      // > 15s: Recuerdo difícil pero correcto
  };

  return qualityMap[difficulty] || 3;
}

/**
 * Algoritmo SM-2: Calcula el nuevo intervalo de repaso
 * 
 * @param {Object} params
 *   - quality: Calidad de la respuesta (0-5)
 *   - easeFactor: EF anterior (default 2.5)
 *   - interval: Intervalo anterior en días
 *   - repetitions: Número de repeticiones exitosas
 * @returns {Object} { newEaseFactor, newInterval, newRepetitions, nextReviewDate }
 */
function calculateSM2(params) {
  const { quality = 3, easeFactor = 2.5, interval = 1, repetitions = 0 } = params;

  let newEaseFactor = easeFactor;
  let newInterval = interval;
  let newRepetitions = repetitions;

  // Fórmula SM-2 para calcular nuevo EF
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Asegurar límites mínimos
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  // Calcular nuevo intervalo basado en repeticiones
  if (quality < 3) {
    // Si calidad baja, reiniciar el proceso
    newRepetitions = 0;
    newInterval = 1;
  } else {
    newRepetitions += 1;

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 3;
    } else {
      // Aplicar EF
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calcular próxima fecha de repaso
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    newEaseFactor: Math.round(newEaseFactor * 100) / 100,
    newInterval,
    newRepetitions,
    nextReviewDate,
    quality,
  };
}

/**
 * FSRS (Free Spaced Repetition Scheduler) - Versión simplificada
 * Más moderno que SM-2, considera múltiples factores
 */
function calculateFSRS(params) {
  const { quality = 3, stability = 1, difficulty = 0.5, interval = 1, repetitions = 0, daysSinceReview = 0 } = params;

  // Factor de retención basado en días desde el último repaso
  const retention = Math.exp(-interval / 36); // Modelo exponencial

  let newDifficulty = Math.max(0.1, Math.min(10, difficulty + 0.1 - quality * 0.02));
  let newStability;
  let newRepetitions = repetitions;

  if (quality < 3) {
    newStability = stability * 0.72;
    newRepetitions = 0; // Reiniciar contador si falló
  } else if (quality === 3) {
    newStability = stability * 1.26;
    newRepetitions += 1;
  } else if (quality === 4) {
    newStability = stability * 1.77;
    newRepetitions += 1;
  } else {
    newStability = stability * 2.36;
    newRepetitions += 1;
  }

  // Nuevo intervalo en días
  const newInterval = Math.round(newStability * 9 * (1 - retention));

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + Math.max(1, newInterval));

  return {
    newStability: Math.round(newStability * 100) / 100,
    newDifficulty: Math.round(newDifficulty * 100) / 100,
    newRepetitions,
    newInterval: Math.max(1, newInterval),
    nextReviewDate,
    retention: Math.round(retention * 100), // % de retención esperada
  };
}

/**
 * Detecta tarjetas "problemáticas" basadas en análisis de múltiples intentos
 * Si 90%+ de usuarios falla una tarjeta → Problema de redacción/complejidad
 */
function detectProblematicCard(stats) {
  const { totalAttempts, failureRate, avgResponseTimeMs } = stats;

  const issues = [];

  // Criterio 1: 90%+ de fallos
  if (totalAttempts >= 10 && failureRate >= 0.9) {
    issues.push({
      type: 'HIGH_FAILURE_RATE',
      severity: 'CRITICAL',
      message: `${(failureRate * 100).toFixed(1)}% de usuarios fallan esta tarjeta. Probable: Pregunta mal redactada o concepto demasiado complejo.`,
    });
  }

  // Criterio 2: Tiempo promedio muy alto (>30s)
  if (avgResponseTimeMs > 30000) {
    issues.push({
      type: 'HIGH_RESPONSE_TIME',
      severity: 'WARNING',
      message: `Tiempo promedio: ${(avgResponseTimeMs / 1000).toFixed(1)}s. Considere fragmentar en micro-tarjetas.`,
    });
  }

  // Criterio 3: Tasa de fallo moderada (60-89%)
  if (totalAttempts >= 5 && failureRate >= 0.6 && failureRate < 0.9) {
    issues.push({
      type: 'MODERATE_DIFFICULTY',
      severity: 'INFO',
      message: `Tasa de fallo: ${(failureRate * 100).toFixed(1)}%. Tarjeta desafiante pero abordable.`,
    });
  }

  return {
    isProblem: issues.length > 0,
    issues,
    recommendation: issues.length > 0 ? 'REVIEW_OR_SPLIT' : 'HEALTHY',
  };
}

module.exports = {
  calculateSM2,
  calculateFSRS,
  getQualityFromDifficulty,
  detectProblematicCard,
};
