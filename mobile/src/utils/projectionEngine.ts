import { Assessment, Subject, UserProfile } from '../services/api';
import { normalizeGrade, parseWeight, SCALE_MAX } from './grades';

export interface ProjectionResult {
  currentAverage: number;
  currentEMA: number;
  projectedGrade: number;
  delta: number;
  evaluatedWeight: number;
  remainingWeight: number;
  targetGrade: number;
}

const EMA_SMOOTHING_FACTOR = 2 / (3 + 1); // α = 0.5 (periodo N=3)

/**
 * Calcula Exponential Moving Average sobre una serie de notas ordenadas por fecha.
 * Da más peso a las evaluaciones recientes para detectar tendencias.
 */
function calculateEMA(grades: number[]): number {
  if (grades.length === 0) return 0;
  let ema = grades[0];
  for (let i = 1; i < grades.length; i++) {
    ema = grades[i] * EMA_SMOOTHING_FACTOR + ema * (1 - EMA_SMOOTHING_FACTOR);
  }
  return ema;
}

/**
 * Calcula la proyección académica del lado del cliente.
 * Útil cuando el usuario está offline y no puede consultar el servidor.
 *
 * Estrategia:
 * - currentAverage: promedio ponderado actual (igual que en useSubjectGrades)
 * - currentEMA: media móvil exponencial sobre la serie cronológica de notas
 * - projectedGrade: proyección usando EMA como tendencia:
 *     currentAverage + (currentEMA - currentAverage) * (remainingWeight / 100)
 *     Si no hay peso restante, projectedGrade = currentAverage
 * - delta: projectedGrade - targetGrade
 * - evaluatedWeight: % del curso ya evaluado
 * - remainingWeight: % restante
 */
export function calculateProjection(
  assessments: Assessment[],
  selectedSubject: Subject | null,
  profile: UserProfile | null,
): ProjectionResult {
  const graded = assessments.filter((a) => normalizeGrade(a) !== null);

  const evaluatedWeight = graded.reduce((sum, a) => sum + parseWeight(a), 0);
  const remainingWeight = Math.max(0, 100 - evaluatedWeight);

  const accumulatedPoints = graded.reduce((sum, a) => {
    const grade = normalizeGrade(a) || 0;
    const weight = parseWeight(a) || 0;
    return sum + grade * (weight / 100);
  }, 0);

  const currentAverage = evaluatedWeight > 0
    ? accumulatedPoints / (evaluatedWeight / 100)
    : graded.length > 0
      ? graded.reduce((sum, a) => sum + (normalizeGrade(a) || 0), 0) / graded.length
      : 0;

  const targetGrade = (() => {
    const subjectTarget = selectedSubject?.target_grade;
    if (typeof subjectTarget === 'number' && subjectTarget > 0) return subjectTarget;
    const fallbackThreshold = profile?.approval_threshold;
    if (typeof fallbackThreshold === 'number' && fallbackThreshold > 0) {
      return fallbackThreshold > SCALE_MAX ? fallbackThreshold / 20 : fallbackThreshold;
    }
    return 3.0;
  })();

  // Calcular EMA: ordenar cronológicamente y extraer notas normalizadas
  const sortedGrades: number[] = [...graded]
    .sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateA - dateB;
    })
    .map((a) => normalizeGrade(a))
    .filter((g): g is number => g !== null);

  const currentEMA = sortedGrades.length > 0 ? calculateEMA(sortedGrades) : currentAverage;

  // Proyección: ajustar el promedio actual con la tendencia del EMA
  const projectedGrade = evaluatedWeight > 0 && remainingWeight > 0
    ? currentAverage + (currentEMA - currentAverage) * (remainingWeight / 100)
    : currentAverage;

  const delta = projectedGrade - targetGrade;

  return {
    currentAverage,
    currentEMA,
    projectedGrade,
    delta,
    evaluatedWeight,
    remainingWeight,
    targetGrade,
  };
}
