#!/usr/bin/env node

/**
 * Script para limpiar TODA la base de datos, dejando solo el usuario de prueba
 * Uso: node backend/scripts/cleanDatabase.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const secrets = require('../config/secrets');
const path = require('path');

const isProduction = secrets.NODE_ENV === 'production' || !!secrets.DATABASE_URL;

let db;

const cleanDatabase = async () => {
  try {
    console.log('🧹 Iniciando limpieza COMPLETA de la base de datos...');
    console.log('📌 Se mantendrá solo el usuario de prueba (email: "user")\n');

    if (isProduction) {
      // PostgreSQL
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: secrets.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      db = pool;

      await pool.query('BEGIN TRANSACTION');

      console.log('📊 Base de datos: PostgreSQL');
      console.log('\n🗑️  Eliminando datos en orden de dependencias...\n');

      // Obtener el ID del usuario de prueba
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        ['user']
      );
      const testUserId = userResult.rows[0]?.id;

      if (!testUserId) {
        console.warn('⚠️  No se encontró el usuario de prueba (email: "user")');
      }

      // Orden correcto para evitar violaciones de FK
      const queries = [
        { name: 'card_snoozes', query: 'DELETE FROM card_snoozes' },
        { name: 'review_predictions', query: 'DELETE FROM review_predictions' },
        { name: 'card_logs', query: 'DELETE FROM card_logs' },
        { name: 'card_difficulty_analytics', query: 'DELETE FROM card_difficulty_analytics' },
        { name: 'ai_chat_messages', query: 'DELETE FROM ai_chat_messages' },
        { name: 'ai_chat_sessions', query: 'DELETE FROM ai_chat_sessions' },
        { name: 'youtube_transcripts', query: 'DELETE FROM youtube_transcripts' },
        { name: 'youtube_videos', query: 'DELETE FROM youtube_videos' },
        { name: 'audio_transcripts', query: 'DELETE FROM audio_transcripts' },
        { name: 'audio_recordings', query: 'DELETE FROM audio_recordings' },
        { name: 'scanned_documents', query: 'DELETE FROM scanned_documents' },
        { name: 'gallery_items', query: 'DELETE FROM gallery_items' },
        { name: 'flashcards', query: 'DELETE FROM flashcards' },
        { name: 'photos', query: 'DELETE FROM photos' },
        { name: 'study_sessions', query: 'DELETE FROM study_sessions' },
        { name: 'schedules', query: 'DELETE FROM schedules' },
        { name: 'learning_analytics', query: 'DELETE FROM learning_analytics' },
        { name: 'assessments', query: 'DELETE FROM assessments' },
        { name: 'shared_decks', query: 'DELETE FROM shared_decks' },
        { name: 'flashcard_decks', query: 'DELETE FROM flashcard_decks' },
        { name: 'subjects', query: 'DELETE FROM subjects' },
        { name: 'group_memberships', query: 'DELETE FROM group_memberships' },
        { name: 'deleted_users', query: 'DELETE FROM deleted_users' },
        { 
          name: 'users (excepto test user)', 
          query: testUserId 
            ? `DELETE FROM users WHERE id != $1`
            : 'DELETE FROM users' // Si no hay usuario de prueba, elimina todos
          ,
          params: testUserId ? [testUserId] : []
        },
      ];

      for (const { name, query, params = [] } of queries) {
        try {
          const result = await pool.query(query, params);
          console.log(`✅ ${name.padEnd(35)} - ${result.rowCount} registros eliminados`);
        } catch (err) {
          console.warn(`⚠️  ${name.padEnd(35)} - ${err.message}`);
        }
      }

      await pool.query('COMMIT');
      console.log('\n✨ ¡Limpieza completada exitosamente!');
      await pool.end();

    } else {
      // SQLite
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.resolve(__dirname, '../database.sqlite');

      db = new sqlite3.Database(dbPath);

      console.log('📊 Base de datos: SQLite');
      console.log(`📂 Ruta: ${dbPath}`);
      console.log('\n🗑️  Eliminando datos en orden de dependencias...\n');

      return new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) return reject(err);
          });

          // Obtener el ID del usuario de prueba
          db.get('SELECT id FROM users WHERE email = ?', ['user'], (err, row) => {
            if (err) {
              console.warn('⚠️  Error al buscar usuario de prueba:', err.message);
            }

            const testUserId = row?.id;

            if (!testUserId) {
              console.warn('⚠️  No se encontró el usuario de prueba (email: "user")');
            }

            const queries = [
              { name: 'card_snoozes', query: 'DELETE FROM card_snoozes' },
              { name: 'review_predictions', query: 'DELETE FROM review_predictions' },
              { name: 'card_logs', query: 'DELETE FROM card_logs' },
              { name: 'card_difficulty_analytics', query: 'DELETE FROM card_difficulty_analytics' },
              { name: 'ai_chat_messages', query: 'DELETE FROM ai_chat_messages' },
              { name: 'ai_chat_sessions', query: 'DELETE FROM ai_chat_sessions' },
              { name: 'youtube_transcripts', query: 'DELETE FROM youtube_transcripts' },
              { name: 'youtube_videos', query: 'DELETE FROM youtube_videos' },
              { name: 'audio_transcripts', query: 'DELETE FROM audio_transcripts' },
              { name: 'audio_recordings', query: 'DELETE FROM audio_recordings' },
              { name: 'scanned_documents', query: 'DELETE FROM scanned_documents' },
              { name: 'gallery_items', query: 'DELETE FROM gallery_items' },
              { name: 'flashcards', query: 'DELETE FROM flashcards' },
              { name: 'photos', query: 'DELETE FROM photos' },
              { name: 'study_sessions', query: 'DELETE FROM study_sessions' },
              { name: 'schedules', query: 'DELETE FROM schedules' },
              { name: 'learning_analytics', query: 'DELETE FROM learning_analytics' },
              { name: 'assessments', query: 'DELETE FROM assessments' },
              { name: 'shared_decks', query: 'DELETE FROM shared_decks' },
              { name: 'flashcard_decks', query: 'DELETE FROM flashcard_decks' },
              { name: 'subjects', query: 'DELETE FROM subjects' },
              { name: 'group_memberships', query: 'DELETE FROM group_memberships' },
              { name: 'deleted_users', query: 'DELETE FROM deleted_users' },
              { 
                name: 'users (excepto test user)', 
                query: testUserId 
                  ? `DELETE FROM users WHERE id != ${testUserId}`
                  : 'DELETE FROM users'
              },
            ];

            let completedCount = 0;

            queries.forEach(({ name, query }) => {
              db.run(query, function (err) {
                completedCount++;

                if (err) {
                  console.warn(`⚠️  ${name.padEnd(35)} - ${err.message}`);
                } else {
                  console.log(`✅ ${name.padEnd(35)} - ${this.changes} registros eliminados`);
                }

                if (completedCount === queries.length) {
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('\n❌ Error al hacer COMMIT:', err.message);
                      reject(err);
                    } else {
                      console.log('\n✨ ¡Limpieza completada exitosamente!');
                      db.close((closeErr) => {
                        if (closeErr) reject(closeErr);
                        else resolve();
                      });
                    }
                  });
                }
              });
            });
          });
        });
      });
    }

  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error.message);
    process.exit(1);
  }
};

cleanDatabase().then(() => {
  console.log('\n📈 Recomendación: Reinicia el servidor para actualizar los datos cacheados.');
  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
