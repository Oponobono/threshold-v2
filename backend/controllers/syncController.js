const { db } = require('../db');

function getCurrentSyncVersion() {
  return new Promise((resolve) => {
    db.get('SELECT version FROM sync_version WHERE id = 1', [], (err, row) => {
      if (err || !row) return resolve(0);
      resolve(row.version);
    });
  });
}

exports.initialSync = (req, res) => {
  const userId = req.user.id;
  const traceId = req.headers['x-trace-id'] || null;
  if (traceId) console.log(`[SyncController][${traceId}] initialSync started`);

  const queries = {
    user: `SELECT * FROM users WHERE id = ?`,
    courses: `SELECT * FROM courses WHERE user_id = ?`,
    subjects: `SELECT * FROM subjects WHERE user_id = ?`,
    assessments: `SELECT * FROM assessments WHERE user_id = ?`,
    schedules: `SELECT * FROM schedules WHERE user_id = ?`,
    flashcardDecks: `SELECT * FROM flashcard_decks WHERE user_id = ?`,
    calendarEvents: `SELECT * FROM calendar_events WHERE user_id = ?`,
    gradingPeriods: `SELECT * FROM grading_periods WHERE user_id = ?`,
    lmsAccounts: `SELECT * FROM lms_accounts WHERE user_id = ?`,
    thresholdOverrides: `SELECT * FROM subject_threshold_overrides WHERE user_id = ?`,
    photos: `SELECT * FROM photos WHERE user_id = ?`,
    audioRecordings: `SELECT * FROM audio_recordings WHERE user_id = ?`,
    scannedDocuments: `SELECT * FROM scanned_documents WHERE user_id = ?`,
  };

  const runQuery = (sql) => {
    return new Promise((resolve, reject) => {
      db.all(sql, [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  };

  const runGet = (sql) => {
    return new Promise((resolve, reject) => {
      db.get(sql, [userId], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  };

  Promise.all([
    runGet(queries.user),
    runQuery(queries.courses),
    runQuery(queries.subjects),
    runQuery(queries.assessments),
    runQuery(queries.schedules),
    runQuery(queries.flashcardDecks),
    runQuery(queries.calendarEvents),
    runQuery(queries.gradingPeriods),
    runQuery(queries.lmsAccounts),
    runQuery(queries.thresholdOverrides),
    runQuery(queries.photos),
    runQuery(queries.audioRecordings),
    runQuery(queries.scannedDocuments),
    getCurrentSyncVersion(),
  ])
    .then(async ([user, courses, subjects, assessments, schedules, flashcardDecks, calendarEvents, gradingPeriods, lmsAccounts, thresholdOverrides, photos, audioRecordings, scannedDocuments, syncVersion]) => {
      const flashcards = [];
      for (const deck of flashcardDecks) {
        const cards = await new Promise((resolve) => {
          db.all('SELECT * FROM flashcards WHERE deck_id = ?', [deck.id], (err, rows) => {
            resolve(rows || []);
          });
        });
        flashcards.push({ deck, cards });
      }

      if (traceId) console.log(`[SyncController][${traceId}] initialSync completed — ${Object.keys(queries).length} entities, version ${syncVersion}`);

      res.json({
        syncVersion,
        traceId,
        generatedAt: new Date().toISOString(),
        payload: {
          user,
          courses,
          subjects,
          assessments,
          schedules,
          flashcards,
          calendar_events: calendarEvents,
          grading_periods: gradingPeriods,
          lms_accounts: lmsAccounts,
          subject_threshold_overrides: thresholdOverrides,
          photos,
          audio_recordings: audioRecordings,
          scanned_documents: scannedDocuments,
        },
      });
    })
    .catch((err) => {
      console.error(`[SyncController]${traceId ? '[' + traceId + ']' : ''} Error en initialSync:`, err);
      res.status(500).json({ error: err.message, traceId });
    });
};

exports.deltaSync = (req, res) => {
  const userId = req.user.id;
  const version = parseInt(req.query.version, 10) || 0;
  const traceId = req.headers['x-trace-id'] || null;
  if (traceId) console.log(`[SyncController][${traceId}] deltaSync started — version=${version}`);

  const tables = ['courses', 'subjects', 'assessments', 'schedules', 'flashcard_decks', 'calendar_events', 'grading_periods', 'lms_accounts', 'subject_threshold_overrides', 'photos', 'audio_recordings', 'scanned_documents'];
  const updated = {};
  const deleted = [];

  let completed = 0;
  const total = tables.length + 2;

  tables.forEach((table) => {
    const query = `SELECT * FROM ${table} WHERE user_id = ? AND sync_version > ?`;
    db.all(query, [userId, version], (err, rows) => {
      if (err) {
        console.error(`[SyncController] Error en deltaSync para ${table}:`, err);
        updated[table] = [];
      } else {
        updated[table] = rows || [];
      }
      completed++;
      if (completed === total) respond();
    });
  });

  const delQuery = `SELECT entity_type, entity_id, deleted_at FROM sync_deletions WHERE user_id = ? AND deleted_at > ?`;
  db.all(delQuery, [userId, new Date(version > 0 ? version : 0).toISOString()], (err, rows) => {
    if (!err) {
      for (const row of rows || []) {
        deleted.push({ entityType: row.entity_type, entityId: row.entity_id, deletedAt: row.deleted_at });
      }
    }
    completed++;
    if (completed === total) respond();
  });

  getCurrentSyncVersion().then((syncVersion) => {
    completed++;
    if (completed === total) respond(syncVersion);
  });

  function respond(syncVersion) {
    const updatedCount = Object.values(updated).reduce((s, arr) => s + arr.length, 0);
    if (traceId) console.log(`[SyncController][${traceId}] deltaSync completed — ${updatedCount} updated, ${deleted.length} deleted, version=${syncVersion}`);
    res.json({
      syncVersion: syncVersion || 0,
      traceId,
      updated,
      deleted,
    });
  }
};
