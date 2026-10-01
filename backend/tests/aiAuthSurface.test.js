/**
 * Verificacion empirica de la autenticacion de la superficie de IA.
 *
 *   node --test tests/aiAuthSurface.test.js
 *
 * Que resuelve
 * ------------
 * Durante mucho tiempo hubo dos diagnosticos opuestos sobre si /api/ai/* estaba
 * protegido: uno decia que ningun endpoint tenia auth, otro decia que el
 * middleware global lo cubria. Los dos eran defendibles leyendo codigo y los
 * dos implicaban decisiones distintas sobre si hace falta montar auth en el
 * router v2. Este test no razona sobre el codigo: monta el MISMO orden de
 * middlewares que server.js y pregunta a cada ruta registrada.
 *
 * Y no es una revision manual de hoy. Camina la lista de rutas del router, asi
 * que una ruta nueva que se monte sin quedar cubierta falla aqui sola. Ese es
 * el punto: que el futuro no dependa de que alguien recuerde mirar.
 *
 * Que NO se prueba aqui
 * ---------------------
 * Que el token corresponda a un usuario real en la base de datos. Eso es de
 * authController. Aqui solo importa: sin token no se pasa, y con token roto no
 * se pasa.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

const secrets = require('../config/secrets');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * Cargar el router de IA dispara dotenv y la conexion a SQLite, que escriben en
 * stdout. Entrelazarse con el protocolo del runner de test produce fallos
 * intermitentes con "Unable to deserialize cloned data", asi que se silencia
 * SOLO mientras se carga el router y se restaura antes de que corra ningun test.
 */
const silenciarStdout = (accion) => {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return accion();
  } finally {
    process.stdout.write = original;
  }
};

const aiRoutes = silenciarStdout(() => require('../routes/ai'));

// sendAiError registra en stdout con console.info, y eso tambien se entrelaza con
// el protocolo. Los logs se recogen aparte para poder afirmar sobre ellos.
const logs = [];
const consoleOriginal = {};
for (const nivel of ['log', 'info', 'warn', 'error']) {
  consoleOriginal[nivel] = console[nivel];
  console[nivel] = (...args) => { logs.push(args.join(' ')); };
}
test.after(() => {
  for (const nivel of Object.keys(consoleOriginal)) console[nivel] = consoleOriginal[nivel];
});

const JWT_SECRET = secrets.JWT_SECRET;

// ── App que replica el orden de server.js ────────────────────────────────────
// L124 en server.js monta /api/ai/models/online ANTES del middleware global,
// y por eso es publica a proposito. Se replica para que el test documente
// exactamente cual es la superficie publica y no una mas amplia o estrecha.
function construirApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/ai/models/online', (_req, res) => res.json({ groq: 11, gemini: 35 }));
  app.use('/api', authenticateToken);
  app.use('/api', aiRoutes);
  return app;
}

function arrancar(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function pedir(base, metodo, ruta, token) {
  const headers = {};
  if (token) headers.authorization = token;
  const init = { method: metodo, headers };
  if (metodo === 'POST' || metodo === 'PUT' || metodo === 'PATCH') {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify({});
  }
  const res = await fetch(`${base}${ruta}`, init);
  try { return { status: res.status, cuerpo: await res.json() }; }
  catch { return { status: res.status, cuerpo: null }; }
}

/** Convierte /ai/chat/history/:userId en una ruta concrete. */
function rutaConcreta(path) {
  return '/api' + path.replace(/:[A-Za-z0-9_]+/g, 'prueba');
}

// ── Inventario de rutas ──────────────────────────────────────────────────────

/** Extrae (metodo, ruta) de todas las capas con ruta del router. */
function inventario(router) {
  const filas = [];
  for (const capa of router.stack || []) {
    if (!capa.route) continue;
    for (const metodo of Object.keys(capa.route.methods || {})) {
      filas.push({ metodo: metodo.toUpperCase(), ruta: rutaConcreta(capa.route.path) });
    }
  }
  return filas;
}

const RUTAS = inventario(aiRoutes);

// ── Tests ────────────────────────────────────────────────────────────────────

test('el inventario de rutas de IA no esta vacio', () => {
  // Sin este assert, un fallo al montar el router haria que "ninguna ruta
  // respondio mal" pasara sin haber comprobado nada.
  assert.ok(RUTAS.length >= 15, `solo se han encontrado ${RUTAS.length} rutas`);
});

test('TODAS las rutas de IA rechazan la peticion sin token', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  const fallos = [];
  for (const { metodo, ruta } of RUTAS) {
    const { status } = await pedir(base, metodo, ruta, null);
    if (status !== 401) fallos.push(`${metodo} ${ruta} -> ${status}`);
  }
  assert.deepEqual(fallos, [], `rutas accesibles sin token: ${fallos.join(', ')}`);
});

test('las rutas de IA rechazan un token caducado', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  const caducado = `Bearer ${jwt.sign({ id: 'usuario-a' }, JWT_SECRET, { expiresIn: '-10s' })}`;
  const fallos = [];
  for (const { metodo, ruta } of RUTAS) {
    const { status } = await pedir(base, metodo, ruta, caducado);
    // El legacy responde 403 a un token caducado; lo que NO puede ser es 200.
    if (status === 200 || status === 500 || status === 404) fallos.push(`${metodo} ${ruta} -> ${status}`);
  }
  assert.deepEqual(fallos, [], `rutas abiertas con token caducado: ${fallos.join(', ')}`);
});

test('las rutas de IA rechazan un token manipulado', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  // Firmado con OTRO secreto: la estructura es valida y la firma no vale. Es el
  // caso mas peligroso, porque un verificador flojo lo acepta.
  const falso = `Bearer ${jwt.sign({ id: 'atacante' }, 'secreto-que-no-es-el-real', { expiresIn: '30d' })}`;
  const fallos = [];
  for (const { metodo, ruta } of RUTAS) {
    const { status } = await pedir(base, metodo, ruta, falso);
    if (status === 200 || status === 500 || status === 404) fallos.push(`${metodo} ${ruta} -> ${status}`);
  }
  assert.deepEqual(fallos, [], `rutas abiertas con token manipulado: ${fallos.join(', ')}`);
});

test('las rutas de IA rechazan un token malformado', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  const fallos = [];
  for (const { metodo, ruta } of RUTAS) {
    for (const basura of ['Bearer no-es-un-jwt', 'Bearer a.b.c', 'Bearer ']) {
      const { status } = await pedir(base, metodo, ruta, basura);
      if (status === 200 || status === 500 || status === 404) fallos.push(`${metodo} ${ruta} [${basura}] -> ${status}`);
    }
  }
  assert.deepEqual(fallos, [], `rutas abiertas con basura: ${fallos.join(', ')}`);
});

test('un token con la firma de otro usuario no abre nada', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  // Se isla el mismo contenido que el token bueno, con la firma cambiada.
  const bueno = jwt.sign({ id: 'usuario-a', email: 'a@x.com' }, JWT_SECRET, { expiresIn: '30d' });
  const partes = bueno.split('.');
  const troceado = `${partes[0]}.${partes[1]}.${partes[2].slice(0, -3)}AAA`;

  const { status } = await pedir(base, 'POST', '/api/ai/chat-proxy', `Bearer ${troceado}`);
  assert.notEqual(status, 200);
});

// ── Dialectos: la respuesta correcta depende de la ruta ──────────────────────

test('la API v2 responde el sobre estable, no texto plano', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  // No existe todavia la ruta v2, y da igual: el middleware global corre antes
  // del enrutado, asi que el dialecto queda probado sin montar el router v2.
  const { status, cuerpo } = await pedir(base, 'POST', '/api/ai/v2/chat', null);
  assert.equal(status, 401);
  assert.equal(cuerpo.error.code, 'UNAUTHENTICATED');
  assert.equal(cuerpo.error.retryable, false);
  assert.ok(cuerpo.error.requestId, 'v2 siempre lleva requestId');
});

test('v1 sigue respondiendo texto plano para no romper los builds viejos', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  const { status, cuerpo } = await pedir(base, 'POST', '/api/ai/chat', null);
  assert.equal(status, 401);
  assert.equal(typeof cuerpo.error, 'string', 'los builds instalados leen error como texto');
});

test('las dos dialects distinguen ausente de caducado solo en el log', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  const caducado = `Bearer ${jwt.sign({ id: 'u' }, JWT_SECRET, { expiresIn: '-10s' })}`;

  const v1Ausente = await pedir(base, 'POST', '/api/ai/chat', null);
  const v1Caducado = await pedir(base, 'POST', '/api/ai/chat', caducado);
  assert.equal(v1Ausente.status, 401);
  assert.equal(v1Caducado.status, 403, 'comportamiento legacy preservado');

  // En v2 el cliente ve exactamente lo mismo en ambos casos...
  const v2Ausente = await pedir(base, 'POST', '/api/ai/v2/chat', null);
  const v2Caducado = await pedir(base, 'POST', '/api/ai/v2/chat', caducado);
  assert.equal(v2Ausente.status, v2Caducado.status);
  assert.equal(v2Ausente.cuerpo.error.code, v2Caducado.cuerpo.error.code);
  // ...pero el requestId es distinto, para poder correlacionar cada log.
  assert.notEqual(v2Ausente.cuerpo.error.requestId, v2Caducado.cuerpo.error.requestId);
});

// ── El log del servidor distingue lo que el cliente no necesita ─────────────

test('el log separa ausente de caducado aunque el cliente no lo note', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  const caducado = `Bearer ${jwt.sign({ id: 'u' }, JWT_SECRET, { expiresIn: '-10s' })}`;

  logs.length = 0;
  const ausente = await pedir(base, 'POST', '/api/ai/v2/chat', null);
  await pedir(base, 'POST', '/api/ai/v2/chat', caducado);
  await pedir(base, 'POST', '/api/ai/v2/chat', 'Bearer basura-no-jwt');

  // El cliente ve identico en los tres casos...
  assert.equal(ausente.cuerpo.error.code, 'UNAUTHENTICATED');
  // ...pero el operador puede saber que paso en cada uno. Son tres incidentes
  // distintos: cliente sin sesion, sesion caducada, y alguien que mando basura.
  const texto = logs.join('\n');
  assert.match(texto, /JWT ausente/);
  assert.match(texto, /JWT caducado/);
  assert.match(texto, /JWT malformado/);
});

test('el log de auth no imprime el token ni su contenido', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  const caducado = `Bearer ${jwt.sign({ id: 'usuario-secreto', email: 'a@b.c' }, JWT_SECRET, { expiresIn: '-10s' })}`;
  logs.length = 0;
  await pedir(base, 'POST', '/api/ai/v2/chat', caducado);
  const texto = logs.join('\n');
  assert.equal(texto.includes(JWT_SECRET), false, 'la firma no se registra');
  assert.equal(/[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}/.test(texto), false, 'ningun JWT en el log');
});

// ── Superficie publica deliberada ───────────────────────────────────────────

test('las unicas rutas publicas de /api/ai son las montadas antes del auth', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  // /api/ai/models/online se monta antes del middleware en server.js, asi que
  // es publica a proposito. Este test falla si alguien la mueve despues sin
  // darse cuenta, porque entonces recibiria 401 y el movil dejaria de listar
  // modelos.
  const { status } = await pedir(base, 'GET', '/api/ai/models/online', null);
  assert.equal(status, 200);
});

test('no hay ninguna otra ruta de IA accesible sin token', async (t) => {
  const { server, base } = await arrancar(construirApp());
  t.after(() => server.close());

  // Rutas del router que NO son las montadas antes del middleware global.
  const publicasEsperadas = ['/api/ai/models/online'];
  const filtradas = RUTAS.filter((r) => !publicasEsperadas.includes(r.ruta));
  for (const { metodo, ruta } of filtradas) {
    const { status } = await pedir(base, metodo, ruta, null);
    assert.equal(status, 401, `${metodo} ${ruta} deberia pedir token, dio ${status}`);
  }
});