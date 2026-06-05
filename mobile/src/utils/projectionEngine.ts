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

/**
 * EMA alpha=0.35 — idéntico al backend gradingEngine.js (ALPHA = 0.35)
 * Fórmula: EMA_t = (grade_t * 0.35) + (EMA_t-1 * 0.65)
 */
const EMA_ALPHA = 0.35;

/**
 * Calcula Exponential Moving Average sobre una serie de notas ordenadas por fecha.
 * Usa alpha=0.35 para coincidir exactamente con el backend gradingEngine.js
 */
function calculateEMA(grades: number[]): number {
  if (grades.length === 0) return 0;
  let ema = grades[0];
  for (let i = 1; i < grades.length; i++) {
    ema = grades[i] * EMA_ALPHA + ema * (1 - EMA_ALPHA);
  }
  return ema;
}

/**
 * Calcula la proyección académica del lado del cliente.
 *
 * Alineada con backend/services/gradingEngine.js `calculateProjectedGrade`:
 *  - EMA alpha = 0.35
 *  - NP = (PA × evaluatedWeight) + (EMA × remainingWeight)  [pesos 0-1]
 *  - delta = projectedGrade − currentAverage  (igual al backend)
 */
export function calculateProjection(
  assessments: Assessment[],
  selectedSubject: Subject | null,
  profile: UserProfile | null,
): ProjectionResult {
  const graded = assessments.filter((a) => normalizeGrade(a) !== null);

  // Peso total evaluado (en %, luego se convierte a fracción 0-1 para la proyección)
  const evaluatedWeightPct = graded.reduce((sum, a) => sum + parseWeight(a), 0);
  const remainingWeightPct = Math.max(0, 100 - evaluatedWeightPct);

  // Promedio ponderado actual (PA) — igual que useSubjectGrades
  const accumulatedPoints = graded.reduce((sum, a) => {
    const grade = normalizeGrade(a) || 0;
    const weight = parseWeight(a) || 0;
    return sum + grade * (weight / 100);
  }, 0);

  const currentAverage = evaluatedWeightPct > 0
    ? accumulatedPoints / (evaluatedWeightPct / 100)
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

  // EMA sobre serie cronológica de notas
  const sortedGrades: number[] = [...graded]
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
    .map((a) => normalizeGrade(a))
    .filter((g): g is number => g !== null);

  const currentEMA = sortedGrades.length > 0 ? calculateEMA(sortedGrades) : currentAverage;

  // Convertir pesos a fracción 0-1 (backend trabaja en fracción)
  const evalFrac = Math.min(evaluatedWeightPct / 100, 1);
  const remFrac  = Math.max(0, 1 - evalFrac);

  // Nota Proyectada: NP = (PA × evalFrac) + (EMA × remFrac) — backend formula
  let projectedGrade = evalFrac > 0
    ? (currentAverage * evalFrac) + (currentEMA * remFrac)
    : currentAverage;

  // Clamp a [0, SCALE_MAX]
  projectedGrade = Math.max(0, Math.min(SCALE_MAX, projectedGrade));

  // Delta = NP − PA (igual que backend: projectedGrade - currentAverage)
  const delta = projectedGrade - currentAverage;

  return {
    currentAverage,
    currentEMA,
    projectedGrade,
    delta,
    evaluatedWeight: evaluatedWeightPct,
    remainingWeight: remainingWeightPct,
    targetGrade,
  };
}
