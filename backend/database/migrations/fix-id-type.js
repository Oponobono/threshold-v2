/**
 * Migration: Fix primary key id column types from INTEGER to TEXT
 * 
 * The current schema defines all primary key id columns as TEXT (for UUIDs),
 * but production PostgreSQL may have been created with INTEGER/SERIAL types
 * from an older schema version. This migration detects and fixes that.
 * 
 * Idempotent — safe to run multiple times.
 */

const TABLES_TO_FIX = [
  'users',
  'subjects',
  'assessments',
  'assessment_categories',
  'schedules',
  'flashcard_decks',
  'flashcards',
  'card_logs',
  'study_sessions',
  'photos',
  'audio_recordings',
  'audio_transcripts',
  'youtube_videos',
  'youtube_transcripts',
  'scanned_documents',
  'calendar_events',
  'learning_analytics',
  'card_difficulty_analytics',
  'review_predictions',
  'subject_threshold_overrides',
  'card_snoozes',
  'group_memberships',
  'groups',
  'shared_decks',
  'shared_group_decks',
  'ai_chat_sessions',
  'ai_chat_messages',
  'grading_systems',
  'grading_versions',
  'grading_scales',
  'grading_periods',
  'grade_history',
  'subject_grade_snapshots'
];

const getReferencingFks = async (pool, table) => {
  const result = await pool.query(`
    SELECT
      tc.table_name AS child_table,
      kcu.column_name AS child_column,
      tc.constraint_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_catalog = kcu.constraint_catalog
      AND tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_catalog = ccu.constraint_catalog
      AND tc.constraint_schema = ccu.constraint_schema
      AND tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_catalog = rc.constraint_catalog
      AND tc.constraint_schema = rc.constraint_schema
      AND tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = $1
      AND ccu.column_name = 'id'
  `, [table]);
  return result.rows;
};

const fixIdTypes = async (pool) => {
  try {
    for (const table of TABLES_TO_FIX) {
      const colResult = await pool.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'id'
      `, [table]);

      if (colResult.rows.length === 0) {
        console.log(`[Migration:fix-id] ${table} table not found, skipping`);
        continue;
      }

      const currentType = colResult.rows[0].data_type;
      if (currentType === 'text') {
        console.log(`[Migration:fix-id] ${table}.id is already TEXT — skipping`);
        continue;
      }

      console.log(`[Migration:fix-id] ${table}.id is ${currentType} — converting to TEXT...`);

      // Drop default if it uses a sequence (SERIAL)
      try {
        await pool.query(`ALTER TABLE ${table} ALTER COLUMN id DROP DEFAULT`);
        console.log(`  ✓ Dropped DEFAULT on ${table}.id`);
      } catch (err) {
        // No default to drop is fine
      }

      // Dynamically discover and drop all FKs referencing this table's id
      const fks = await getReferencingFks(pool, table);
      for (const fk of fks) {
        try {
          await pool.query(`ALTER TABLE ${fk.child_table} DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`);
          console.log(`  ✓ Dropped FK ${fk.constraint_name} on ${fk.child_table}`);
        } catch (e) {
          // Ignore if already gone
        }
      }

      // Alter column type
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN id TYPE TEXT USING id::text`);
      console.log(`  ✓ Converted ${table}.id to TEXT`);

      // Alter child columns and restore FKs
      for (const fk of fks) {
        try {
          const childColResult = await pool.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name = $1 AND column_name = $2
          `, [fk.child_table, fk.child_column]);

          const childType = childColResult.rows[0]?.data_type;
          if (childType && childType !== 'text') {
            await pool.query(
              `ALTER TABLE ${fk.child_table} ALTER COLUMN ${fk.child_column} TYPE TEXT USING ${fk.child_column}::text`
            );
          }
          const deleteRule = fk.delete_rule === 'NO ACTION' ? '' : ` ON DELETE ${fk.delete_rule}`;
          await pool.query(
            `ALTER TABLE ${fk.child_table} ADD FOREIGN KEY (${fk.child_column}) REFERENCES ${table}(id)${deleteRule}`
          );
          console.log(`  ✓ Converted ${fk.child_table}.${fk.child_column} and restored FK ${fk.constraint_name}`);
        } catch (e) {
          console.log(`  ! Note: Could not update FK on ${fk.child_table}.${fk.child_column}: ${e.message}`);
        }
      }
    }

    console.log('[Migration:fix-id] ✅ Primary key id type migration complete');
  } catch (err) {
    console.error('[Migration:fix-id] Error:', err.message);
  }
};

module.exports = { fixIdTypes };
