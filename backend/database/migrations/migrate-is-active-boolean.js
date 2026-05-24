/**
 * Migración: Convertir is_active de INTEGER a BOOLEAN en grading_versions (PostgreSQL)
 * 
 * En SQLite permanece como INTEGER por compatibilidad
 * En PostgreSQL se convierte a BOOLEAN
 */

const migrateGradingVersionsBoolean = async (pool) => {
  try {
    // Verificar si estamos en PostgreSQL
    const versionResult = await pool.query("SELECT version()");
    const isPostgres = versionResult && versionResult.rows && versionResult.rows[0];
    
    if (!isPostgres || !versionResult.rows[0].version.includes('PostgreSQL')) {
      console.log('[Migration] No es PostgreSQL, saltando migración de is_active');
      return;
    }

    console.log('[Migration] Iniciando migración de is_active en grading_versions...');

    // Verificar el tipo actual de la columna
    const columnCheckResult = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'grading_versions' AND column_name = 'is_active'
    `);

    if (!columnCheckResult.rows || columnCheckResult.rows.length === 0) {
      console.log('[Migration] Columna is_active no encontrada');
      return;
    }

    const currentType = columnCheckResult.rows[0].data_type;
    console.log(`[Migration] Tipo actual de is_active: ${currentType}`);

    if (currentType === 'boolean') {
      console.log('[Migration] is_active ya es BOOLEAN, no se requiere conversión');
      return;
    }

    // Si es integer, convertir a boolean
    if (currentType === 'integer') {
      console.log('[Migration] Convirtiendo is_active de INTEGER a BOOLEAN...');
      
      // Step 1: Crear columna temporal
      await pool.query(`
        ALTER TABLE grading_versions 
        ADD COLUMN is_active_temp BOOLEAN DEFAULT true
      `);
      console.log('[Migration] ✓ Columna temporal creada');

      // Step 2: Migrar datos (1 -> true, 0 -> false)
      await pool.query(`
        UPDATE grading_versions 
        SET is_active_temp = (CASE WHEN is_active = 1 THEN true ELSE false END)
      `);
      console.log('[Migration] ✓ Datos migrados a columna temporal');

      // Step 3: Eliminar columna original
      await pool.query(`
        ALTER TABLE grading_versions 
        DROP COLUMN is_active
      `);
      console.log('[Migration] ✓ Columna original eliminada');

      // Step 4: Renombrar columna temporal a is_active
      await pool.query(`
        ALTER TABLE grading_versions 
        RENAME COLUMN is_active_temp TO is_active
      `);
      console.log('[Migration] ✓ Columna temporal renombrada a is_active');

      console.log('[Migration] ✅ Migración completada exitosamente');
    } else {
      console.log(`[Migration] Tipo desconocido: ${currentType}, no se realizó conversión`);
    }
  } catch (err) {
    console.error('[Migration] Error en migración de is_active:', err.message);
    console.warn('[Migration] ⚠️  Continuando a pesar del error de migración');
    // No lanzar error para que no bloquee la inicialización del servidor
  }
};

module.exports = { migrateGradingVersionsBoolean };
