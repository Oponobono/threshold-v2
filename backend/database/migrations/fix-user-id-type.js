/**
 * Migration: Fix user_id column types from INTEGER to TEXT
 * The current schema defines all user_id columns as TEXT (for UUIDs),
 * but production PostgreSQL may have been created with INTEGER types
 * from an older schema version. This migration detects and fixes that.
 *
 * Idempotent — safe to run multiple times.
 */

const USER_ID_TABLES = [
  { table: 'subjects',                           column: 'user_id', fk: true },
  { table: 'assessments',                        column: 'user_id', fk: true },
  { table: 'gallery_items',                      column: 'user_id', fk: true },
  { table: 'scanned_documents',                  column: 'user_id', fk: true },
  { table: 'audio_recordings',                   column: 'user_id', fk: true },
  { table: 'youtube_videos',                     column: 'user_id', fk: true },
  { table: 'flashcard_decks',                    column: 'user_id', fk: true },
  { table: 'card_logs',                          column: 'user_id', fk: true },
  { table: 'learning_analytics',                 column: 'user_id', fk: true },
  { table: 'review_predictions',                 column: 'user_id', fk: true },
  { table: 'subject_threshold_overrides',        column: 'user_id', fk: true },
  { table: 'two_factor_auth',                    column: 'user_id', fk: true },
  { table: 'lms_accounts',                       column: 'user_id', fk: true },
  { table: 'feedback_messages',                  column: 'user_id', fk: true },
  { table: 'card_snoozes',                       column: 'user_id', fk: true },
  { table: 'calendar_events',                    column: 'user_id', fk: true },
  { table: 'study_sessions',                     column: 'user_id', fk: true },
  { table: 'group_memberships',                  column: 'user_id', fk: true },
  { table: 'groups',                             column: 'creator_user_id', fk: false },
  { table: 'shared_decks',                       column: 'shared_by_user_id', fk: false },
  { table: 'shared_decks',                       column: 'shared_to_user_id', fk: false },
  { table: 'shared_group_decks',                 column: 'shared_by_user_id', fk: false },
  { table: 'ai_chat_sessions',                   column: 'user_id', fk: true },
  { table: 'grading_periods',                    column: 'user_id', fk: true },
  { table: 'assessment_results',                 column: 'user_id', fk: true },
  { table: 'subject_grade_snapshots',            column: 'user_id', fk: true },
  { table: 'grading_systems',                    column: 'created_by_user_id', fk: false },
];

const fixUserIdTypes = async (pool) => {
  try {
    // ── 1. Check users.id type ───────────────────────────────────────────
    const userColResult = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'id'
    `);

    if (userColResult.rows.length === 0) {
      console.log('[Migration:user_id] users table not found, skipping');
      return;
    }

    const currentIdType = userColResult.rows[0].data_type;
    if (currentIdType === 'text') {
      console.log('[Migration:user_id] users.id is already TEXT — no conversion needed');
      return;
    }

    console.log(`[Migration:user_id] users.id is ${currentIdType} — converting to TEXT...`);

    // ── 2. Find and drop FK constraints referencing users.id ────────────
    const fkResult = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_catalog = kcu.constraint_catalog
        AND tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_catalog = ccu.constraint_catalog
        AND tc.constraint_schema = ccu.constraint_schema
        AND tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND ccu.column_name = 'id'
    `);

    const fkConstraints = fkResult.rows;
    console.log(`[Migration:user_id] Found ${fkConstraints.length} FK constraints referencing users.id`);

    for (const fk of fkConstraints) {
      try {
        await pool.query(`ALTER TABLE ${fk.table_name} DROP CONSTRAINT ${fk.constraint_name}`);
        console.log(`  ✓ Dropped FK ${fk.constraint_name} on ${fk.table_name}`);
      } catch (err) {
        console.warn(`  ⚠ Could not drop FK ${fk.constraint_name}: ${err.message}`);
      }
    }

    // ── 3. Alter users.id to TEXT ───────────────────────────────────────
    await pool.query(`ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text`);
    console.log('  ✓ Converted users.id to TEXT');

    // ── 4. Alter all user_id columns to TEXT ─────────────────────────────
    for (const { table, column } of USER_ID_TABLES) {
      try {
        const colResult = await pool.query(`
          SELECT data_type FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column]);

        if (colResult.rows.length === 0) {
          continue;
        }

        if (colResult.rows[0].data_type !== 'text') {
          await pool.query(
            `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE TEXT USING ${column}::text`
          );
          console.log(`  ✓ Converted ${table}.${column} to TEXT`);
        }
      } catch (err) {
        console.warn(`  ⚠ Could not convert ${table}.${column}: ${err.message}`);
      }
    }

    // ── 5. Re-add FK constraints (only for tables that had them) ─────────
    for (const { table, column, fk } of USER_ID_TABLES) {
      if (!fk) continue;
      try {
        // Check if constraint already exists
        const existingFk = await pool.query(`
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = $1 AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE $2
        `, [table, `%${table}_${column}_fkey%`]);

        if (existingFk.rows.length > 0) continue;

        await pool.query(
          `ALTER TABLE ${table} ADD FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE CASCADE`
        );
        console.log(`  ✓ Re-added FK on ${table}(${column})`);
      } catch (err) {
        console.warn(`  ⚠ Could not re-add FK on ${table}(${column}): ${err.message}`);
      }
    }

    console.log('[Migration:user_id] ✅ User ID type migration complete');
  } catch (err) {
    console.error('[Migration:user_id] Error:', err.message);
  }
};

module.exports = { fixUserIdTypes };
