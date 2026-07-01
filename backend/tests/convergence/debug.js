const path = require('path');
const fs = require('fs');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function test() {
  const dbPath = path.join(os.tmpdir(), 'test_backend_' + Date.now() + '.db');
  console.log('Test DB:', dbPath);
  const memDb = new sqlite3.Database(dbPath);

  await new Promise((resolve) => {
    memDb.serialize(() => {
      memDb.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, name TEXT, username TEXT UNIQUE, share_pin VARCHAR(8), status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), last_login TEXT DEFAULT (datetime('now')))");
      memDb.run("CREATE TABLE IF NOT EXISTS sync_version (id INTEGER PRIMARY KEY, version INTEGER DEFAULT 0, updated_at TEXT)");
      memDb.run("INSERT OR IGNORE INTO sync_version (id, version, updated_at) VALUES (1, 0, datetime('now'))");
      memDb.run("CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)");
      resolve();
    });
  });

  const userId = uuidv4();
  const hash = await bcrypt.hash('test', 4);
  await new Promise((resolve, reject) => {
    memDb.run('INSERT INTO users (id, email, password_hash, name, username, share_pin) VALUES (?,?,?,?,?,?)',
      [userId, 't@t.com', hash, 'Test', 'tuser', 'PIN123'], (err) => err ? reject(err) : resolve());
  });

  const jwtToken = jwt.sign({ id: userId, email: 't@t.com' }, 'test-secret', { expiresIn: '1h' });

  const reqDb = {
    run: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      memDb.run(sql, params, function(err) { if (cb) cb.call(this, err); });
    },
    get: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      memDb.get(sql, params, (err, row) => { if (cb) cb(err, row); });
    },
    all: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      memDb.all(sql, params, (err, rows) => { if (cb) cb(err, rows); });
    },
  };

  // Mutate db BEFORE loading controllers
  const dbMod = require('../../db');
  console.log('Before: db type:', typeof dbMod.db, 'is sqlite:', dbMod.db instanceof sqlite3.Database);
  dbMod.db = reqDb;
  console.log('After: db is reqDb?', dbMod.db === reqDb);

  // Load controller
  const subjectsController = require('../../controllers/subjectsController');

  // Start express
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const authMw = (req, res, next) => {
    try {
      const decoded = jwt.verify(req.headers.authorization.replace('Bearer ', ''), 'test-secret');
      req.user = { id: decoded.id };
      next();
    } catch { res.status(401).json({ error: 'Invalid token' }); }
  };

  app.post('/api/subjects', authMw, subjectsController.createSubject);

  const port = await new Promise(res => { const srv = app.listen(0, () => res(srv.address().port)); });
  console.log('Server on port:', port);

  // Make CREATE request
  const resp = await fetch('http://127.0.0.1:' + port + '/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
    body: JSON.stringify({ id: 'test-subj-1', user_id: userId, name: 'Test Subject', sync_version: 0 }),
  });
  const body = await resp.json();
  console.log('Response status:', resp.status);
  console.log('Response body:', JSON.stringify(body));

  // Check in our DB
  memDb.all('SELECT * FROM subjects', (err, rows) => {
    console.log('Subjects in memDb:', err ? err.message : JSON.stringify(rows));
  });

  memDb.all('SELECT * FROM sync_version', (err, rows) => {
    console.log('Sync version:', err ? err.message : JSON.stringify(rows));
  });

  setTimeout(() => {
    memDb.close();
    try { fs.unlinkSync(dbPath); } catch {}
    process.exit(0);
  }, 500);
}
test();
