/**
 * migrateToUuid.js
 *
 * Migra una base de datos SQLite con IDs enteros AUTOINCREMENT al nuevo
 * esquema con UUIDs (TEXT PRIMARY KEY).
 *
 * Flujo:
 * 1. Respaldar database.sqlite → database_backup_pre_uuid.sqlite
 * 2. Exportar todos los datos actuales como JSON (con IDs originales)
 * 3. Eliminar la base de datos
 * 4. Instrucciones: reiniciar servidor para recrear tablas, luego importar
 *
 * Uso: node scripts/migrateToUuid.js
 */

const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '..', 'database.sqlite');
const BACKUP_PATH = DB_PATH.replace('.sqlite', '_backup_pre_uuid.sqlite');
const EXPORT_PATH = path.resolve(__dirname, '..', 'data_export_pre_uuid.json');

function getTableNames() {
  return [
    'users', 'subjects', 'assessments', 'assessment_results',
    'assessment_categories', 'assessment_files', 'photos',
    'scanned_documents', 'audio_recordings', 'audio_transcripts',
    'youtube_videos', 'youtube_transcripts', 'flashcard_decks',
    'flashcards', 'card_logs', 'learning_analytics',
    'card_difficulty_analytics', 'review_predictions',
    'subject_threshold_overrides', 'two_factor_auth', 'lms_accounts',
    'feedback_messages', 'card_snoozes', 'schedules', 'calendar_events',
    'study_sessions', 'group_memberships', 'groups', 'shared_decks',
    'shared_group_decks', 'ai_chat_sessions', 'ai_chat_messages',
    'grading_systems', 'grading_versions', 'grading_scales',
    'grading_periods', 'grade_history', 'subject_grade_snapshots',
  ];
}

async function migrate() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('ℹ️  No se encontró base de datos. Nada que migrar.');
    return;
  }

  console.log('📦 Respaldando database.sqlite...');
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log(`✅ Backup: ${BACKUP_PATH}\n`);

  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(DB_PATH);

  const exportData = {};

  for (const table of getTableNames()) {
    const rows = await new Promise((resolve) => {
      db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows || []);
        }
      });
    });
    if (rows.length > 0) {
      exportData[table] = rows;
      console.log(`📤 ${table}: ${rows.length} filas exportadas`);
    }
  }

  await new Promise((resolve) => db.close(resolve));

  fs.writeFileSync(EXPORT_PATH, JSON.stringify(exportData, null, 2));
  console.log(`\n✅ Datos exportados a: ${EXPORT_PATH}`);

  // Eliminar la base de datos vieja
  db.close(() => {
    fs.unlinkSync(DB_PATH);
    console.log('🗑️  Base de datos antigua eliminada.');
    console.log('\n▶️  Ahora reinicia el servidor: node server.js');
    console.log('   El nuevo schema se creará automáticamente con TEXT PKs.');
    console.log('   Los usuarios deberán iniciar sesión de nuevo (nuevos UUIDs).');
  });
}

migrate().catch(console.error);
