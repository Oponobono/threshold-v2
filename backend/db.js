
const secrets = require('./config/secrets');
const path = require('path');

const isProduction = secrets.NODE_ENV === 'production' || !!secrets.DATABASE_URL;

let db;
let pool;

if (isProduction) {
  // ===== POSTGRESQL =====
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: secrets.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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

  console.log('✓ Conectado a PostgreSQL.');
} else {
  // ===== SQLITE =====
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'database.sqlite');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error al conectar con SQLite:', err.message);
    } else {
      console.log('✓ Conectado a SQLite.');
    }
  });
}

const initializeDb = async () => {
  if (isProduction) {
    const initializePostgres = require('./database/postgres');
    await initializePostgres(pool);
  } else {
    const initializeSqlite = require('./database/sqlite');
    await initializeSqlite(db);
  }
};

module.exports = {
  db,
  initializeDb,
};


