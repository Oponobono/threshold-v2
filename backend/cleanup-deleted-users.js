/**
 * Script para limpiar cuentas de usuario que superaron el período de 14 días
 * Se ejecuta automáticamente en producción (cron job)
 * Puede ser llamado manualmente o programado con node-cron
 */

const secrets = require('./config/secrets');
require('dotenv').config();
const { db, initializeDb } = require('./db');
const path = require('path');

const isProduction = secrets.NODE_ENV === 'production' || !!secrets.DATABASE_URL;

// Función principal de limpieza
const cleanupDeletedAccounts = () => {
  console.log(`[${new Date().toISOString()}] Iniciando limpieza de cuentas eliminadas...`);

  const now = new Date();
  
  // Obtener todas las cuentas con status pending_deletion cuya deletion_date ha pasado
  db.all(
    `SELECT id, email, name, lastname FROM users WHERE status = ? AND deletion_date < ?`,
    ['pending_deletion', now.toISOString()],
    (err, users) => {
      if (err) {
        console.error('Error al consultar cuentas para eliminar:', err.message);
        return;
      }

      if (users.length === 0) {
        console.log('[Cleanup] No hay cuentas para eliminar en este momento.');
        return;
      }

      console.log(`[Cleanup] Se encontraron ${users.length} cuenta(s) para eliminar permanentemente.`);

      // Para cada cuenta a eliminar
      users.forEach(user => {
        hardDeleteUser(user.id, user.email);
      });
    }
  );
};

// Función para hacer hard delete de una cuenta
const hardDeleteUser = (userId, email) => {
  console.log(`[Cleanup] Eliminando permanentemente usuario: ${email} (ID: ${userId})`);

  // Usar una transacción para garantizar consistencia
  db.serialize(() => {
    // 1. Eliminar datos relacionados en cascada (si no están configurados con ON DELETE CASCADE)
    db.run('DELETE FROM audio_transcripts WHERE recording_id IN (SELECT id FROM audio_recordings WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM audio_recordings WHERE user_id = ?', [userId]);
    
    db.run('DELETE FROM youtube_transcripts WHERE video_id IN (SELECT id FROM youtube_videos WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM youtube_videos WHERE user_id = ?', [userId]);
    
    db.run('DELETE FROM flashcards WHERE deck_id IN (SELECT id FROM flashcard_decks WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM flashcard_decks WHERE user_id = ?', [userId]);
    
    db.run('DELETE FROM photos WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM assessments WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM schedules WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM subjects WHERE user_id = ?', [userId]);
    
    db.run('DELETE FROM gallery_items WHERE user_id = ?', [userId]);
    
    // 2. Finalmente, eliminar el usuario
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        console.error(`Error al eliminar usuario ${userId}:`, err.message);
      } else {
        console.log(`[Cleanup] Usuario ${email} eliminado permanentemente.`);
      }
    });
  });
};

// Ejecutar la limpieza
if (require.main === module) {
  console.log('Iniciando proceso de limpieza de cuentas eliminadas...');
  initializeDb();
  
  // Esperar a que se inicialice la BD antes de ejecutar la limpieza
  setTimeout(() => {
    cleanupDeletedAccounts();
    
    // Cerrar la conexión después de la limpieza
    setTimeout(() => {
      db.close((err) => {
        if (err) {
          console.error('Error cerrando la base de datos:', err.message);
        } else {
          console.log('Conexión a la base de datos cerrada.');
        }
        process.exit(0);
      });
    }, 2000);
  }, 1000);
}

module.exports = { cleanupDeletedAccounts };
