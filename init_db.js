const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'backend/database/database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar con SQLite:', err.message);
  } else {
    console.log('✓ Conectado a SQLite.');
  }
});

const tableSchema = require('./backend/database/schema');

// Run initialization
(async () => {
  try {
    console.log('[DB Init] 📋 Inicializando SQLite...');
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ PRAGMA foreign_keys = ON habilitado.');

    console.log('[DB Init] 📋 Paso 1: Creando tablas...');
    console.log('[DB Init] Total de tablas: ' + Object.keys(tableSchema).length);
    
    for (const [tableName, schema] of Object.entries(tableSchema)) {
      console.log('[DB Init] 🔄 Creando tabla: ' + tableName + '...');
      try {
        await new Promise((resolve, reject) => {
          db.run(schema.sqlite, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log('✓ Tabla creada/verificada: ' + tableName);
      } catch (err) {
        console.error('❌ Error creando tabla ' + tableName + ':', err.message);
      }
    }
    
    console.log('✅ Tablas creadas.');
    
    // Check if grading_systems table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='grading_systems'", (err, row) => {
      if (err) {
        console.error('Error checking table:', err);
      } else if (row) {
        console.log('✓ grading_systems table exists');
        db.get('SELECT COUNT(*) as count FROM grading_systems', (err, row) => {
          if (err) {
            console.error('Error counting systems:', err);
          } else {
            console.log('Grading systems count: ' + row.count);
          }
          db.close();
        });
      } else {
        console.log('✗ grading_systems table does not exist');
        db.close();
      }
    });
  } catch (err) {
    console.error('❌ Error fatal en inicialización de SQLite:', err.message);
    db.close();
  }
})();