/**
 * grades.ts
 *
 * Utilidades matemáticas y de formateo para el cálculo académico (Threshold).
 * Incluye funciones puras para parsear fechas, normalizar pesos y calificaciones,
 * y calcular porcentajes de progreso.
 */
import { Assessment } from '../services/api';

/** Escala máxima de calificación utilizada en la plataforma (ej. 5.0) */
export const SCALE_MAX = 5;

/** Extrae un timestamp (ms) seguro a partir de una fecha en formato string (YYYY-MM-DD o DD-MM-YYYY) */
export const parseDate = (value?: string | null) => {
  if (!value) return 0;
  const parts = value.split(/[-/]/).map(Number);
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    const [first, second, third] = parts;
    const isDdMmYyyy = first > 12 || second > 12;
    const day = isDdMmYyyy ? first : third;
    const month = isDdMmYyyy ? second : first;
    const year = isDdMmYyyy ? third : second;
    const candidate = new Date(year, month - 1, day);
    if (!Number.isNaN(candidate.getTime())) return candidate.getTime();
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
};

/** Parsea el peso porcentual de una evaluación, limpiando símbolos '%' y normalizando escalas (0-1 a 0-100) */
export const parseWeight = (assessment: Assessment) => {
  if (typeof assessment.percentage === 'number') return assessment.percentage;
  if (typeof assessment.weight === 'number') {
    return assessment.weight <= 1 && assessment.weight > 0 ? assessment.weight * 100 : assessment.weight;
  }
  if (!assessment.weight) return 0;
  const cleaned = String(assessment.weight).replace('%', '').trim();
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 1 && numeric > 0) return numeric * 100;
  return numeric;
};

/** Normaliza la nota obtenida a la escala máxima definida en `SCALE_MAX` */
export const normalizeGrade = (assessment: Assessment) => {
  if (typeof assessment.grade_value === 'number') {
    if (assessment.grade_value > SCALE_MAX * 2) {
      return (assessment.grade_value / 100) * SCALE_MAX;
    }
    return assessment.grade_value;
  }
  if (typeof assessment.normalized_value === 'number') {
    return assessment.normalized_value * SCALE_MAX;
  }
  if (typeof assessment.score === 'number' && typeof assessment.out_of === 'number' && assessment.out_of > 0) {
    return (assessment.score / assessment.out_of) * SCALE_MAX;
  }
  return null;
};

/** Calcula el progreso/desempeño de una evaluación como un porcentaje del 0 al 100 */
export const getAssessmentProgress = (assessment: Assessment) => {
  if (typeof assessment.normalized_value === 'number') {
    return assessment.normalized_value * 100;
  }
  if (typeof assessment.score === 'number' && typeof assessment.out_of === 'number' && assessment.out_of > 0) {
    return (assessment.score / assessment.out_of) * 100;
  }
  if (typeof assessment.grade_value === 'number') {
    const gv = assessment.grade_value;
    if (gv > SCALE_MAX * 2) {
      return (gv / 100) * 100;
    }
    return (gv / SCALE_MAX) * 100;
  }
  return 0;
};

/** Formatea un valor numérico de calificación a un string con 1 decimal */
export const formatGrade = (value: number) => value.toFixed(1);
