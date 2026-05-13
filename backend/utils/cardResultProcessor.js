/**
 * cardResultProcessor.js
 *
 * Orquestador central: Cuando un usuario responde una tarjeta,
 * este módulo coordina:
 * 1. Deducción de dificultad por tiempo
 * 2. Cálculo SM-2 de próximo repaso
 * 3. Actualización de analítica
 * 4. Detección de tarjetas problemáticas
 *
 * Este es el "corazón" de la ingeniería de aprendizaje
 */

const sm2Algorithm = require('./sm2Algorithm');
const difficultyDeduction = require('./difficultyDeduction');
const learningAnalytics = require('./learningAnalytics');
const { detectCardIssues } = require('./learningAnalytics');

/**
 * Procesa el resultado de un usuario respondiendo una tarjeta
 * 
 * @param {Object} params
 *   - cardId: ID de la tarjeta
 *   - userId: ID del usuario
 *   - subjectId: ID del tema
 *   - isCorrect: ¿Respondió correctamente?
 *   - responseTimeMs: Tiempo total desde presentación hasta respuesta
 *   - questionWordCount: Palabras en la pregunta (para normalizar)
 *   - currentCard: { sm2_ease_factor, sm2_interval, sm2_repetitions, word_count, ... }
 * @returns {Object} Cambios de estado + feedback
 */
async function processCardResult(params) {
  const {
    cardId,
    userId,
    subjectId,
    isCorrect,
    responseTimeMs,
    questionWordCount,
    currentCard,
  } = params;

  // Paso 1: Normalizar tiempo de respuesta (restar tiempo de lectura)
  const normalizedTimeMs = difficultyDeduction.normalizeResponseTime(
    responseTimeMs,
    questionWordCount
  );

  // Paso 2: Deducir dificultad
  const difficultyData = difficultyDeduction.deduceDifficulty(
    normalizedTimeMs,
    isCorrect,
    responseTimeMs
  );

  // Paso 3: Generar feedback visual (micro-interacción)
  const microInteraction = difficultyDeduction.generateMicroInteractionFeedback(
    difficultyData.difficulty,
    isCorrect
  );

  // Paso 4: Calcular SM-2 para próximo repaso
  const quality = sm2Algorithm.getQualityFromDifficulty(
    difficultyData.difficulty,
    isCorrect
  );

  const sm2Result = sm2Algorithm.calculateSM2({
    quality,
    easeFactor: currentCard.sm2_ease_factor || 2.5,
    interval: currentCard.sm2_interval || 1,
    repetitions: currentCard.sm2_repetitions || 0,
  });

  // Paso 5: Preparar actualizaciones para la BD
  const cardUpdate = {
    sm2_ease_factor: sm2Result.newEaseFactor,
    sm2_interval: sm2Result.newInterval,
    sm2_repetitions: sm2Result.newRepetitions,
    next_review_date: sm2Result.nextReviewDate,
  };

  const logEntry = {
    card_id: cardId,
    user_id: userId,
    result: isCorrect ? 'correct' : 'incorrect',
    response_time_ms: responseTimeMs,
    difficulty_deduced: difficultyData.difficulty,
    normalized_time_ms: normalizedTimeMs,
    text_length_words: questionWordCount,
  };

  // Paso 6: Feedback pedagógico inteligente
  const feedback = generateFeedback({
    isCorrect,
    difficulty: difficultyData.difficulty,
    quality,
    improvement: difficultyData.normalizedSeconds,
  });

  return {
    success: true,
    // Para actualizar BD
    cardUpdate,
    logEntry,
    // Para mostrar al usuario
    microInteraction,
    feedback,
    // Para monitoreo
    metrics: {
      difficulty: difficultyData.difficulty,
      normalizedSeconds: difficultyData.normalizedSeconds,
      quality,
      nextReviewDate: sm2Result.nextReviewDate,
      shouldAffectSpacedRepetition: difficultyData.shouldAffectSpacedRepetition,
    },
  };
}

/**
 * Genera feedback pedagógico inteligente
 * Basado en: Corrección, dificultad, calidad de respuesta
 */
function generateFeedback(data) {
  const { isCorrect, difficulty, quality, improvement } = data;

  const feedbackMap = {
    correct_immediate: {
      emoji: '⚡',
      message: '¡Excelente! Dominas perfectamente este concepto.',
      suggestion: 'Este concepto está bien asimilado. Pasa a nuevos desafíos.',
    },
    correct_easy: {
      emoji: '💚',
      message: '¡Correcto! Tienes el concepto claro.',
      suggestion: 'Sigue repasando para automatizar la respuesta.',
    },
    correct_moderate: {
      emoji: '🟠',
      message: '¡Acertaste! Pero te costó trabajo.',
      suggestion: 'Necesitas más repaso. Mañana te lo mostraremos de nuevo.',
    },
    correct_difficult: {
      emoji: '🔴',
      message: '¡Lo lograste, pero fue difícil! Buen esfuerzo.',
      suggestion: 'Este concepto necesita refuerzo. Lo repasaremos pronto.',
    },
    incorrect_immediate: {
      emoji: '❌',
      message: 'Incorrecto. Pensabas que lo sabías, pero necesita revisión.',
      suggestion: 'Repasa el concepto fundamental antes de intentar de nuevo.',
    },
    incorrect_easy: {
      emoji: '⚠️',
      message: 'Incorrecto. Hay confusión con este concepto.',
      suggestion: 'Revisa la explicación y los conceptos relacionados.',
    },
    incorrect_moderate: {
      emoji: '❌',
      message: 'Incorrecto. Está más complejo de lo que creías.',
      suggestion: 'Tómate tiempo para estudiar, luego intenta de nuevo.',
    },
    incorrect_difficult: {
      emoji: '💪',
      message: 'Incorrecto. Este es un concepto desafiante.',
      suggestion: 'Normal que sea difícil. Sigue practicando sin presión.',
    },
  };

  const key = `${isCorrect ? 'correct' : 'incorrect'}_${difficulty}`;
  return feedbackMap[key] || feedbackMap.correct_moderate;
}

/**
 * Integración: Actualiza tablas analytics después de cada resultado
 * Llamar esto después de guardar logEntry en card_logs
 * 
 * @param {Object} db - Conexión a BD
 * @param {number} userId
 * @param {number} subjectId
 * @param {number} cardId
 */
async function updateAnalyticsAfterResult(db, userId, subjectId, cardId) {
  // Helper to wrap db calls in promises
  const dbGet = (query, params) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
  });
  const dbAll = (query, params) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
  const dbRun = (query, params) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) { err ? reject(err) : resolve(this); });
  });

  // Paso 1: Obtener datos agregados del usuario-tema
  const analytics = await dbGet(
    `SELECT * FROM learning_analytics WHERE user_id = ? AND subject_id = ?`,
    [userId, subjectId]
  );

  // Paso 2: Obtener últimos 10 resultados del usuario en este tema
  const recentResults = await dbAll(
    `SELECT result FROM card_logs 
     WHERE user_id = ? AND card_id IN (
       SELECT id FROM flashcards WHERE subject_id = ?
     ) 
     ORDER BY timestamp DESC LIMIT 10`,
    [userId, subjectId]
  );

  // Paso 3: Recalcular totales
  const allResults = await dbAll(
    `SELECT result FROM card_logs 
     WHERE user_id = ? AND card_id IN (
       SELECT id FROM flashcards WHERE subject_id = ?
     )`,
    [userId, subjectId]
  );

  const totalReviews = allResults.length;
  const correctReviews = allResults.filter(r => r.result === 'correct').length;
  const incorrectReviews = totalReviews - correctReviews;

  // Paso 4: Calcular tiempo promedio
  const timings = await dbAll(
    `SELECT response_time_ms FROM card_logs 
     WHERE user_id = ? AND card_id IN (
       SELECT id FROM flashcards WHERE subject_id = ?
     ) AND response_time_ms IS NOT NULL`,
    [userId, subjectId]
  );

  const avgResponseTimeMs = timings.length > 0
    ? Math.round(timings.reduce((sum, t) => sum + t.response_time_ms, 0) / timings.length)
    : 0;

  // Paso 5: Calcular dominio
  const masteryPercentage = learningAnalytics.calculateMastery({
    correctReviews,
    totalReviews,
    avgResponseTimeMs,
    recentPerformance: recentResults.map(r => r.result === 'correct'),
  });

  // Paso 6: Upsert en learning_analytics
  if (analytics) {
    await dbRun(
      `UPDATE learning_analytics 
       SET total_cards = ?, total_reviews = ?, correct_reviews = ?, 
           incorrect_reviews = ?, avg_response_time_ms = ?, 
           mastery_percentage = ?, last_updated = CURRENT_TIMESTAMP
       WHERE user_id = ? AND subject_id = ?`,
      [
        totalReviews, // Simplificación: contar tarjetas únicas después
        totalReviews,
        correctReviews,
        incorrectReviews,
        avgResponseTimeMs,
        masteryPercentage,
        userId,
        subjectId,
      ]
    );
  } else {
    await dbRun(
      `INSERT INTO learning_analytics 
       (user_id, subject_id, total_reviews, correct_reviews, incorrect_reviews, 
        avg_response_time_ms, mastery_percentage, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, subjectId, totalReviews, correctReviews, incorrectReviews, avgResponseTimeMs, masteryPercentage]
    );
  }

  // Paso 7: Actualizar card_difficulty_analytics para detectar problemas
  const cardStats = await dbGet(
    `SELECT 
       COUNT(*) as total_attempts,
       SUM(CASE WHEN result = 'incorrect' THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as failure_rate,
       AVG(response_time_ms) as avg_response_time_ms
     FROM card_logs WHERE card_id = ?`,
    [cardId]
  );

  // Safeguard: si no hay log previo (que sí lo hay, porque lo insertamos arriba)
  if (cardStats && cardStats.total_attempts > 0) {
    const issues = detectCardIssues(cardStats);
    const isProblem = issues.length > 0 ? 1 : 0;

    const existingCardAnalytics = await dbGet(
      `SELECT id FROM card_difficulty_analytics WHERE card_id = ?`,
      [cardId]
    );

    if (existingCardAnalytics) {
      await dbRun(
        `UPDATE card_difficulty_analytics 
         SET total_attempts = ?, failure_rate = ?, avg_response_time_ms = ?,
             problem_flag = ?, last_analyzed = CURRENT_TIMESTAMP
         WHERE card_id = ?`,
        [cardStats.total_attempts, cardStats.failure_rate, cardStats.avg_response_time_ms, isProblem, cardId]
      );
    } else {
      await dbRun(
        `INSERT INTO card_difficulty_analytics 
         (card_id, total_attempts, failure_rate, avg_response_time_ms, problem_flag)
         VALUES (?, ?, ?, ?, ?)`,
        [cardId, cardStats.total_attempts, cardStats.failure_rate, cardStats.avg_response_time_ms, isProblem]
      );
    }

    return {
      analytics: {
        masteryPercentage,
        totalReviews,
        correctReviews,
        avgResponseTimeMs,
      },
      cardQuality: {
        isProblem,
        issues,
      },
    };
  }

  return {
    analytics: {
      masteryPercentage,
      totalReviews,
      correctReviews,
      avgResponseTimeMs,
    },
    cardQuality: { isProblem: 0, issues: [] },
  };
}

module.exports = {
  processCardResult,
  updateAnalyticsAfterResult,
  generateFeedback,
};
