const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'backend/database/database.sqlite');
const db = new sqlite3.Database(dbPath);

// Test user ID
const userId = 1;

console.log('Testing grading systems query...');

db.all(
  `SELECT gs.*,
          gv.id as active_version_id,
          gv.min_value, gv.max_value, gv.passing_value, gv.precision,
          gv.owner_type, gv.owner_id
   FROM grading_systems gs
   LEFT JOIN grading_versions gv ON gv.grading_system_id = gs.id
     AND (gv.is_active = true OR gv.is_active = 1)
     AND (gv.owner_type = 'system'
          OR (gv.owner_type = 'user' AND gv.owner_id = ?))
   WHERE gs.is_system_seeded = 1
      OR gs.created_by_user_id = ?
   ORDER BY gs.is_system_seeded DESC, gs.name ASC`,
  [String(userId), userId],
  (err, rows) => {
    if (err) {
      console.error('Error:', err.message);
      console.error('Error code:', err.code);
    } else {
      console.log('Success! Found', rows.length, 'rows:');
      console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
  }
);