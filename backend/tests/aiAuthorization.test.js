/**
 * Autorizacion por recurso: dos usuarios, ningun acceso cruzado.
 *
 *   node --test tests/aiAuthorization.test.js
 *
 * Que se demuestra
 * ----------------
 * Que un token valido de A NO basta para tocar datos de B. Autenticar y
 * autorizar son dos preguntas distintas, y la segunda es la que se estaba
 * contestando que si.
 *
 * Como se monta
 * -------------
 * Se usa un SQLite en memoria con dos usuarios y datos reales, se reasigna
 * db.js ANTES de cargar los controladores (por eso el require va abajo y no
 * arriba) y se invocan los controladores con una req minima. Nada de mocks: si
 * el SQL cambia y deja de filtrar por user_id, el test falla.
 */

const test = require('node:test');
const assert = require('node:assert');
const sqlite3 = require('sqlite3').verbose();

const USUARIO_A = 'usuario-a-0000-0000-000000000001';
const USUARIO_B = 'usuario-b-0000-0000-000000000002';
const MATERIA_A = 'materia-a-0000-0000-0000-00000001';
const MATERIA_B = 'materia-b-0000-0000-0000-00000002';

const dbReal = new sqlite3.Database(':memory:');

// ── Esquema minimo: solo las columnas que tocan las rutas probadas ──────────
dbReal.serialize(() => {
  dbReal.run(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, password TEXT, deleted INTEGER DEFAULT 0)`);
  dbReal.run(`CREATE TABLE subjects (id TEXT PRIMARY KEY, user_id TEXT, name TEXT)`);
  dbReal.run(`CREATE TABLE ai_chat_sessions (id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, title TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  dbReal.run(`CREATE TABLE ai_chat_messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')))`);
});

// ── Fixtures: A y B tienen cada uno su materia y su historial ────────────────
const sembrar = () =>
  new Promise((resolve, reject) => {
    dbReal.serialize(() => {
      dbReal.run('INSERT INTO users (id, email, password) VALUES (?, ?, ?)', [USUARIO_A, 'a@test.local', 'x']);
      dbReal.run('INSERT INTO users (id, email, password) VALUES (?, ?, ?)', [USUARIO_B, 'b@test.local', 'x']);
      dbReal.run('INSERT INTO subjects (id, user_id, name) VALUES (?, ?, ?)', [MATERIA_A, USUARIO_A, 'Materia de A']);
      dbReal.run('INSERT INTO subjects (id, user_id, name) VALUES (?, ?, ?)', [MATERIA_B, USUARIO_B, 'Materia de B']);
      dbReal.run('INSERT INTO ai_chat_sessions (id, user_id, subject_id, title) VALUES (?, ?, ?, ?)', ['sesion-a', USUARIO_A, MATERIA_A, 'Sesion A']);
      dbReal.run('INSERT INTO ai_chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)', ['msg-a', 'sesion-a', 'user', 'confidencial de A']);
      dbReal.run('INSERT INTO ai_chat_sessions (id, user_id, subject_id, title) VALUES (?, ?, ?, ?)', ['sesion-b', USUARIO_B, MATERIA_B, 'Sesion B']);
      dbReal.run('INSERT INTO ai_chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)', ['msg-b', 'sesion-b', 'user', 'confidencial de B']);
    });
    dbReal.run('SELECT 1', (err) => (err ? reject(err) : resolve()));
  });

/** db.js con forma de callback, igual que la de produccion. */
const db = {
  run(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    dbReal.run(sql, params, function (err) { if (cb) cb.call(this, err); });
  },
  get(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    dbReal.get(sql, params, (err, row) => cb(err, row));
  },
  all(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    dbReal.all(sql, params, (err, rows) => cb(err, rows));
  },
  serialize(fn) { dbReal.serialize(fn); },
};

// El seam: se reasigna el export antes de que NADIE haya destructurado db.
// Si se hiciera despues, los controladores seguirian viendo la BD real.
const dbModule = require('../db');
dbModule.db = db;
dbModule.initializeDb = async () => {};

process.env.JWT_SECRET = 'secreto-de-prueba-para-authorization';

const controller = require('../controllers/aiController');
const { exigirPropiedadEnPath, esPropio, enviarNoEncontrado } = require('../services/auth/ownership');

/** Respuesta falsa que solo sabe registrar lo que se le escribio. */
function respuestaFalsa() {
  const r = { statusCode: null, terminado: false };
  r.status = (n) => { r.statusCode = n; return r; };
  r.json = (c) => { r.cuerpo = c; r.terminado = true; return r; };
  return r;
}

function peticionDe(usuarioId, params = {}) {
  return { params, user: { id: usuarioId }, userId: usuarioId, originalUrl: '/api/ai/chat/history/x/y' };
}

/** Invoca un controlador y devuelve la respuesta falsa ya rellenada. */
function correr(fn, usuarioId, params) {
  return new Promise((resolve) => {
    const res = respuestaFalsa();
    res.statusCode = 200;
    res.status = (n) => { res.statusCode = n; return res; };
    res.json = (c) => { res.cuerpo = c; res.terminado = true; resolve(res); };
    Promise.resolve(fn({ ...peticionDe(usuarioId), params }, res)).catch(() => resolve(res));
  });
}

const contarSesionesDe = (usuarioId) =>
  new Promise((resolve) =>
    dbReal.all('SELECT COUNT(*) AS n FROM ai_chat_sessions WHERE user_id = ?', [usuarioId], (e, r) =>
      resolve(r && r[0] ? r[0].n : 0)
    )
  );

// ───────────────────────────────────────────────────────────────────────────

test.before(async () => { await sembrar(); });
test.after(() => dbReal.close());

test('A lee su propio historial', async () => {
  const res = await correr(
    (req, r) => controller.getChatHistory(req, r),
    USUARIO_A,
    { userId: USUARIO_A, subjectId: MATERIA_A }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.cuerpo.session_id, 'sesion-a');
  assert.equal(res.cuerpo.messages[0].content, 'confidencial de A');
});

test('A NO lee el historial de B poniendo el id de B en la URL', async () => {
  const res = await correr(
    (req, r) => controller.getChatHistory(req, r),
    USUARIO_A,
    { userId: USUARIO_B, subjectId: MATERIA_B }
  );
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.stringify(res.cuerpo).includes('confidencial de B'), false);
  assert.equal(JSON.stringify(res.cuerpo).includes('sesion-b'), false);
});

test('A NO crea historial en el espacio de B con getChatHistory', async () => {
  // Ruta sin sesion previa: el controlador solia INSERTAR para el userId del path.
  const res = await correr(
    (req, r) => controller.getChatHistory(req, r),
    USUARIO_A,
    { userId: USUARIO_B, subjectId: 'materia-inexistente' }
  );
  assert.equal(res.statusCode, 404);
  assert.equal(await contarSesionesDe(USUARIO_B), 1, 'no debe haberse creado ninguna sesion para B');
});

test('A NO crea sesiones en el espacio de B con clearChatHistory', async () => {
  const res = await correr(
    (req, r) => controller.clearChatHistory(req, r),
    USUARIO_A,
    { userId: USUARIO_B, subjectId: MATERIA_B }
  );
  assert.equal(res.statusCode, 404);
  assert.equal(await contarSesionesDe(USUARIO_B), 1, 'clearChatHistory no debe insertar nada para B');
});

test('B conserva su propio historial intacto', async () => {
  const res = await correr(
    (req, r) => controller.getChatHistory(req, r),
    USUARIO_B,
    { userId: USUARIO_B, subjectId: MATERIA_B }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.cuerpo.session_id, 'sesion-b');
});

test('inexistente y ajeno devuelven EXACTAMENTE lo mismo', async () => {
  // Si difieren, la diferencia se puede usar para enumerar recursos ajenos.
  const ajeno = respuestaFalsa();
  enviarNoEncontrado(peticionDe(USUARIO_A), ajeno, 'motivo interno de B');
  const inexistente = respuestaFalsa();
  enviarNoEncontrado(peticionDe(USUARIO_A), inexistente, 'motivo interno de nadie');

  assert.equal(ajeno.statusCode, inexistente.statusCode);
  assert.deepEqual(ajeno.cuerpo, inexistente.cuerpo);
});

// ── La guarda, aislada ──────────────────────────────────────────────────────

test('esPropio compara por valor, no por tipo', () => {
  assert.equal(esPropio({ userId: 7 }, '7'), true, 'id numerico del JWT vs string del path');
  assert.equal(esPropio({ user: { id: 7 } }, 7), true);
});

test('sin identidad no se autoriza nada', () => {
  // El fallo caro: si idPropio devolvia undefined, undefined === undefined y
  // una peticion sin autenticar se autorizaba a si misma.
  assert.equal(esPropio({}, undefined), false);
  assert.equal(esPropio({ userId: '' }, ''), false);
  assert.equal(esPropio({ userId: null }, null), false);
});

test('un recurso sin dueno declarado no se abre', () => {
  assert.equal(esPropio({ userId: 'a' }, ''), false);
  assert.equal(esPropio({ userId: 'a' }, undefined), false);
});

test('exigirPropiedadEnPath deja pasar solo lo tuyo', () => {
  const res = respuestaFalsa();
  const denegado = exigirPropiedadEnPath(peticionDe(USUARIO_A, { userId: USUARIO_B }), res);
  assert.equal(denegado, true);
  assert.equal(res.statusCode, 404);

  const res2 = respuestaFalsa();
  assert.equal(exigirPropiedadEnPath(peticionDe(USUARIO_A, { userId: USUARIO_A }), res2), false);
  assert.equal(res2.terminado, false, 'no debe responder cuando si es suyo');
});

test('el motivo interno no sale en el cuerpo de la respuesta', () => {
  const res = respuestaFalsa();
  enviarNoEncontrado(peticionDe(USUARIO_A), res, `deck ${'z'.repeat(30)} es de otro usuario`);
  assert.equal(JSON.stringify(res.cuerpo).includes('z'.repeat(30)), false);
});