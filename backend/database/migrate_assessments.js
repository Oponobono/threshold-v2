const { db } = require('../db');
const { normalizeGrade } = require('../services/gradingEngine');

/**
 * Migration Script para la Fase 2 (Dual-Write / Backfill)
 * Esto rellena la tabla `assessment_results` basado en `assessments` heredados.
 */
async function migrateAssessments() {
  console.log('--- INICIANDO MIGRACIÓN DE NOTAS (FASE 2) ---');

  // Helper para db.all y db.get con Promesas
  const dbAll = (query, params = []) =>
    new Promise((resolve, reject) => db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows)));
  const dbGet = (query, params = []) =>
    new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));
  const dbRun = (query, params = []) =>
    new Promise((resolve, reject) => db.run(query, params, function (err) { err ? reject(err) : resolve(this) }));

  try {
    const users = await dbAll('SELECT id, active_grading_version_id FROM users');

    for (const user of users) {
      let activeVersionId = user.active_grading_version_id;

      // 1. Asignar active_grading_version_id si no tiene
      if (!activeVersionId) {
        // Por defecto usar el sistema colombiano 0-5.0 si no hay grading_scale
        const systemCode = 'COL_0_5';

        const versionRow = await dbGet(`
          SELECT gv.id, gv.min_value, gv.max_value, gv.passing_value, gv.precision, gs.direction 
          FROM grading_versions gv
          JOIN grading_systems gs ON gv.grading_system_id = gs.id
          WHERE gs.code = ? AND CAST(gv.is_active AS INTEGER) = 1
        `, [systemCode]);

        if (versionRow) {
          activeVersionId = versionRow.id;
          await dbRun('UPDATE users SET active_grading_version_id = ? WHERE id = ?', [activeVersionId, user.id]);
          console.log(`Usuario ${user.id} migrado a sistema ${systemCode} (Version ID: ${activeVersionId})`);
        }
      }

      if (!activeVersionId) continue;

      // Cargar la info de la versión activa
      const version = await dbGet(`
        SELECT gv.id, gv.min_value, gv.max_value, gv.passing_value, gv.precision, gs.direction 
        FROM grading_versions gv
        JOIN grading_systems gs ON gv.grading_system_id = gs.id
        WHERE gv.id = ?
      `, [activeVersionId]);

      // 2. Buscar todas sus evaluaciones que tienen alguna nota pero sin assessment_result
      const assessments = await dbAll(`
        SELECT a.id, a.grade_value, a.score, a.out_of, a.percentage
        FROM assessments a
        JOIN subjects s ON a.subject_id = s.id
        LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
        WHERE s.user_id = ? AND ar.id IS NULL AND (a.grade_value IS NOT NULL OR (a.score IS NOT NULL AND a.out_of IS NOT NULL))
      `, [user.id]);

      let count = 0;
      for (const a of assessments) {
        let rawValue = null;

        if (a.grade_value !== null && a.grade_value !== undefined) {
          rawValue = a.grade_value;
        } else if (a.score !== null && a.out_of > 0) {
          rawValue = (a.score / a.out_of) * version.max_value;
        } else if (a.percentage !== null) {
            // Asumir porcentaje si era escala de porcentaje
            if(version.max_value === 100) rawValue = a.percentage;
            else rawValue = (a.percentage / 100) * version.max_value;
        }

        if (rawValue !== null) {
          const normalized = normalizeGrade(rawValue, version);

          // Insertar en assessment_results
          const insertResult = await dbRun(`
            INSERT INTO assessment_results (assessment_id, user_id, raw_value, normalized_value, grading_version_id)
            VALUES (?, ?, ?, ?, ?)
          `, [a.id, user.id, rawValue, normalized, activeVersionId]);

          // Insertar en el audit trail (grade_history)
          await dbRun(`
            INSERT INTO grade_history (assessment_result_id, old_raw_value, new_raw_value, changed_by, reason)
            VALUES (?, NULL, ?, ?, 'Migración Fase 2 - Backfill')
          `, [insertResult.lastID, rawValue, user.id]);

          count++;
        }
      }

      if (count > 0) {
        console.log(`Migradas ${count} evaluaciones para Usuario ${user.id}`);
      }
    }

    console.log('✅ Migración Fase 2 Completada con éxito.');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
  }
}

migrateAssessments();
