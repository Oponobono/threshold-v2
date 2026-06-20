/**
 * Migration: Fix subject_id column types from INTEGER to TEXT
 * The current schema defines subject_id columns as TEXT (for UUIDs),
 * but production PostgreSQL may have been created with INTEGER types
 * from an older schema version. This migration detects and fixes that.
 *
 * Idempotent — safe to run multiple times.
 */

const SUBJECT_ID_TABLES = [
  { table: 'photos',                           column: 'subject_id', fk: true },
  { table: 'assessments',                      column: 'subject_id', fk: true },
  { table: 'scanned_documents',                column: 'subject_id', fk: true },
  { table: 'audio_recordings',                 column: 'subject_id', fk: true },
  { table: 'youtube_videos',                   column: 'subject_id', fk: true },
  { table: 'flashcard_decks',                  column: 'subject_id', fk: true },
  { table: 'learning_analytics',               column: 'subject_id', fk: true },

  { table: 'subject_threshold_overrides',      column: 'subject_id', fk: true },
  { table: 'subject_grade_snapshots',          column: 'subject_id', fk: true },
  { table: 'calendar_events',                  column: 'subject_id', fk: true },
  { table: 'study_sessions',                   column: 'subject_id', fk: true },
  { table: 'schedules',                        column: 'subject_id', fk: true },
  { table: 'assessment_categories',            column: 'subject_id', fk: true },
];

const fixSubjectIdTypes = async (pool) => {
  try {
    // ── 1. Check subjects.id type ───────────────────────────────────────────
    const subjectColResult = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'subjects' AND column_name = 'id'
    `);

    if (subjectColResult.rows.length === 0) {
      console.log('[Migration:subject_id] subjects table not found, skipping');
      return;
    }

    const currentIdType = subjectColResult.rows[0].data_type;
    if (currentIdType === 'text') {
      console.log('[Migration:subject_id] subjects.id is already TEXT');
    } else {
      console.log(`[Migration:subject_id] subjects.id is ${currentIdType} — converting to TEXT...`);
      // Find and drop FK constraints referencing subjects.id
      const fkResult = await pool.query(`
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_catalog = ccu.constraint_catalog
          AND tc.constraint_schema = ccu.constraint_schema
          AND tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'subjects' AND ccu.column_name = 'id'
      `);

      for (const fk of fkResult.rows) {
        try {
          await pool.query(`ALTER TABLE ${fk.table_name} DROP CONSTRAINT ${fk.constraint_name}`);
          console.log(`  ✓ Dropped FK ${fk.constraint_name} on ${fk.table_name}`);
        } catch (err) {
          console.warn(`  ⚠ Could not drop FK ${fk.constraint_name}: ${err.message}`);
        }
      }

      await pool.query(`ALTER TABLE subjects ALTER COLUMN id TYPE TEXT USING id::text`);
      console.log('  ✓ Converted subjects.id to TEXT');
    }

    // ── 2. Alter all subject_id columns to TEXT ─────────────────────────────
    for (const { table, column } of SUBJECT_ID_TABLES) {
      try {
        const colResult = await pool.query(`
          SELECT data_type FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column]);

        if (colResult.rows.length === 0) {
          continue;
        }

        if (colResult.rows[0].data_type !== 'text') {
          // Drop FK if it exists on the column itself
          try {
              await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_${column}_fkey`);
          } catch(e) {}
          
          await pool.query(
            `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE TEXT USING ${column}::text`
          );
          console.log(`  ✓ Converted ${table}.${column} to TEXT`);
        }
      } catch (err) {
        console.warn(`  ⚠ Could not convert ${table}.${column}: ${err.message}`);
      }
    }

    // ── 3. Re-add FK constraints (only for tables that had them) ─────────
    for (const { table, column, fk } of SUBJECT_ID_TABLES) {
      if (!fk) continue;
      try {
        // Check that the column actually exists before re-adding FK
        const colExists = await pool.query(`
          SELECT 1 FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column]);
        if (colExists.rows.length === 0) {
          console.log(`  - Skipping FK re-add on ${table}(${column}): column does not exist`);
          continue;
        }

        // Check if constraint already exists
        const existingFk = await pool.query(`
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = $1 AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE $2
        `, [table, `%${table}_${column}_fkey%`]);

        if (existingFk.rows.length > 0) continue;

        let onDelete = 'CASCADE';
        if (table === 'scanned_documents' || table === 'youtube_videos' || table === 'assessment_categories') {
           onDelete = 'SET NULL';
        }

        if (table === 'schedules') {
           onDelete = 'NO ACTION'; // or let it default, in schema it's just REFERENCES subjects(id)
        }

        await pool.query(
          `ALTER TABLE ${table} ADD FOREIGN KEY (${column}) REFERENCES subjects(id) ON DELETE ${onDelete}`
        );
        console.log(`  ✓ Re-added FK on ${table}(${column})`);
      } catch (err) {
        console.warn(`  ⚠ Could not re-add FK on ${table}(${column}): ${err.message}`);
      }
    }

    console.log('[Migration:subject_id] ✅ Subject ID type migration complete');
  } catch (err) {
    console.error('[Migration:subject_id] Error:', err.message);
  }
};

module.exports = { fixSubjectIdTypes };
