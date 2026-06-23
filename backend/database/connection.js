const path = require('path');
const secrets = require('../config/secrets');

const isProduction = secrets.NODE_ENV === 'production' || !!secrets.DATABASE_URL;

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
    family: 4,
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
          err.message = 'UNIQUE constraint failed: ' + err.message;
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
