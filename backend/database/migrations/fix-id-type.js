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
  'photos',
  'audio_recordings',
  'scanned_documents',
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

      // Alter column type
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN id TYPE TEXT USING id::text`);
      console.log(`  ✓ Converted ${table}.id to TEXT`);
    }

    console.log('[Migration:fix-id] ✅ Primary key id type migration complete');
  } catch (err) {
    console.error('[Migration:fix-id] Error:', err.message);
  }
};

module.exports = { fixIdTypes };
