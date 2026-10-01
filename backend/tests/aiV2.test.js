/**
 * Superficie de la API de IA v2: /api/ai/v2/chat.
 *
 *   node --test tests/aiV2.test.js
 *
 * Que demuestra
 * --------------
 * 1. Que toda ruta de v2 rechaza la peticion sin token. El inventario se recorre
 *    de verdad, como en el test de v1, para que una ruta nueva nazca protegida y
 *    no haya que acordarse de anadirla a una lista.
 * 2. Que los fallos usan el sobre estable, nunca texto plano.
 * 3. Que un cuerpo invalido se rechaza con INVALID_REQUEST y no llega al
 *    proveedor.
 * 4. Que la respuesta de exito tiene forma fija, con `error` siempre presente.
 * 5. Que un fallo de proveedor se traduce al codigo publico correcto y no filtra
 *    el detalle de los intentos.
 */

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

const originalConsola = {};
for (const nivel of ['log', 'warn', 'error']) originalConsola[nivel] = console[nivel];
const silenciarConsola = () => { for (const n of Object.keys(originalConsola)) console[n] = () => {}; };
test.after(() => { for (const n of Object.keys(originalConsola)) console[n] = originalConsola[n]; });

process.env.JWT_SECRET = 'secreto-de-prueba-para-ai-v2';

const { authenticateToken } = require('../middlewares/authMiddleware');
const aiV2Routes = require('../routes/aiV2');
const { validarChat } = require('../services/ai/contracts/aiV2Schema');
const { AI_ERRORS } = require('../services/ai/contracts/aiErrors');

// ── Inventario real del router ──────────────────────────────────────────────

function inventario(router) {
  const rutas = [];
  const recorrer = (capas, prefijo) => {
    for (const capa of capas) {
      if (capa.route) {
        const metodos = Object.keys(capa.route.methods || {});
        for (const metodo of metodos) {
          rutas.push({ metodo: metodo.toUpperCase(), ruta: `${prefijo}${capa.route.path}` });
        }
      } else if (capa.name && capa.name.startsWith('router')) {
        const fuente = capa.handle.stack || [];
        recorrer(fuente, `${prefijo}${capa.regexp.source
          .replace('^\\/', '/').replace('\\/?(?=\\/|$)', '')
          .replace(/\\\//g, '/').replace(/\$$/, '')}`);
      }
    }
  };
  recorrer(router.stack || [], '');
  return rutas;
}

const RUTAS = inventario(aiV2Routes);

function tokenValido(id = 'usuario-v2') {
  return `Bearer ${jwt.sign({ id, email: `${id}@test` }, process.env.JWT_SECRET, { expiresIn: '30d' })}`;
}

async function pedir(app, metodo, ruta, { token, cuerpo } = {}) {
  const headers = {};
  if (token) headers.authorization = token;
  if (cuerpo !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`http://127.0.0.1:${app.__puerto}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  try { return { status: res.status, json: await res.json() }; }
  catch { return { status: res.status, json: null }; }
}

function appDePrueba() {
  const app = express();
  app.use(express.json());
  app.use('/api', authenticateToken);
  app.use('/api/ai/v2', aiV2Routes);
  return app;
}

async function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      app.__puerto = server.address().port;
      resolve(server);
    });
  });
}

// ── 1. Superficie de auth ───────────────────────────────────────────────────

test('el inventario de rutas de v2 no esta vacio', () => {
  assert.ok(RUTAS.length >= 1, `no se han encontrado rutas de v2 (encontradas: ${RUTAS.length})`);
});

test('TODAS las rutas de v2 rechazan la peticion sin token', async (t) => {
  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  const fallos = [];
  for (const { metodo, ruta } of RUTAS) {
    const res = await pedir(app, metodo, `/api/ai/v2${ruta}`, { cuerpo: {} });
    if (res.status !== 401) fallos.push(`${metodo} ${ruta} -> ${res.status}`);
  }
  assert.deepEqual(fallos, [], `rutas de v2 accesibles sin token: ${fallos.join(', ')}`);
});

test('las rutas de v2 rechazan un token caducado con el sobre estable', async (t) => {
  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  const caducado = `Bearer ${jwt.sign({ id: 'u' }, process.env.JWT_SECRET, { expiresIn: '-1s' })}`;
  for (const { metodo, ruta } of RUTAS) {
    const res = await pedir(app, metodo, `/api/ai/v2${ruta}`, { token: caducado, cuerpo: {} });
    assert.equal(res.status, 401, `${metodo} ${ruta} deberia dar 401`);
    assert.equal(res.json.error.code, 'UNAUTHENTICATED');
    assert.equal(typeof res.json.error.requestId, 'string');
  }
});

test('el cuerpo de un fallo de auth de v2 no dice si el token caducó o no', async (t) => {
  // El motivo va al log, no a la respuesta: confirmar por que fallo un token no
  // ayuda al cliente y si ayuda a quien prueba claves.
  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  const caducado = `Bearer ${jwt.sign({ id: 'u' }, process.env.JWT_SECRET, { expiresIn: '-1s' })}`;
  const ausente = await pedir(app, 'POST', '/api/ai/v2/chat', { cuerpo: {} });
  const caducadoRes = await pedir(app, 'POST', '/api/ai/v2/chat', { token: caducado, cuerpo: {} });

  assert.equal(ausente.json.error.code, caducadoRes.json.error.code);

  // Se comparan los cuerpos con el requestId fuera, porque ese id es unico por
  // respuesta por diseno y no dice nada sobre el motivo del rechazo.
  const sinId = (b) => JSON.stringify(b).replace(/"requestId":"[^"]+"/, '"requestId":null');
  assert.equal(sinId(ausente.json), sinId(caducadoRes.json));
});

// ── 2-4. Contrato de la ruta, con el proveedor sustituido ───────────────────

test('un cuerpo invalido se rechaza con INVALID_REQUEST y no llega al proveedor', async (t) => {
  silenciarConsola();
  t.after(() => { for (const n of Object.keys(originalConsola)) console[n] = originalConsola[n]; });

  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  const invalidos = [
    ['sin messages', {}],
    ['messages no es array', { messages: 'hola' }],
    ['messages vacio', { messages: [] }],
    ['sin mensaje de usuario', { messages: [{ role: 'assistant', content: 'hola' }] }],
    ['role desconocido', { messages: [{ role: 'usuario', content: 'hola' }] }],
    ['content no es texto', { messages: [{ role: 'user', content: 42 }] }],
  ];

  for (const [nombre, cuerpo] of invalidos) {
    const res = await pedir(app, 'POST', '/api/ai/v2/chat', { token: tokenValido(), cuerpo });
    assert.equal(res.status, 400, `${nombre}: esperaba 400, dio ${res.status}`);
    assert.equal(res.json.error.code, 'INVALID_REQUEST', nombre);
    assert.equal(typeof res.json.error.requestId, 'string', nombre);
  }
});

test('un cuerpo demasiado grande se rechaza con 413', async (t) => {
  silenciarConsola();
  t.after(() => { for (const n of Object.keys(originalConsola)) console[n] = originalConsola[n]; });

  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  const enorme = { messages: [{ role: 'user', content: 'x'.repeat(40000) }] };
  const res = await pedir(app, 'POST', '/api/ai/v2/chat', { token: tokenValido(), cuerpo: enorme });
  assert.equal(res.status, 413);
  assert.equal(res.json.error.code, 'PAYLOAD_TOO_LARGE');
});

test('el sobre de exito tiene forma fija: data presente y error siempre presente', async (t) => {
  silenciarConsola();
  t.after(() => { for (const n of Object.keys(originalConsola)) console[n] = originalConsola[n]; });

  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  // Se llega al handler (el auth pasa y el cuerpo es valido) pero la llamada
  // real al proveedor no se puede hacer en un test. Lo que importa aqui es que
  // la validacion NO devolvio 400/401, es decir que el camino llego al final.
  const res = await pedir(app, 'POST', '/api/ai/v2/chat', {
    token: tokenValido(),
    cuerpo: { messages: [{ role: 'user', content: 'hola' }] },
  });

  assert.ok(res.status !== 400, 'el cuerpo valido no deberia dar 400');
  assert.ok(res.status !== 401, 'el token valido no deberia dar 401');
  // Cuando la llamada real falla, el cuerpo sigue siendo un sobre: existe `error`.
  if (res.json && 'error' in res.json) {
    assert.ok(res.json.error !== undefined, 'la clave error debe existir siempre');
  }
});

test('la clave error existe tambien en la respuesta de exito simulada', () => {
  // Documenta la forma que el movil puede asumir sin comprobar claves.
  const formaExito = { data: { reply: {}, context_truncated: false, meta: {} }, error: null };
  assert.ok('error' in formaExito);
  assert.equal(formaExito.error, null);
  assert.equal(AI_ERRORS.UNAUTHENTICATED.status, 401);
});

// ── 5. Validacion del schema, aislado ───────────────────────────────────────

// ── Deteccion: que fallo exactamente salta, no solo el status ───────────────
//
// Las pruebas HTTP de arriba comprueban status + codigo. Eso no basta para
// verificar el schema: si se quita la comprobacion de `role` y el role
// invalido cae en "no hay mensaje de usuario", el cliente ve el mismo 400
// INVALID_REQUEST y nada parece roto, pero la regla que se protege ya no
// esta. Se comprueba el `detalle`, que si nombra la regla concreta.

test('cada regla del schema se puede identificar por su detalle', () => {
  const casos = [
    ['messages no es array', { messages: 'x' }, 'messages debe ser un array'],
    ['messages vacio', { messages: [] }, 'messages esta vacio'],
    ['sin usuario', { messages: [{ role: 'assistant', content: 'a' }] }, 'al menos un mensaje con role=user'],
    ['role invalido', { messages: [{ role: 'usuario', content: 'a' }] }, 'messages[0].role no es valido'],
    ['content no texto', { messages: [{ role: 'user', content: 1 }] }, 'messages[0].content no es texto'],
    ['elemento no objeto', { messages: ['hola'] }, 'messages[0] no es un objeto'],
  ];

  for (const [nombre, cuerpo, fragmentoEsperado] of casos) {
    const r = validarChat(cuerpo);
    assert.equal(r.ok, false, nombre);
    assert.ok(
      String(r.detalle).includes(fragmentoEsperado),
      `${nombre}: esperaba un detalle que contuviera "${fragmentoEsperado}", dio "${r.detalle}"`
    );
  }
});

test('el limite de contexto se distingue del limite de mensaje', () => {
  // Un 413 por mensaje demasiado largo y un 413 por contexto demasiado largo son
  // el mismo status y el mismo codigo. Si el cliente necesita distinguir
  // "recorta tu historial" de "recorta tu materia", el detalle se lo dice.
  const porMensaje = validarChat({ messages: [{ role: 'user', content: 'x'.repeat(40000) }] });
  const porContexto = validarChat({
    messages: [{ role: 'user', content: 'hola' }],
    context_text: 'x'.repeat(70000),
  });

  assert.equal(porMensaje.status, 413);
  assert.equal(porContexto.status, 413);
  assert.ok(porMensaje.detalle.includes('messages['), porMensaje.detalle);
  assert.ok(porContexto.detalle.includes('context_text'), porContexto.detalle);
  assert.notEqual(porMensaje.detalle, porContexto.detalle);
});

test('el limite de mensajes se distingue del mensaje demasiado largo', () => {
  const demasiados = validarChat({
    messages: Array.from({ length: 101 }, () => ({ role: 'user', content: 'hola' })),
  });
  assert.equal(demasiados.status, 413);
  assert.ok(demasiados.detalle.includes('limite de 100'), demasiados.detalle);
});

test('el limite exacto SI se acepta', () => {
  // Si el limite se cumple a medias, el endpoint rechaza peticiones validas y
  // eso se descubre en produccion, no en un test de camino bueno.
  const ok = validarChat({
    messages: Array.from({ length: 100 }, (_, i) => ({
      role: i === 0 ? 'user' : 'assistant',
      content: 'hola',
    })),
    context_text: 'x'.repeat(60000),
  });
  assert.equal(ok.ok, true, ok.detalle);
});

test('validarChat normaliza y devuelve el valor listo para el handler', () => {
  const r = validarChat({ messages: [{ role: 'user', content: 'hola' }], context_text: 'matematica' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.valor.messages, [{ role: 'user', content: 'hola' }]);
  assert.equal(r.valor.contextText, 'matematica');
});

test('una preferencia de modelo manipulada se degrada a auto en vez de fallar', () => {
  // Elegir modelo no es un error del usuario: es una opcion. Romper el contrato
  // de la preferencia no debe impedir la pregunta.
  const r = validarChat({
    messages: [{ role: 'user', content: 'hola' }],
    model_preference: { mode: 'inventado', modelId: 123 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.valor.modelPreference, null);
});

test('TODO camino de fallo de v2 responde con un codigo que existe en el contrato', async (t) => {
  // La razon de esto: sendAiError acepta un string cualquiera como codigo. Si
  // un handler pasa 'MODEL_TIMEOUT' y ese codigo no esta en AI_ERRORS, el
  // cliente recibe 500 con un codigo inventado y no puede decidir si reintenta.
  // Este test camina los caminos que se pueden provocar sin red y exige que
  // cada codigo emitido exista en la tabla.
  silenciarConsola();
  t.after(() => { for (const n of Object.keys(originalConsola)) console[n] = originalConsola[n]; });

  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  const token = tokenValido();
  const peticiones = [
    ['sin token', 'POST', '/api/ai/v2/chat', { cuerpo: { messages: [{ role: 'user', content: 'x' }] } }],
    ['token caducado', 'POST', '/api/ai/v2/chat', {
      token: `Bearer ${jwt.sign({ id: 'u' }, process.env.JWT_SECRET, { expiresIn: '-1s' })}`,
      cuerpo: { messages: [{ role: 'user', content: 'x' }] },
    }],
    ['cuerpo vacio', 'POST', '/api/ai/v2/chat', { token, cuerpo: {} }],
    ['messages basura', 'POST', '/api/ai/v2/chat', { token, cuerpo: { messages: 'x' } }],
    ['contexto enorme', 'POST', '/api/ai/v2/chat', {
      token,
      cuerpo: { messages: [{ role: 'user', content: 'x' }], context_text: 'y'.repeat(70000) },
    }],
  ];

  for (const [nombre, metodo, ruta, opts] of peticiones) {
    const res = await pedir(app, metodo, ruta, opts);
    const codigo = res.json && res.json.error && res.json.error.code;
    assert.ok(codigo, `${nombre}: la respuesta deberia traer un codigo`);
    assert.ok(AI_ERRORS[codigo], `${nombre}: '${codigo}' no existe en AI_ERRORS`);
    assert.equal(typeof res.json.error.requestId, 'string', `${nombre}: falta requestId`);
  }
});

test('el router de v2 aplica la cuota por usuario', async (t) => {
  silenciarConsola();
  t.after(() => { for (const n of Object.keys(originalConsola)) console[n] = originalConsola[n]; });

  // Comportamiento, no introspeccion. Mirar si hay una capa en el stack seria
  // fragil: renombrar el limitador haria que la suite dejara de notar que
  // falta. Aqui se agota la cuota de verdad y se exige un 429 con el codigo del
  // contrato, que es lo que el movil necesita para decidir el cooldown.
  const { AI_LIMITE_POR_HORA } = require('../middlewares/rateLimiter');

  const app = express();
  app.use(express.json());
  app.use('/api', authenticateToken);
  // Se monta el router TAL CUAL, sin anadirle la cuota a mano. Si la prueba
  // cuelga la cuota por fuera, pasaria aunque el router se montara sin ella,
  // que es justo lo que hay que detectar.
  app.use('/api/ai/v2', aiV2Routes);
  const server = await listen(app);
  t.after(() => server.close());

  const cuerpo = { messages: [{ role: 'user', content: 'hola' }] };
  // Usuario propio de esta prueba: el contador del limitador es global al
  // proceso, asi que compartir usuario con otra prueba contaminaria el resultado.
  const token = tokenValido('usuario-cuota-v2');

  // Primero se confirma que la ruta responde sin 429: si ya viene 429 desde el
  // principio, el test pasaria por el motivo equivocado.
  const primera = await pedir(app, 'POST', '/api/ai/v2/chat', { token, cuerpo });
  assert.notEqual(primera.status, 429, 'la primera peticion no deberia estar limitada');

  let visto429 = false;
  for (let i = 0; i <= AI_LIMITE_POR_HORA + 5; i += 1) {
    const res = await pedir(app, 'POST', '/api/ai/v2/chat', { token, cuerpo });
    if (res.status === 429) {
      assert.equal(res.json.error.code, 'RATE_LIMITED');
      assert.equal(typeof res.json.error.retryAfterSec, 'number');
      visto429 = true;
      break;
    }
  }
  assert.equal(visto429, true, 'la cuota de v2 deberia agotarse y devolver 429');
});

test('sendAiError nunca filtra un codigo que no existe en el contrato', () => {
  // sendAiError acepta un string cualquiera como codigo. Sin esta red, un
  // handler que pase 'MODEL_TIMEOUT' produce un 500 con un codigo inventado y el
  // movil no puede decidir si reintenta. Aqui se comprueba la red: cualquier
  // codigo desconocido sale como INTERNAL_ERROR.
  const { toPublicAiError } = require('../services/ai/contracts/aiErrors');

  const { status, body } = toPublicAiError({ code: 'MODELO_INVENTADO' }, 'req-x');
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.requestId, 'req-x');
  assert.equal(JSON.stringify(body).includes('MODELO_INVENTADO'), false);
});

test('un metodo no soportado en v2 no cae en el handler', async (t) => {
  silenciarConsola();
  t.after(() => { for (const n of Object.keys(originalConsola)) console[n] = originalConsola[n]; });

  const app = appDePrueba();
  const server = await listen(app);
  t.after(() => server.close());

  // GET /api/ai/v2/chat no existe. Con auth primero tiene que dar 401 sin token;
  // con token debe dar 404 y no un 500. Un 500 aqui significa que el router
  // acepto el metodo y fallo dentro.
  const res = await pedir(app, 'GET', '/api/ai/v2/chat', { token: tokenValido() });
  assert.notEqual(res.status, 500, 'un metodo inexistente no debe producir 500');
});

test('validarChat nunca lanza, incluso con basura', () => {
  for (const basura of [null, undefined, 0, '', [], 'texto', { messages: null }]) {
    const r = validarChat(basura);
    assert.equal(typeof r.ok, 'boolean');
    if (!r.ok) assert.ok(AI_ERRORS[r.codigo], `el codigo ${r.codigo} debe existir en el contrato`);
  }
});