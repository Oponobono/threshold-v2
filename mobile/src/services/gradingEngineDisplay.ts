/**
 * Grading Engine Display Helpers
 *
 * Capa de REPRESENTACIÓN — NO calcula autoridad matemática.
 * El backend es la única fuente de cálculo. Este módulo formatea
 * valores ya procesados para renderizado en la UI.
 *
 * INVARIANT: Las equivalencias mostradas llevan siempre el símbolo ≈
 * y se marcan con is_unofficial_equivalency = true.
 */

import type { GradingSystem, GradingScale, GradeEquivalency } from './api/grading';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DisplayGrade {
  /** Valor original en la escala del usuario, ej: "4.5" */
  raw: string;
  /** Rango completo, ej: "4.5 / 5.0" */
  full: string;
  /** Etiqueta de la escala activa, ej: "Sobresaliente" */
  label: string;
  /** Equivalencia aproximada en GPA, ej: "≈ GPA 3.7" */
  gpaApprox: string | null;
  /** Equivalencia aproximada en letras, ej: "≈ A-" */
  letterApprox: string | null;
  /** Color asociado a la escala */
  color: string;
  /** Si la nota es aprobatoria */
  isPassing: boolean;
  /** Siempre true — estas equivalencias no son oficiales */
  isUnofficialEquivalency: boolean;
}

export interface DisplayProgress {
  /** Porcentaje normalizado [0-100] para barras de progreso */
  percent: number;
  /** Texto formateado para mostrar en UI, ej: "90%" */
  percentText: string;
}

export type RoundingMode = 'nearest' | 'floor' | 'ceil' | 'bankers';

// ─── Formatters ────────────────────────────────────────────────────────────────

/**
 * Formatea un raw_value según la precisión del sistema.
 * Nunca realiza cálculos matemáticos de conversión.
 */
export function formatRawValue(
  rawValue: number,
  system: Pick<GradingSystem, 'precision' | 'max_value'>
): string {
  const precision = system.precision ?? 2;
  return rawValue.toFixed(precision);
}

/**
 * Construye el string "4.5 / 5.0" para mostrar nota completa.
 */
export function formatFullGrade(
  rawValue: number,
  system: Pick<GradingSystem, 'max_value' | 'precision'>
): string {
  const precision = system.precision ?? 2;
  return `${rawValue.toFixed(precision)} / ${system.max_value.toFixed(precision)}`;
}

/**
 * Dado un normalized_value y las escalas de una versión,
 * encuentra la escala correspondiente para obtener label y color.
 *
 * IMPORTANTE: Sólo busca el rango; no realiza cálculos de conversión.
 */
export function findScaleForNormalized(
  normalizedValue: number,
  scales: GradingScale[]
): GradingScale | null {
  if (!scales || scales.length === 0) return null;

  // Convertir a porcentaje para comparar con min_score/max_score de la escala
  const asPercent = normalizedValue * 100;
  const sorted = [...scales].sort((a, b) => a.sort_order - b.sort_order);

  for (const scale of sorted) {
    if (asPercent >= scale.min_score && asPercent <= scale.max_score) {
      return scale;
    }
  }

  // Fallback: el rango más cercano (para valores en el borde exacto)
  let closest: GradingScale | null = null;
  let minDist = Infinity;
  for (const scale of sorted) {
    const mid = (scale.min_score + scale.max_score) / 2;
    const dist = Math.abs(asPercent - mid);
    if (dist < minDist) {
      minDist = dist;
      closest = scale;
    }
  }
  return closest;
}

/**
 * Construye el objeto DisplayGrade completo a partir de los datos
 * ya calculados por el backend.
 *
 * @param rawValue          - Nota cruda (no modifica)
 * @param normalizedValue   - Valor normalizado [0-1] (del backend)
 * @param system            - Información del sistema de calificación
 * @param scales            - Escalas de la versión activa
 * @param equivalency       - Equivalencias opcionales del backend (is_unofficial_equivalency)
 */
export function buildDisplayGrade(
  rawValue: number,
  normalizedValue: number,
  system: GradingSystem,
  scales: GradingScale[],
  equivalency?: GradeEquivalency | null
): DisplayGrade {
  const scale = findScaleForNormalized(normalizedValue, scales);
  const precision = system.precision ?? 2;

  const gpaApprox =
    equivalency?.gpa_equivalent != null
      ? `≈ GPA ${equivalency.gpa_equivalent.toFixed(1)}`
      : null;

  const letterApprox =
    equivalency?.display_short_label
      ? `≈ ${equivalency.display_short_label}`
      : null;

  return {
    raw: rawValue.toFixed(precision),
    full: `${rawValue.toFixed(precision)} / ${system.max_value.toFixed(precision)}`,
    label: scale?.label ?? equivalency?.label ?? '—',
    gpaApprox,
    letterApprox,
    color:
      scale?.display_color ?? scale?.color ?? equivalency?.color ?? '#9E9E9E',
    isPassing: scale?.is_passing ?? equivalency?.is_passing ?? false,
    isUnofficialEquivalency: true,
  };
}

/**
 * Convierte normalized_value a DisplayProgress para barras de progreso.
 */
export function buildDisplayProgress(normalizedValue: number): DisplayProgress {
  const percent = Math.round(normalizedValue * 100);
  return {
    percent,
    percentText: `${percent}%`,
  };
}

/**
 * Helper de color semántico para chips, badges o indicadores.
 * Devuelve un nivel de severidad para estilos adaptativos.
 */
export function getGradeSemanticLevel(
  isPassing: boolean,
  normalizedValue: number
): 'excellent' | 'good' | 'passing' | 'failing' {
  if (!isPassing) return 'failing';
  if (normalizedValue >= 0.9) return 'excellent';
  if (normalizedValue >= 0.75) return 'good';
  return 'passing';
}

/**
 * Genera un string de accesibilidad / aria-label para el resultado.
 * Ej: "Nota: 4.5 de 5.0 — Sobresaliente — Aprobado"
 */
export function buildAccessibilityLabel(grade: DisplayGrade): string {
  const status = grade.isPassing ? 'Aprobado' : 'Reprobado';
  const equiv = [grade.gpaApprox, grade.letterApprox]
    .filter(Boolean)
    .join(' · ');
  return `Nota: ${grade.full} — ${grade.label}${equiv ? ' · ' + equiv : ''} — ${status}`;
}
