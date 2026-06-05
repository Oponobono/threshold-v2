const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.resolve(__dirname, '..', 'database.sqlite');
const EXPORT_PATH = path.resolve(__dirname, '..', 'data_export_pre_uuid.json');

const ID_MAP = {};

function getOrCreateUuid(table, oldId) {
  if (oldId === null || oldId === undefined) return null;
  const key = String(oldId);
  if (!ID_MAP[table]) ID_MAP[table] = {};
  if (!ID_MAP[table][key]) ID_MAP[table][key] = uuidv4();
  return ID_MAP[table][key];
}

const IMPORT_ORDER = [
  { table: 'users', pk: 'id', skip: false, mergeBy: 'email' },
  { table: 'subjects', pk: 'id', skip: false },
  { table: 'groups', pk: 'id', skip: false },
  { table: 'group_memberships', pk: 'id', skip: false },
  { table: 'assessments', pk: 'id', skip: false },
  { table: 'assessment_categories', pk: 'id', skip: false },
  { table: 'assessment_results', pk: 'id', skip: false },
  { table: 'assessment_files', pk: 'id', skip: false },
  { table: 'flashcard_decks', pk: 'id', skip: false },
  { table: 'flashcards', pk: 'id', skip: false },
  { table: 'card_logs', pk: 'id', skip: false },
  { table: 'schedules', pk: 'id', skip: false },
  { table: 'calendar_events', pk: 'id', skip: false },
  { table: 'photos', pk: 'id', skip: false },
  { table: 'scanned_documents', pk: 'id', skip: false },
  { table: 'audio_recordings', pk: 'id', skip: false },
  { table: 'audio_transcripts', pk: 'id', skip: false },
  { table: 'youtube_videos', pk: 'id', skip: false },
  { table: 'youtube_transcripts', pk: 'id', skip: false },
  { table: 'ai_chat_sessions', pk: 'id', skip: false },
  { table: 'ai_chat_messages', pk: 'id', skip: false },
  { table: 'learning_analytics', pk: 'id', skip: false },
  { table: 'card_difficulty_analytics', pk: 'id', skip: false },
  { table: 'review_predictions', pk: 'id', skip: false },
  { table: 'subject_threshold_overrides', pk: 'id', skip: false },
  { table: 'card_snoozes', pk: 'id', skip: false },
  { table: 'shared_decks', pk: 'id', skip: false },
  { table: 'shared_group_decks', pk: 'id', skip: false },
  { table: 'grade_history', pk: 'id', skip: false },
  { table: 'subject_grade_snapshots', pk: 'id', skip: false },
  { table: 'gallery_items', pk: 'id', skip: false },
  { table: 'deleted_users', pk: 'id', skip: false },
  { table: 'app_visitors', pk: 'device_id', skip: false },
  { table: 'two_factor_auth', pk: 'id', skip: true },
  { table: 'lms_accounts', pk: 'id', skip: true },
  { table: 'feedback_messages', pk: 'id', skip: true },
];

function getFKReplacements(tableName) {
  const map = {
    users: {},
    subjects: { user_id: 'users' },
    groups: { creator_user_id: 'users' },
    group_memberships: { user_id: 'users' },
    assessments: { user_id: 'users', subject_id: 'subjects', category_id: 'assessment_categories' },
    assessment_categories: { subject_id: 'subjects' },
    assessment_results: { assessment_id: 'assessments', user_id: 'users' },
    assessment_files: { assessment_id: 'assessments' },
    flashcard_decks: { user_id: 'users', subject_id: 'subjects' },
    flashcards: { deck_id: 'flashcard_decks', parent_card_id: 'flashcards' },
    card_logs: { card_id: 'flashcards', user_id: 'users' },
    schedules: { subject_id: 'subjects' },
    calendar_events: { user_id: 'users', subject_id: 'subjects' },
    photos: { subject_id: 'subjects' },
    scanned_documents: { user_id: 'users', subject_id: 'subjects' },
    audio_recordings: { user_id: 'users', subject_id: 'subjects' },
    audio_transcripts: { recording_id: 'audio_recordings' },
    youtube_videos: { user_id: 'users', subject_id: 'subjects' },
    youtube_transcripts: { video_id: 'youtube_videos' },
    ai_chat_sessions: { user_id: 'users', subject_id: 'subjects' },
    ai_chat_messages: { session_id: 'ai_chat_sessions' },
    learning_analytics: { user_id: 'users', subject_id: 'subjects' },
    card_difficulty_analytics: { card_id: 'flashcards' },
    review_predictions: { user_id: 'users', card_id: 'flashcards' },
    subject_threshold_overrides: { user_id: 'users', subject_id: 'subjects' },
    card_snoozes: { card_id: 'flashcards', user_id: 'users' },
    shared_decks: { deck_id: 'flashcard_decks', shared_by_user_id: 'users', shared_to_user_id: 'users' },
    shared_group_decks: { deck_id: 'flashcard_decks', shared_by_user_id: 'users' },
    grade_history: { assessment_result_id: 'assessment_results' },
    subject_grade_snapshots: { subject_id: 'subjects', user_id: 'users' },
    gallery_items: { user_id: 'users' },
    deleted_users: {},
    app_visitors: {},
  };
  return map[tableName] || {};
}

async function runImport() {
  if (!fs.existsSync(EXPORT_PATH)) {
    console.log('No se encontró archivo de exportación. Nada que importar.');
    return;
  }

  const exportData = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));

  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ No se encontró database.sqlite. Asegúrate de que el servidor se haya iniciado al menos una vez.');
    return;
  }

  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(DB_PATH);

  const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  };

  console.log('Iniciando importacion de datos...\n');

  // Phase 0: Handle existing user created by server init
  console.log('Fase 0: Mapeando usuario existente...');
  const oldUser = exportData.users?.[0];
  if (oldUser) {
    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [oldUser.email]);
    if (existingUser) {
      console.log(`  Usuario existente encontrado: ${existingUser.id}`);
      // Map old user ID (1) to the existing UUID
      if (!ID_MAP.users) ID_MAP.users = {};
      ID_MAP.users[String(oldUser.id)] = existingUser.id;
      console.log(`  Mapeado old ID ${oldUser.id} -> ${existingUser.id}`);
    }
  }

  // Phase 1: Assign UUIDs for all remaining old IDs
  console.log('\nFase 1: Asignando UUIDs a IDs antiguos...');
  for (const { table, pk, skip } of IMPORT_ORDER) {
    if (skip || table === 'users') continue; // users handled in Phase 0
    const rows = exportData[table];
    if (!rows || rows.length === 0) continue;
    for (const row of rows) {
      getOrCreateUuid(table, row[pk]);
    }
  }
  console.log('  UUIDs asignados.\n');

  // Phase 2: Import data table by table
  console.log('Fase 2: Importando datos...');
  for (const { table, pk, skip, mergeBy } of IMPORT_ORDER) {
    if (skip) {
      if (exportData[table] && exportData[table].length > 0) {
        console.log(`  Saltada ${table}: ${exportData[table].length} filas (INTEGER PK)`);
      }
      continue;
    }

    const rows = exportData[table];
    if (!rows || rows.length === 0) {
      console.log(`  ${table}: 0 filas`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const fkMap = getFKReplacements(table);

    let imported = 0;
    for (const row of rows) {
      const newRow = {};
      for (const col of columns) {
        let val = row[col];

        if (fkMap[col]) {
          const refTable = fkMap[col];
          val = val !== null && val !== undefined ? getOrCreateUuid(refTable, val) : null;
        } else if (col === pk) {
          val = getOrCreateUuid(table, val);
        }

        newRow[col] = val;
      }

      const colNames = Object.keys(newRow).join(', ');
      const placeholders = Object.keys(newRow).map(() => '?').join(', ');
      const values = Object.values(newRow);

      if (table === 'users' && mergeBy) {
        // Merge with existing user by email field
        try {
          const setClause = Object.keys(newRow).filter(c => c !== 'id' && c !== mergeBy && c !== 'password_hash').map(c => `${c} = ?`).join(', ');
          const updateValues = Object.keys(newRow).filter(c => c !== 'id' && c !== mergeBy && c !== 'password_hash').map(c => newRow[c]);
          await dbRun(`UPDATE ${table} SET ${setClause} WHERE ${mergeBy} = ?`, [...updateValues, newRow[mergeBy]]);
          imported++;
        } catch (err) {
          console.error(`  Error actualizando ${table}: ${err.message}`);
        }
      } else {
        try {
          await dbRun(`INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`, values);
          imported++;
        } catch (err) {
          if (err.message && err.message.includes('UNIQUE constraint')) {
            try {
              const setClause = Object.keys(newRow).map(c => `${c} = ?`).join(', ');
              const updateValues = Object.values(newRow);
              await dbRun(`UPDATE ${table} SET ${setClause} WHERE ${pk} = ?`, [...updateValues, newRow[pk]]);
              imported++;
            } catch (updateErr) {
              console.error(`  Error actualizando ${table} (${pk}=${newRow[pk]}): ${updateErr.message}`);
            }
          } else {
            console.error(`  Error insertando en ${table} (${pk}=${newRow[pk]}): ${err.message}`);
          }
        }
      }
    }
    console.log(`  ${table}: ${imported}/${rows.length} filas importadas`);
  }

  console.log('\nImportacion completada.\n');

  // Verify
  console.log('Verificando datos importados...');
  for (const { table, skip } of IMPORT_ORDER) {
    if (skip) continue;
    try {
      const row = await dbAll(`SELECT COUNT(*) as count FROM ${table}`);
      if (row[0].count > 0) {
        console.log(`  ${table}: ${row[0].count} filas`);
      }
    } catch (e) {
      // table might not exist, skip
    }
  }

  db.close();
}

runImport().catch(console.error);
