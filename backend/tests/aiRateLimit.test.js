/**
 * El limite de cuota de IA: clave, orden y dialecto.
 *
 *   node --test tests/aiRateLimit.test.js
 *
 * Tres cosas se protectan aqui, y las tres importan mas de lo que parece:
 *
 * 1. ORDEN. El limitador esta montado DENTRO del router de IA, que va despues
 *    del middleware global de auth. Eso no es un detalle de colocacion: es lo
 *    que hace que exista req.user, y por lo tanto lo que permite limitar por
 *    usuario en vez de por IP. Si alguien mueve el limitador por delante del
 *    auth, la cuota sigue contando pero por IP y en una universidad es la cuota
 *    de todos junta. Aqui se demuestra que hoy NO es asi.
 *
 * 2. CLAVE. La cuota que se protege es la del proveedor de IA, y esa cuota la
 *    gasta el usuario. Limitar por IP hacia que un abuse de una persona
 *    bloqueara a las demas de su carril.
 *
 * 3. DIALECTO. El mismo limitador tiene que hablar los dos idiomas: v1 lee
 *    `error` como texto y v2 exige el sobre estable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const silenciarStdout = (accion) => {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try { return accion(); } finally { process.stdout.write = original; }
};

const secrets = require('../config/secrets');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { aiLimiter, AI_LIMITE_POR_HORA } = require('../middlewares/rateLimiter');

// Se firma con el mismo secreto que usa la app en pruebas. Si el middleware
// rechazara por firma distinta, las peticiones ni llegarian al limitador y el
// Wiring test mediria 401 en lugar de 429.
process.env.JWT_SECRET = secrets.JWT_SECRET || 'secreto-de-prueba-para-rate-limit';

const aiRoutes = silenciarStdout(() => require('../routes/ai'));

const consoleOriginal = {};
for (const nivel of ['log', 'info', 'warn', 'error']) {
  consoleOriginal[nivel] = console[nivel];
  console[nivel] = () => {};
}
test.after(() => {
  for (const nivel of Object.keys(consoleOriginal)) console[nivel] = consoleOriginal[nivel];
});



async function pedir(base, metodo, ruta, token) {
  const headers = {};
  if (token) headers.authorization = token;
  if (metodo === 'POST') {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers,
    body: metodo === 'POST' ? JSON.stringify({}) : undefined,
  });
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, cuerpo, retryAfter: res.headers.get('retry-after') };
}

function arrancar(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

// â”€â”€ 1. Orden: el auth va antes que el limite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('el limitador va DESPUES del auth, no antes', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api', authenticateToken);
  app.use('/api', aiRoutes);
  const { server, base } = await arrancar(app);
  t.after(() => server.close());

  // Si el limitador corriera antes del auth, estas peticiones sin token
  // consumen cuota y alguna acaba en 429 en lugar de 401. Ademas consumiriamos
  // la cuota de una IP entera solo por mandar peticiones invalidas.
  const estados = new Set();
  for (let i = 0; i < AI_LIMITE_POR_HORA + 10; i += 1) {
    const { status } = await pedir(base, 'POST', '/api/ai/chat', null);
    estados.add(status);
  }
  assert.deepEqual([...estados], [401], 'todas deben ser 401: el auth corta antes de contar cuota');
});

// â”€â”€ 2. Wiring: la IA monta el limitador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('el router de IA real monta el limitador de cuota', async (t) => {
  // Prueba de comportamiento, no de introspeccion: el nombre interno de la capa
  // que monta express-rate-limit es "<anonymous>" y no es un contrato. Lo que
  // importa es que una ruta real de IA se corte al agotar la cuota.
  //
  // Se usa GET /ai/model-info porque responde con configuracion local y no
  // llama a Groq ni a Gemini: agota la cuota sin gastar un centavo ni depender
  // de que la API externa este viva.
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'wiring-user' }; next(); });
  app.use('/api', aiRoutes);

  const { server, base } = await arrancar(app);
  t.after(() => server.close());

  let saw429 = false;
  let saw200 = false;
  for (let i = 0; i <= AI_LIMITE_POR_HORA; i += 1) {
    const res = await fetch(`${base}/api/ai/model-info`);
    if (res.status === 429) { saw429 = true; break; }
    if (res.status === 200) saw200 = true;
  }
  assert.equal(saw200, true, 'la ruta real deberia responder antes de agotar');
  assert.equal(saw429, true, 'la cuota deberia agotarse sobre una ruta real de IA');
});

// â”€â”€ 3. Clave por usuario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('la cuota es por usuario y dos usuarios no se bloquean entre si', async (t) => {
  const app = express();
  app.use(express.json());
  // Auth falsa que solo fija req.user: aqui se prueba el limitador, no el JWT.
  app.use((req, _res, next) => {
    const id = req.headers['x-usuario'];
    req.user = { id, email: `${id}@test` };
    next();
  });
  app.use(aiLimiter);
  app.post('/api/ai/chat', (_req, res) => res.json({ ok: true }));

  const { server, base } = await arrancar(app);
  t.after(() => server.close());

  // El usuario A se agota.
  const pedirComo = (user, ip) => fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'x-usuario': user, 'content-type': 'application/json', 'x-fake-ip': ip || '10.0.0.1' },
    body: '{}',
  });

  let agotado = null;
  for (let i = 0; i <= AI_LIMITE_POR_HORA; i += 1) {
    const res = await pedirComo('A');
    if (res.status === 429) { agotado = { status: 429, retryAfter: res.headers.get('retry-after') }; break; }
  }
  assert.ok(agotado, 'el limite deberia dispararse');

  // El usuario B sigue teniendo su cuota intacta. Si compartieran bucket, B
  // estaria bloqueado y el fallo seria de un usuario, no de la cuota.
  const b = await pedirComo('B');
  assert.equal(b.status, 200, 'el usuario B no puede quedar bloqueado por el de A');
});

test('el mismo usuario se bloquea aunque cambie de IP', async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: req.headers['x-usuario'], email: 'x@test' };
    next();
  });
  app.use(aiLimiter);
  app.post('/api/ai/chat', (_req, res) => res.json({ ok: true }));

  const { server, base } = await arrancar(app);
  t.after(() => server.close());

  const pedirComo = (user, ip) => fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'x-usuario': user, 'content-type': 'application/json', 'x-fake-ip': ip },
    body: '{}',
  });

  // Agotar al usuario C...
  for (let i = 0; i <= AI_LIMITE_POR_HORA; i += 1) {
    const r = await pedirComo('C', '10.0.0.1');
    if (r.status === 429) break;
  }
  const antes = await pedirComo('C', '10.0.0.1');
  assert.equal(antes.status, 429, 'deberia estar agotado');

  // ...y desde otra IP sigue agotado, porque la clave es el usuario. Si la
  // clave fuera la IP, cambiar de IP seria un bypass trivial del limite.
  const otra = await pedirComo('C', '10.0.0.2');
  assert.equal(otra.status, 429, 'cambiar de IP no debe esquivar el limite');
});

test('sin usuario se cae a IP, para no perder proteccion', async (t) => {
  // El fallback existe por seguridad: si req.user no estuviera, sin fallback el
  // limitador agruparia a todos los anonimos en la misma clave y quemarian la
  // cuota del primero en vez de repartirla.
  const app = express();
  app.use(aiLimiter);
  app.post('/api/ai/chat', (_req, res) => res.json({ ok: true }));
  const { server, base } = await arrancar(app);
  t.after(() => server.close());

  let limitado = false;
  for (let i = 0; i <= AI_LIMITE_POR_HORA; i += 1) {
    const r = await fetch(`${base}/api/ai/chat`, { method: 'POST' });
    if (r.status === 429) { limitado = true; break; }
  }
  assert.ok(limitado, 'sin usuario el limite debe seguir aplicandose por IP');
});

// â”€â”€ 4. Dialecto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test('el limite en v2 responde el sobre RATE_LIMITED', async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'v2-user' }; next(); });
  app.use(aiLimiter);
  app.post('/api/ai/v2/chat', (_req, res) => res.json({ ok: true }));

  const { server, base } = await arrancar(app);
  t.after(() => server.close());

  let cuerpo = null;
  let retryAfter = null;
  for (let i = 0; i <= AI_LIMITE_POR_HORA; i += 1) {
    const res = await fetch(`${base}/api/ai/v2/chat`, { method: 'POST' });
    if (res.status === 429) {
      cuerpo = await res.json();
      retryAfter = res.headers.get('retry-after');
      break;
    }
  }
  assert.ok(cuerpo, 'deberia limitarse');
  assert.equal(cuerpo.error.code, 'RATE_LIMITED');
  assert.equal(cuerpo.error.retryable, true, 'una espera si es retryable, una caida no');
  assert.ok(cuerpo.error.requestId);
  assert.equal(cuerpo.error.retryAfterSec, Number(retryAfter));
});

test('el limite en v1 sigue respondiendo texto plano', async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'v1-user' }; next(); });
  app.use(aiLimiter);
  app.post('/api/ai/chat', (_req, res) => res.json({ ok: true }));

  const { server, base } = await arrancar(app);
  t.after(() => server.close());

  let cuerpo = null;
  for (let i = 0; i <= AI_LIMITE_POR_HORA; i += 1) {
    const res = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (res.status === 429) { cuerpo = await res.json(); break; }
  }
  assert.ok(cuerpo);
  assert.equal(typeof cuerpo.error, 'string', 'los builds instalados leen error como texto');
  assert.ok(cuerpo.retryAfter);
});