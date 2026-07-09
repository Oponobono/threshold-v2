const path = require('path');
const dns = require('dns');
const secrets = require('../config/secrets');

// ── Forzar IPv4 en resolución DNS ────────────────────────────────────────────
// Render no soporta conexiones salientes por IPv6. Supabase "Direct Connection"
// resuelve a IPv6 (2600:...), lo que causa ENETUNREACH. Al establecer el orden
// de resolución a IPv4 primero, el pool de pg usará la dirección IPv4 correcta.
// Esto también funciona si se usa el pooler de Supabase (pooler.supabase.com).
dns.setDefaultResultOrder('ipv4first');

const isProduction = !!secrets.DATABASE_URL;

let db;
let pool;

if (isProduction) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: secrets.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const convertQuery = (sql) => {
    let index = 1;
    let pgSql = sql.replace(/\?/g, () => `$${index++}`);
    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
    return pgSql;
  };

  db = {
    run: (sql, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool.query(convertQuery(sql), params, (err, res) => {
        if (err && err.code === '23505') {
          // PostgreSQL unique violations exponen el nombre del constraint en err.constraint
          // y la columna en err.detail. Traducimos a formato SQLite para que
          // authController.js pueda identificar la columna afectada correctamente.
          const constraint = (err.constraint || '').toLowerCase();
          const detail = (err.detail || err.message || '').toLowerCase();
          if (constraint.includes('email') || detail.includes('email')) {
            err.message = 'UNIQUE constraint failed: users.email';
          } else if (constraint.includes('username') || detail.includes('username')) {
            err.message = 'UNIQUE constraint failed: users.username';
          } else if (constraint.includes('share_pin') || detail.includes('share_pin')) {
            err.message = 'UNIQUE constraint failed: users.share_pin';
          } else if (constraint.includes('users_pkey') || (constraint.includes('users') && constraint.includes('id'))) {
            err.message = 'UNIQUE constraint failed: users.id';
          } else {
            err.message = 'UNIQUE constraint failed: ' + (err.constraint || err.message);
          }
        }
        if (callback) {
          const context = {
            lastID: res && res.rows && res.rows[0] ? res.rows[0].id : null,
            changes: res ? res.rowCount : 0
          };
          callback.call(context, err);
        }
      });
    },
    get: (sql, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool.query(convertQuery(sql), params, (err, res) => {
        if (callback) callback(err, res && res.rows ? res.rows[0] : null);
      });
    },
    all: (sql, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool.query(convertQuery(sql), params, (err, res) => {
        if (callback) callback(err, res ? res.rows : []);
      });
    },
    serialize: (callback) => {
      callback();
    }
  };

  console.log('✓ Configurado pool PostgreSQL (IPv4 forzado, timeout 10s).');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, '..', 'database.sqlite');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error al conectar con SQLite:', err.message);
    } else {
      console.log('✓ Conectado a SQLite.');
      db.run('PRAGMA journal_mode = WAL', (walErr) => {
        if (walErr) {
          console.error('❌ Error activando WAL mode:', walErr.message);
        } else {
          console.log('✓ WAL mode activado — lecturas concurrentes permitidas.');
        }
      });
      db.run('PRAGMA busy_timeout = 5000', (busyErr) => {
        if (busyErr) {
          console.error('❌ Error configurando busy_timeout:', busyErr.message);
        } else {
          console.log('✓ busy_timeout = 5000ms — SQLite reintentará en lugar de fallar.');
        }
      });
      db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
        if (pragmaErr) {
          console.error('❌ Error habilitando foreign_keys:', pragmaErr.message);
        } else {
          console.log('✓ PRAGMA foreign_keys = ON habilitado.');
        }
      });
    }
  });
}

module.exports = { db, pool, isProduction };
