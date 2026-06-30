const { db } = require('../../db');

const statements = [
  `ALTER TABLE calendar_events ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE grading_periods ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE lms_accounts ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE subject_threshold_overrides ADD COLUMN sync_version INTEGER DEFAULT 0`,
];

function run(i) {
  if (i >= statements.length) {
    console.log('[Migration] sync_version extension completed');
    process.exit(0);
    return;
  }
  db.run(statements[i], (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error(`[Migration] Error en statement ${i}:`, err.message);
    }
    run(i + 1);
  });
}

run(0);
