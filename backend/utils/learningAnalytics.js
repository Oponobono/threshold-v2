/**
 * learningAnalytics.js
 *
 * Crea mapas de dominio, analiza tendencias y genera predicciones
 * de repaso basadas en Big Data de los usuarios.
 *
 * Base científica: Learning Analytics + Predictive Modeling
 */

/**
 * Calcula el porcentaje de dominio en un tema
 * Basado en: éxito/intento, velocidad, consistencia
 * 
 * @param {Object} stats
 *   - correctReviews: Número de respuestas correctas
 *   - totalReviews: Total de intentos
 *   - avgResponseTimeMs: Tiempo promedio de respuesta
 *   - recentPerformance: Array de últimos 10 resultados [true/false]
 * @returns {number} Porcentaje de dominio (0-100)
 */
function calculateMastery(stats) {
  const { correctReviews = 0, totalReviews = 0, avgResponseTimeMs = 0, recentPerformance = [] } = stats;

  // Componente 1: Tasa de éxito (40%)
  const successRate = totalReviews > 0 ? correctReviews / totalReviews : 0;

  // Componente 2: Consistencia reciente (30%)
  // últimas 10 respuestas: si todas correctas = 100%, si alternadas = 50%, etc.
  const recentCorrect = recentPerformance.filter(r => r).length;
  const consistencyScore = recentPerformance.length > 0 ? recentCorrect / recentPerformance.length : 0;

  // Componente 3: Velocidad (30%)
  // Benchmark: < 8s normalizado = velocidad óptima
  const optimalTimeMs = 8000;
  const speedScore = Math.min(1, optimalTimeMs / Math.max(optimalTimeMs, avgResponseTimeMs));

  const masteryPercentage = (successRate * 0.4 + consistencyScore * 0.3 + speedScore * 0.3) * 100;
  return Math.round(masteryPercentage);
}

/**
 * Crea un "Mapa de Dominio" para mostrar fortalezas y debilidades
 * Datos para un gráfico de radar (Chakra/Recharts)
 * 
 * @param {Array} subjectAnalytics
 *   - Array de { subject_id, subject_name, mastery_percentage }
 * @returns {Object} Estructura para gráfico radar
 */
function createDomainMap(subjectAnalytics) {
  const categories = subjectAnalytics.map(s => ({
    name: s.subject_name,
    value: s.mastery_percentage,
    color: getMasteryColor(s.mastery_percentage),
  }));

  // Calcular estadísticas globales
  const avgMastery = categories.reduce((sum, c) => sum + c.value, 0) / categories.length;
  const strongestArea = categories.reduce((a, b) => a.value > b.value ? a : b);
  const weakestArea = categories.reduce((a, b) => a.value < b.value ? a : b);

  return {
    radar: categories,
    averageMastery: Math.round(avgMastery),
    strongestArea: { name: strongestArea.name, value: strongestArea.value },
    weakestArea: { name: weakestArea.name, value: weakestArea.value },
    recommendation: weakestArea.value < 50 
      ? `Enfócate en ${weakestArea.name} (${weakestArea.value}% dominio)`
      : `Estás bien equilibrado. Refuerza ${weakestArea.name} para mejorar`,
  };
}

/**
 * Retorna color basado en nivel de dominio
 */
function getMasteryColor(percentage) {
  if (percentage >= 80) return '#10B981'; // Verde
  if (percentage >= 60) return '#3B82F6'; // Azul
  if (percentage >= 40) return '#F97316'; // Naranja
  if (percentage >= 20) return '#EF4444'; // Rojo
  return '#7C3AED'; // Morado (muy bajo)
}

/**
 * Predice cuándo el usuario debería repasar un concepto
 * Basado en: SM-2 + patrón de olvido + frecuencia histórica
 * 
 * @param {Object} cardHistory
 *   - nextReviewDate: Próxima fecha calculada por SM-2
 *   - avgDaysSinceReview: Promedio histórico de días entre repasos
 *   - lastReviewDate: Última vez que revisó
 * @returns {Object} { predictedDate, confidence, notification }
 */
function predictReviewTiming(cardHistory) {
  const { nextReviewDate, avgDaysSinceReview = 5, lastReviewDate } = cardHistory;

  // Ajuste adaptativo: si el usuario típicamente repasa cada 5 días,
  // pero SM-2 dice 10, usar promedio ponderado
  const daysSinceLast = lastReviewDate 
    ? Math.floor((Date.now() - lastReviewDate) / (1000 * 60 * 60 * 24))
    : 0;

  const predictedDate = new Date(nextReviewDate);
  
  // Si ya pasó la fecha de repaso, es urgente
  const isOverdue = daysSinceLast > parseInt(nextReviewDate);
  
  return {
    predictedDate,
    isOverdue,
    daysSinceLast,
    confidence: 0.8 + (Math.min(daysSinceLast, avgDaysSinceReview) / avgDaysSinceReview) * 0.2,
    notification: isOverdue 
      ? `⚠️ Urgente: Repasa este concepto ahora. Hace ${daysSinceLast} días que no lo ves.`
      : `Dentro de ${Math.max(0, Math.ceil((predictedDate - Date.now()) / (1000 * 60 * 60 * 24)))} días`,
  };
}

/**
 * Analiza datos agregados para detectar tarjetas problemáticas globalmente
 * Si 90%+ de usuarios falla → Problema de redacción
 * Si >30s promedio → Muy densa (fragmentar)
 * 
 * @param {Array} cardStatsArray
 *   - Array de { cardId, totalAttempts, failureRate, avgResponseTimeMs }
 * @returns {Array} Lista de tarjetas con flag de problema
 */
function identifyProblematicCards(cardStatsArray) {
  return cardStatsArray
    .map(stats => ({
      ...stats,
      issues: detectCardIssues(stats),
      recommendation: stats.failureRate > 0.9 ? 'REWRITE' : 
                     stats.avgResponseTimeMs > 30000 ? 'SPLIT_ATOMIC' :
                     stats.failureRate > 0.6 ? 'CLARIFY' : 'OK',
    }))
    .filter(card => card.issues.length > 0)
    .sort((a, b) => b.failureRate - a.failureRate);
}

function detectCardIssues(stats) {
  const { totalAttempts, failureRate, avgResponseTimeMs } = stats;
  const issues = [];

  if (totalAttempts >= 10 && failureRate >= 0.9) {
    issues.push('Critical: 90%+ fallos');
  }
  if (avgResponseTimeMs > 30000) {
    issues.push(`Dense: ${(avgResponseTimeMs/1000).toFixed(1)}s avg`);
  }
  if (totalAttempts >= 5 && failureRate >= 0.6) {
    issues.push(`Challenging: ${(failureRate*100).toFixed(0)}% fallos`);
  }

  return issues;
}

/**
 * Genera un reporte de progreso para mostrar al usuario
 * "Estás respondiendo preguntas de Cálculo 40% más rápido"
 * 
 * @param {Object} comparison
 *   - currentAvgTimeMs: Tiempo promedio actual
 *   - previousAvgTimeMs: Tiempo promedio del mes anterior
 *   - subject: Nombre del tema
 * @returns {string} Mensaje de feedback
 */
function generateProgressReport(comparison) {
  const { currentAvgTimeMs, previousAvgTimeMs, subject } = comparison;

  if (previousAvgTimeMs === 0) {
    return `Comenzaste a estudiar ${subject}. ¡Sigue así!`;
  }

  const improvement = ((previousAvgTimeMs - currentAvgTimeMs) / previousAvgTimeMs) * 100;

  if (improvement > 30) {
    return `🚀 ¡Increíble! Respondiste preguntas de ${subject} ${improvement.toFixed(0)}% más rápido este mes.`;
  } else if (improvement > 10) {
    return `✅ Buen progreso. Respondiste ${improvement.toFixed(0)}% más rápido en ${subject}.`;
  } else if (improvement > 0) {
    return `📈 Leve mejora. Sigue repasando ${subject}.`;
  } else if (improvement < -20) {
    return `⚠️ Tu velocidad bajó en ${Math.abs(improvement).toFixed(0)}%. Considera tomar un descanso o revisar el concepto.`;
  } else {
    return `Mantuviste un ritmo consistente en ${subject}. Perfecto para aprendizaje sostenible.`;
  }
}

module.exports = {
  calculateMastery,
  createDomainMap,
  predictReviewTiming,
  identifyProblematicCards,
  generateProgressReport,
  getMasteryColor,
};
