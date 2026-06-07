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

      // Drop dependent foreign keys if needed
      if (table === 'audio_recordings') {
        try {
          await pool.query(`ALTER TABLE audio_transcripts DROP CONSTRAINT IF EXISTS audio_transcripts_recording_id_fkey`);
        } catch (e) {
          // Ignore
        }
      }
      if (table === 'assessments') {
        const deps = ['assessment_files', 'assessment_results'];
        for (const dep of deps) {
          try {
            await pool.query(`ALTER TABLE ${dep} DROP CONSTRAINT IF EXISTS ${dep}_assessment_id_fkey`);
          } catch (e) {
            // Ignore
          }
        }
      }

      // Alter column type
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN id TYPE TEXT USING id::text`);
      console.log(`  ✓ Converted ${table}.id to TEXT`);

      // Alter dependent columns and restore foreign keys
      if (table === 'audio_recordings') {
        try {
          await pool.query(`ALTER TABLE audio_transcripts ALTER COLUMN recording_id TYPE TEXT USING recording_id::text`);
          await pool.query(`ALTER TABLE audio_transcripts ADD CONSTRAINT audio_transcripts_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES audio_recordings(id) ON DELETE CASCADE`);
          console.log(`  ✓ Converted audio_transcripts.recording_id to TEXT and restored foreign key`);
        } catch (e) {
          console.log(`  ! Note: Could not update audio_transcripts foreign key: ${e.message}`);
        }
      }
      if (table === 'assessments') {
        for (const dep of ['assessment_files', 'assessment_results']) {
          const col = 'assessment_id';
          try {
            await pool.query(`ALTER TABLE ${dep} ALTER COLUMN ${col} TYPE TEXT USING ${col}::text`);
            await pool.query(`ALTER TABLE ${dep} ADD FOREIGN KEY (${col}) REFERENCES assessments(id) ON DELETE CASCADE`);
            console.log(`  ✓ Converted ${dep}.${col} to TEXT and restored foreign key`);
          } catch (e) {
            console.log(`  ! Note: Could not update ${dep} foreign key: ${e.message}`);
          }
        }
      }
    }

    console.log('[Migration:fix-id] ✅ Primary key id type migration complete');
  } catch (err) {
    console.error('[Migration:fix-id] Error:', err.message);
  }
};

module.exports = { fixIdTypes };
