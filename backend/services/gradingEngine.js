/**
 * Grading Engine — Única Autoridad Matemática del Sistema de Calificaciones
 *
 * INVARIANTS (ver grading_invariants.md):
 *  - El backend es la única fuente de cálculos matemáticos.
 *  - Los valores normalizados se congelan al momento de creación.
 *  - grade_history es append-only: nunca se actualiza, solo se insertan registros.
 *  - Las equivalencias son aproximaciones (is_unofficial_equivalency = true).
 *
 * Fórmulas de Normalización:
 *   Ascendente: (raw - min) / (max - min)
 *   Descendente: 1 - ((raw - min) / (max - min))
 */

const { db } = require('../db');

// ─── Rounding ──────────────────────────────────────────────────────────────────

const ROUNDING_MODES = {
  nearest: (val, precision) => parseFloat(val.toFixed(precision)),
  ceil: (val, precision) => {
    const factor = Math.pow(10, precision);
    return Math.ceil(val * factor) / factor;
  },
  floor: (val, precision) => {
    const factor = Math.pow(10, precision);
    return Math.floor(val * factor) / factor;
  },
  bankers: (val, precision) => {
    // Round half to even (Banker's rounding)
    const factor = Math.pow(10, precision);
    const shifted = val * factor;
    const floor = Math.floor(shifted);
    const diff = shifted - floor;
    if (Math.abs(diff - 0.5) < Number.EPSILON) {
      return (floor % 2 === 0 ? floor : floor + 1) / factor;
    }
    return Math.round(shifted) / factor;
  }
};

/**
 * Aplica la política de redondeo jerárquica:
 *   System Default → Grading Version Override → User Display Preference
 */
function applyRounding(value, mode = 'nearest', precision = 5) {
  const roundFn = ROUNDING_MODES[mode] || ROUNDING_MODES.nearest;
  return roundFn(value, precision);
}

// ─── Normalización ─────────────────────────────────────────────────────────────

/**
 * Convierte un raw_value al rango [0.0, 1.0] usando la dirección del sistema.
 *
 * @param {number} rawValue   - Valor crudo del estudiante (ej: 4.5)
 * @param {object} version    - Registro de grading_version { min_value, max_value, direction, precision }
 * @param {string} roundMode  - Modo de redondeo: 'nearest' | 'ceil' | 'floor' | 'bankers'
 * @returns {number}          - Valor normalizado en DECIMAL(6,5) ej: 0.90000
 */
function normalizeGrade(rawValue, version, roundMode = 'nearest') {
  if (!version || version.max_value === undefined || version.max_value === null) {
    throw new Error('GradingEngine: max_value es requerido para normalización.');
  }

  const direction = version.direction || 'ascending';
  const raw = parseFloat(rawValue);
  const min = parseFloat(version.min_value || 0);
  const max = parseFloat(version.max_value);

  if (isNaN(raw) || isNaN(max)) {
    throw new Error('GradingEngine: raw_value o max_value no son números válidos.');
  }

  if (max === min) {
    throw new Error('GradingEngine: max_value y min_value no pueden ser iguales.');
  }

  if (raw < min || raw > max) {
    throw new Error(
      `GradingEngine: raw_value ${raw} está fuera del rango [${min}, ${max}].`
    );
  }

  let normalized;
  if (direction === 'descending') {
    // Sistema invertido (ej. Alemania: 1 = mejor, 5 = peor)
    normalized = 1 - (raw - min) / (max - min);
  } else {
    // Sistema ascendente (ej. Colombia: 5.0 = mejor)
    normalized = (raw - min) / (max - min);
  }

  // Guardar con 5 decimales (DECIMAL(6,5)) — nunca usar float nativo como verdad final
  return applyRounding(normalized, roundMode, 5);
}

/**
 * Convierte un normalized_value de vuelta a la escala original.
 *
 * @param {number} normalizedValue - Valor normalizado [0.0, 1.0]
 * @param {object} version         - Registro de grading_version
 * @param {string} roundMode
 * @returns {number}               - Valor en la escala original
 */
function denormalizeGrade(normalizedValue, version, roundMode = 'nearest') {
  const { min_value, max_value, direction = 'ascending', precision = 2 } = version;
  const min = parseFloat(min_value);
  const max = parseFloat(max_value);
  const norm = parseFloat(normalizedValue);

  let raw;
  if (direction === 'descending') {
    raw = max - norm * (max - min);
  } else {
    raw = min + norm * (max - min);
  }

  return applyRounding(raw, roundMode, parseInt(precision));
}

// ─── Equivalencias (is_unofficial_equivalency = true) ─────────────────────────

/**
 * Obtiene la escala (label, gpa_equivalent, etc.) para un normalized_value
 * dado los rangos de un grading_version. Para sistemas 'discrete', busca el
 * rango exacto. Para sistemas 'continuous', interpola la etiqueta.
 *
 * Las equivalencias devueltas son SIEMPRE aproximadas (is_unofficial_equivalency).
 *
 * @param {number} normalizedValue
 * @param {Array}  scales            - Array de grading_scales ordenadas por sort_order
 * @param {string} mode              - 'continuous' | 'discrete'
 * @returns {object|null}
 */
function getEquivalencies(normalizedValue, scales, mode = 'continuous', version = null) {
  if (!scales || scales.length === 0) return null;

  const norm = parseFloat(normalizedValue);

  // Denormalize to the version's raw scale so we compare against
  // min_score/max_score stored in the same unit as the scale definition.
  let referenceValue;
  if (version) {
    referenceValue = denormalizeGrade(normalizedValue, version);
  } else {
    // Fallback: treat as percentage (legacy behavior for US_LETTER 0-100)
    referenceValue = norm * 100;
  }

  const sorted = [...scales].sort((a, b) => a.sort_order - b.sort_order);

  let matched = null;
  for (const scale of sorted) {
    if (referenceValue >= parseFloat(scale.min_score) && referenceValue <= parseFloat(scale.max_score)) {
      matched = scale;
      break;
    }
  }

  if (!matched && mode === 'continuous') {
    let minDistance = Infinity;
    for (const scale of sorted) {
      const midpoint = (parseFloat(scale.min_score) + parseFloat(scale.max_score)) / 2;
      const distance = Math.abs(referenceValue - midpoint);
      if (distance < minDistance) {
        minDistance = distance;
        matched = scale;
      }
    }
  }

  if (!matched) return null;

  return {
    label: matched.label,
    display_short_label: matched.display_short_label || matched.label,
    gpa_equivalent: matched.gpa_equivalent,
    color: matched.display_color || matched.color,
    is_passing: !!matched.is_passing,
    is_unofficial_equivalency: true,
  };
}

// ─── Audit Trail (Append-Only) ─────────────────────────────────────────────────

/**
 * Registra un cambio de nota en grade_history (APPEND-ONLY).
 * Esta función jamás actualiza registros existentes, solo inserta.
 *
 * @param {object} params
 * @param {number} params.assessmentResultId
 * @param {number} params.oldRawValue
 * @param {number} params.newRawValue
 * @param {number} params.changedBy    - user_id del actor
 * @param {string} params.reason
 */
function appendGradeHistory({ assessmentResultId, oldRawValue, newRawValue, changedBy, reason }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO grade_history (assessment_result_id, old_raw_value, new_raw_value, changed_by, changed_at, reason)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [assessmentResultId, oldRawValue, newRawValue, changedBy, reason || null],
      (err) => {
        if (err) {
          console.error('[GradingEngine] Error appending grade_history:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

// ─── Helpers públicos ──────────────────────────────────────────────────────────

/**
 * Obtiene la versión activa de un sistema de calificaciones para un usuario.
 * Jerarquía: versión personalizada del usuario → versión global del sistema.
 *
 * @param {number} gradingSystemId
 * @param {number|null} userId
 * @returns {Promise<object>}
 */
function getActiveVersion(gradingSystemId, userId = null) {
  return new Promise((resolve, reject) => {
    let query, params;

    if (userId) {
      // Primero buscar versión personalizada del usuario
      query = `
        SELECT gv.*, gs.direction, gs.mode, gs.code as system_code
        FROM grading_versions gv
        JOIN grading_systems gs ON gs.id = gv.grading_system_id
        WHERE gv.grading_system_id = ?
          AND COALESCE(CAST(gv.is_active AS INTEGER), 0) = 1
          AND ((gv.owner_type = 'user' AND gv.owner_id = ?)
               OR gv.owner_type = 'system')
        ORDER BY CASE WHEN gv.owner_type = 'user' THEN 0 ELSE 1 END
        LIMIT 1
      `;
      params = [gradingSystemId, String(userId)];
    } else {
      query = `
        SELECT gv.*, gs.direction, gs.mode, gs.code as system_code
        FROM grading_versions gv
        JOIN grading_systems gs ON gs.id = gv.grading_system_id
        WHERE gv.grading_system_id = ? AND COALESCE(CAST(gv.is_active AS INTEGER), 0) = 1 AND gv.owner_type = 'system'
        LIMIT 1
      `;
      params = [gradingSystemId];
    }

    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error(`No se encontró versión activa para el sistema ${gradingSystemId}`));
      resolve(row);
    });
  });
}

/**
 * Obtiene las escalas de una grading_version.
 */
function getScalesForVersion(versionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM grading_scales WHERE grading_version_id = ? ORDER BY sort_order ASC`,
      [versionId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

/**
 * calculateProjectedGrade
 * 
 * Implementa las fórmulas de Analytics Educativo para predicción de desempeño.
 * 
 * FÓRMULAS:
 * 1. Promedio Actual (PA): SUM(Grade_i * Weight_i) / SUM(Weight_i)
 * 2. EMA (Tendencia): (Latest_Grade * 0.35) + (Previous_EMA * 0.65)
 * 3. Nota Proyectada (NP): (PA * Evaluated_Weight) + (EMA * Remaining_Weight)
 *    - Clamped a [0, Max_Scale]
 * 4. Delta: NP - PA
 * 
 * Entrada:
 *   - gradedAssessments: Array de evaluaciones {grade_value, weight}, ordenadas por fecha
 *   - maxScale: Valor máximo de calificación (ej. 5.0)
 * 
 * Salida:
 *   {
 *     currentAverage: Promedio Actual ponderado (0 a maxScale),
 *     currentEMA: Tendencia reciente con EMA (0 a maxScale),
 *     projectedGrade: Nota Proyectada (0 a maxScale),
 *     delta: Diferencia (projectedGrade - currentAverage),
 *     evaluatedWeight: Porcentaje evaluado (0 a 1),
 *     remainingWeight: Porcentaje restante (0 a 1)
 *   }
 */
function calculateProjectedGrade(gradedAssessments = [], maxScale = 5.0) {
  const ALPHA = 0.35; // Factor de suavizado EMA (constante)

  // VALIDACIÓN MÍNIMA
  if (!Array.isArray(gradedAssessments) || gradedAssessments.length === 0) {
    return {
      currentAverage: 0,
      currentEMA: 0,
      projectedGrade: 0,
      delta: 0,
      evaluatedWeight: 0,
      remainingWeight: 1,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PASO 1: Extraer notas y pesos
  // ─────────────────────────────────────────────────────────────────
  const grades = gradedAssessments.map(a => parseFloat(a.grade_value) || 0);
  const weights = gradedAssessments.map(a => parseFloat(a.weight) || 0);

  // ─────────────────────────────────────────────────────────────────
  // PASO 2: CÁLCULO DEL PROMEDIO ACTUAL (PA)
  // Fórmula: PA = SUM(Grade_i * Weight_i) / SUM(Weight_i)
  // ─────────────────────────────────────────────────────────────────
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let currentAverage = 0;

  if (totalWeight > 0) {
    const weightedSum = grades.reduce((sum, g, i) => sum + g * weights[i], 0);
    currentAverage = weightedSum / totalWeight;
  }

  console.log(`[GradingEngine] 📊 PA Calculation:`, {
    grades,
    weights,
    totalWeight,
    currentAverage,
  });

  // ─────────────────────────────────────────────────────────────────
  // PASO 3: CÁLCULO DEL EMA (Tendencia Reciente)
  // Fórmula: EMA_t = (Latest_Grade * 0.35) + (Previous_EMA * 0.65)
  // Nota: Iterar cronológicamente desde la primera nota
  // ─────────────────────────────────────────────────────────────────
  let currentEMA = grades[0] || 0; // Inicializar con la primera nota

  for (let i = 1; i < grades.length; i++) {
    currentEMA = (grades[i] * ALPHA) + (currentEMA * (1 - ALPHA));
  }

  console.log(`[GradingEngine] 📊 EMA Calculation:`, {
    firstGrade: grades[0],
    finalEMA: currentEMA,
    ALPHA,
  });

  // ─────────────────────────────────────────────────────────────────
  // PASO 4: CÁLCULO DE PESOS (Evaluado vs Restante)
  // ─────────────────────────────────────────────────────────────────
  // Asumir que los pesos están en porcentaje (0-100) o (0-1)
  // Si están en porcentaje (> 1), normalizar a decimales
  let evaluatedWeight = totalWeight;
  if (evaluatedWeight > 1) {
    evaluatedWeight = evaluatedWeight / 100;
  }
  const remainingWeight = Math.max(0, 1.0 - evaluatedWeight);

  // ─────────────────────────────────────────────────────────────────
  // PASO 5: CÁLCULO DE NOTA PROYECTADA (NP)
  // Fórmula: NP = (PA * Evaluated_Weight) + (EMA * Remaining_Weight)
  // ─────────────────────────────────────────────────────────────────
  let projectedGrade = (currentAverage * evaluatedWeight) + (currentEMA * remainingWeight);

  console.log(`[GradingEngine] 📊 NP Calculation:`, {
    currentAverage,
    evaluatedWeight,
    currentEMA,
    remainingWeight,
    projectedGrade,
  });

  // ─────────────────────────────────────────────────────────────────
  // PASO 6: CLAMP (Restricción Matemática)
  // Projected_Grade nunca puede exceder Max_Scale
  // ─────────────────────────────────────────────────────────────────
  currentAverage = Math.max(0, Math.min(maxScale, currentAverage));
  currentEMA = Math.max(0, Math.min(maxScale, currentEMA));
  projectedGrade = Math.max(0, Math.min(maxScale, projectedGrade));

  // ─────────────────────────────────────────────────────────────────
  // PASO 7: CÁLCULO DEL DELTA (Puntuación Adicional para UI)
  // Fórmula: Delta = NP - PA
  // ─────────────────────────────────────────────────────────────────
  const delta = projectedGrade - currentAverage;

  console.log(`[GradingEngine] 📊 DELTA Calculation:`, {
    projectedGrade,
    currentAverage,
    delta,
    'delta should be': `${projectedGrade} - ${currentAverage} = ${delta}`,
  });

  return {
    currentAverage: parseFloat(currentAverage.toFixed(2)),
    currentEMA: parseFloat(currentEMA.toFixed(2)),
    projectedGrade: parseFloat(projectedGrade.toFixed(2)),
    delta: parseFloat(delta.toFixed(2)),
    evaluatedWeight: parseFloat(evaluatedWeight.toFixed(4)),
    remainingWeight: parseFloat(remainingWeight.toFixed(4)),
  };
}

module.exports = {
  normalizeGrade,
  denormalizeGrade,
  getEquivalencies,
  appendGradeHistory,
  getActiveVersion,
  getScalesForVersion,
  applyRounding,
  calculateProjectedGrade,
};
