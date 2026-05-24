/**
 * Migration: Fix is_active column type if it's BOOLEAN
 * Converts it to INTEGER for consistency across databases
 * This is idempotent and safe to run multiple times
 */

const fixIsActiveBooleanToInteger = async (pool) => {
  try {
    // Check if column exists and what type it currently is
    const result = await pool.query(`
      SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'grading_versions' AND column_name = 'is_active'
    `);

    if (result.rows.length === 0) {
      console.log('[Migration] is_active column not found in grading_versions');
      return;
    }

    const currentType = result.rows[0].data_type;
    console.log(`[Migration] Current is_active type: ${currentType}`);

    if (currentType === 'boolean') {
      console.log('[Migration] Converting is_active from BOOLEAN to INTEGER...');
      
      // Step 1: Create a temporary INTEGER column
      await pool.query(`
        ALTER TABLE grading_versions 
        ADD COLUMN is_active_temp INTEGER DEFAULT 1
      `).catch(err => {
        if (!err.message.includes('already exists')) throw err;
        console.log('[Migration] Temporary column already exists, skipping creation');
      });

      // Step 2: Copy data with conversion
      await pool.query(`
        UPDATE grading_versions 
        SET is_active_temp = CASE 
          WHEN is_active = true THEN 1 
          ELSE 0 
        END
      `);

      // Step 3: Drop the old BOOLEAN column
      await pool.query(`
        ALTER TABLE grading_versions 
        DROP COLUMN is_active
      `);

      // Step 4: Rename temporary column
      await pool.query(`
        ALTER TABLE grading_versions 
        RENAME COLUMN is_active_temp TO is_active
      `);

      console.log('[Migration] ✓ Successfully converted is_active from BOOLEAN to INTEGER');
    } else if (currentType === 'integer') {
      console.log('[Migration] is_active is already INTEGER, no conversion needed');
    } else {
      console.log(`[Migration] ⚠ Unexpected type for is_active: ${currentType}`);
    }
  } catch (err) {
    console.error('[Migration] Error fixing is_active type:', err.message);
    // Don't throw - this is a non-critical migration
  }
};

module.exports = { fixIsActiveBooleanToInteger };
