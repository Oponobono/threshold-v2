const { db } = require('../db');
const {
  normalizeGrade,
  denormalizeGrade,
  getEquivalencies,
  appendGradeHistory,
  getActiveVersion,
  getScalesForVersion,
} = require('../services/gradingEngine');

/**
 * GET /api/grading-systems
 * Devuelve todos los sistemas de calificación disponibles (seeded + custom del usuario).
 */
const getGradingSystems = (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT gs.*,
            gv.id as active_version_id,
            gv.min_value, gv.max_value, gv.passing_value, gv.precision,
            gv.owner_type, gv.owner_id
     FROM grading_systems gs
     LEFT JOIN grading_versions gv ON gv.grading_system_id = gs.id
       AND gv.is_active = 1
       AND (gv.owner_type = 'system'
            OR (gv.owner_type = 'user' AND gv.owner_id = ?))
     WHERE gs.is_system_seeded = 1
        OR gs.created_by_user_id = ?
     ORDER BY gs.is_system_seeded DESC, gs.name ASC`,
    [String(userId), userId],
    (err, rows) => {
      if (err) {
        console.error('[GradingController] Error fetching systems:', err.message);
        return res.status(500).json({ error: 'Error obteniendo sistemas de calificación.' });
      }
      res.json({ systems: rows });
    }
  );
};

/**
 * GET /api/grading-systems/:id/scales
 * Devuelve las escalas de la versión activa de un sistema para el usuario actual.
 */
const getSystemScales = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const version = await getActiveVersion(parseInt(id), userId);
    const scales = await getScalesForVersion(version.id);
    res.json({ version, scales });
  } catch (err) {
    console.error('[GradingController] Error fetching scales:', err.message);
    res.status(404).json({ error: err.message });
  }
};

/**
 * POST /api/grading-systems/normalize
 * Normaliza un raw_value para un grading_system_id dado.
 * Usado por el frontend para previews rápidos (no persiste ningún dato).
 *
 * Body: { raw_value, grading_system_id }
 */
const normalizeValue = async (req, res) => {
  try {
    const { raw_value, grading_system_id } = req.body;
    const userId = req.user.id;

    if (raw_value == null || !grading_system_id) {
      return res.status(400).json({ error: 'Se requiere raw_value y grading_system_id.' });
    }

    const version = await getActiveVersion(parseInt(grading_system_id), userId);
    const scales = await getScalesForVersion(version.id);

    const normalized = normalizeGrade(parseFloat(raw_value), version);
    const equivalencies = getEquivalencies(normalized, scales, version.mode);
    const displayValue = denormalizeGrade(normalized, version);

    res.json({
      raw_value: parseFloat(raw_value),
      normalized_value: normalized,
      display_value: displayValue,
      equivalencies,
      grading_version_id: version.id,
    });
  } catch (err) {
    console.error('[GradingController] Error normalizing value:', err.message);
    res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/assessment-results
 * Crea un resultado para un assessment. El normalized_value se calcula y congela aquí.
 *
 * Body: { assessment_id, raw_value, grading_system_id }
 */
const createAssessmentResult = async (req, res) => {
  try {
    const { assessment_id, raw_value, grading_system_id } = req.body;
    const userId = req.user.id;

    if (!assessment_id || raw_value == null || !grading_system_id) {
      return res.status(400).json({ error: 'Se requieren assessment_id, raw_value y grading_system_id.' });
    }

    // Obtener versión activa — snapshot inmutable
    const version = await getActiveVersion(parseInt(grading_system_id), userId);

    // Calcular y congelar el normalized_value
    const normalized = normalizeGrade(parseFloat(raw_value), version);

    db.run(
      `INSERT INTO assessment_results (assessment_id, user_id, raw_value, normalized_value, grading_version_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [assessment_id, userId, raw_value, normalized, version.id],
      function (err) {
        if (err) {
          console.error('[GradingController] Error creating assessment_result:', err.message);
          return res.status(500).json({ error: 'Error guardando resultado.' });
        }
        // Registrar en audit trail (primer insert como creación)
        appendGradeHistory({
          assessmentResultId: this.lastID,
          oldRawValue: null,
          newRawValue: raw_value,
          changedBy: userId,
          reason: 'Creación inicial',
        }).catch(console.error);

        res.status(201).json({
          id: this.lastID,
          assessment_id,
          user_id: userId,
          raw_value,
          normalized_value: normalized,
          grading_version_id: version.id,
        });
      }
    );
  } catch (err) {
    console.error('[GradingController] Error in createAssessmentResult:', err.message);
    res.status(400).json({ error: err.message });
  }
};

/**
 * PUT /api/assessment-results/:id
 * Actualiza el raw_value de un resultado existente.
 * El nuevo normalized_value usa la misma grading_version original (snapshot inmutable).
 * Registra el cambio en grade_history (append-only).
 *
 * Body: { raw_value, reason }
 */
const updateAssessmentResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { raw_value, reason } = req.body;
    const userId = req.user.id;

    if (raw_value == null) {
      return res.status(400).json({ error: 'Se requiere raw_value.' });
    }

    // Obtener el resultado actual
    const current = await new Promise((resolve, reject) => {
      db.get(
        `SELECT ar.*, gv.min_value, gv.max_value, gv.direction, gv.mode, gv.precision
         FROM assessment_results ar
         JOIN grading_versions gv ON gv.id = ar.grading_version_id
         WHERE ar.id = ? AND ar.user_id = ?`,
        [id, userId],
        (err, row) => { if (err) reject(err); else resolve(row); }
      );
    });

    if (!current) return res.status(404).json({ error: 'Resultado no encontrado.' });

    // Recalcular normalized con la MISMA versión original (snapshot)
    const newNormalized = normalizeGrade(parseFloat(raw_value), current);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE assessment_results SET raw_value = ?, normalized_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [raw_value, newNormalized, id],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });

    // Audit trail — APPEND-ONLY
    await appendGradeHistory({
      assessmentResultId: parseInt(id),
      oldRawValue: current.raw_value,
      newRawValue: raw_value,
      changedBy: userId,
      reason: reason || 'Corrección de nota',
    });

    res.json({
      id: parseInt(id),
      raw_value,
      normalized_value: newNormalized,
      grading_version_id: current.grading_version_id,
    });
  } catch (err) {
    console.error('[GradingController] Error in updateAssessmentResult:', err.message);
    res.status(400).json({ error: err.message });
  }
};

/**
 * GET /api/assessment-results/:id/history
 * Devuelve el historial de cambios (audit trail) de un resultado.
 */
const getResultHistory = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.all(
    `SELECT gh.*
     FROM grade_history gh
     JOIN assessment_results ar ON ar.id = gh.assessment_result_id
     WHERE gh.assessment_result_id = ? AND ar.user_id = ?
     ORDER BY gh.changed_at ASC`,
    [id, userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error obteniendo historial.' });
      }
      res.json({ history: rows });
    }
  );
};

module.exports = {
  getGradingSystems,
  getSystemScales,
  normalizeValue,
  createAssessmentResult,
  updateAssessmentResult,
  getResultHistory,
};
