/**
 * Tests de la integracion con Supadata, con fetch simulado.
 *
 * Se simula fetch en vez de llamar a la API porque el camino que importa aqui es
 * el asincrono (202 + jobId), que en la API real solo se activa con videos de
 * mas de ~20 minutos y cuesta credits. El bug original era exactamente que ese
 * camino no existia, asi que probarlo con un doble es la forma honesta de
 * verificarlo.
 *
 *   node --test tests/supadata.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// youtubeController abre una conexion SQLite al importarse. Bajo el runner de
// node --test esa salida nativa corrompe el canal IPC del runner y este aborta
// con "Unable to deserialize cloned data". Se sustituye el modulo db por un stub
// antes de cargar el controller: estos tests no tocan la base de datos.
const dbPath = require.resolve('../db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { db: {} },
  children: [],
  paths: [],
};

const controller = require('../controllers/youtubeController');

const ORIGINAL_FETCH = global.fetch;

function json(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body, text: async () => JSON.stringify(body) };
}

function fakeRes() {
  return {
    code: null,
    payload: null,
    status(code) { this.code = code; return this; },
    // En el camino de éxito Express responde con res.json() sin pasar por
    // status(), así que el código por defecto es 200.
    json(payload) { if (this.code === null) this.code = 200; this.payload = payload; return this; },
  };
}

/** Reemplaza fetch por un guion de respuestas en orden. */
function scriptFetch(steps) {
  const calls = [];
  let i = 0;
  global.fetch = async (url) => {
    calls.push(String(url));
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (typeof step === 'function') return step(String(url), calls.length);
    return step;
  };
  return calls;
}

test.afterEach(() => { global.fetch = ORIGINAL_FETCH; });

test('vía síncrona devuelve los subtítulos tal cual', async () => {
  scriptFetch([json(200, { lang: 'en', content: 'hola mundo largo' })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'abc', language: 'en' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.captions, 'hola mundo largo');
  assert.equal(res.payload.source, 'supadata');
});

test('contenido por chunks se une en texto plano', async () => {
  scriptFetch([json(200, { lang: 'es', content: [{ text: 'primera parte' }, { text: 'segunda parte' }] })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'abc', language: 'es' } }, res);
  assert.equal(res.payload.captions, 'primera parte segunda parte');
});

test('202 encola un job y entrega el resultado al terminar (regresión del bug)', async () => {
  // El bug: response.ok es true en 202, se leia data.content (undefined) y se
  // respondia 404 "subtitulos vacios" en vez de hacer polling.
  scriptFetch([
    json(202, { jobId: 'job-123' }),
    json(200, { status: 'queued' }),
    json(200, { status: 'completed', lang: 'es', content: 'transcripcion asincrona completa' }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'largo', language: 'es' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.captions, 'transcripcion asincrona completa');
  assert.equal(res.payload.async, true);
});

test('202 con jobId en la misma respuesta tambien se consulta (cambio a mitad de vuelo)', async () => {
  scriptFetch([
    json(200, { jobId: 'job-xyz', status: 'active' }),
    json(200, { status: 'completed', lang: 'en', content: 'resultado diferido del job' }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'en' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.captions, 'resultado diferido del job');
});

test('un job fallido propaga el motivo de Supadata', async () => {
  scriptFetch([
    json(202, { jobId: 'job-fail' }),
    json(200, { status: 'failed', error: { error: 'transcript-unavailable', message: 'sin audio' } }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es' } }, res);
  assert.equal(res.code, 404);
  assert.match(res.payload.details, /transcript-unavailable/);
});

test('206 transcript-unavailable se trata como fallo, no como éxito', async () => {
  // 206 es 2xx, asi que response.ok era true y el codigo lo aceptaba como
  // respuesta valida con un cuerpo de error.
  scriptFetch([json(206, { error: 'transcript-unavailable', message: 'no hay subtitulos' })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es' } }, res);
  assert.equal(res.code, 404);
  assert.match(res.payload.details, /transcript-unavailable/);
});

test('reintenta en inglés cuando el idioma pedido no está disponible (native)', async () => {
  // El endpoint actual no devuelve 206: llega 404 transcript-unavailable.
  // Y el reintento por idioma solo es barato en native (1 credito por intento).
  scriptFetch([
    json(404, { error: 'transcript-unavailable', message: 'no hay es' }),
    json(200, { lang: 'en', content: 'english fallback transcript' }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es', mode: 'native' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.captions, 'english fallback transcript');
  assert.equal(res.payload.language, 'en');
});

test('usa el endpoint /transcript, no el /youtube/transcript deprecado', async () => {
  const calls = scriptFetch([json(200, { lang: 'en', content: 'texto suficiente para pasar el minimo' })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'abc', language: 'en' } }, res);
  assert.ok(calls[0].includes('/v1/transcript?'));
  assert.ok(!calls.some((c) => c.includes('/youtube/transcript')));
  assert.ok(calls[0].includes('url='), 'el endpoint nuevo pide url, no videoId');
});

test('un transcript vacío se considera fallo y no se devuelve como éxito', async () => {
  scriptFetch([json(200, { lang: 'en', content: '' })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'en' } }, res);
  assert.equal(res.code, 404);
  assert.match(res.payload.details, /vacio/);
});

test('el modo se propaga a la API solo si el cliente lo pide', async () => {
  const calls = scriptFetch([json(200, { lang: 'en', content: 'contenido valido para el test' })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'abc', language: 'en', mode: 'native' } }, res);
  assert.ok(calls[0].includes('mode=native'));
});

test('un job fallido no se relanza probando otros idiomas', async () => {
  // Reintentar crearia otro job, y cada job asincrono se cobra. El fallo del job
  // no es un problema de idioma, asi que no debe disparar el bucle de idiomas.
  const calls = scriptFetch([
    json(202, { jobId: 'job-fallido' }),
    json(200, { status: 'failed', error: { error: 'internal-error', message: 'fallo de supadata' } }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es' } }, res);
  assert.equal(res.code, 404);
  assert.match(res.payload.details, /internal-error/);
  assert.equal(calls.length, 2, 'una peticion + una consulta de job, sin relanzar');
});

test('un 206 se trata como fallo y no como éxito, ni aunque response.ok sea true', async () => {
  // El 206 pertenece al endpoint deprecado, pero si Supadata lo reutilizara
  // seria un 2xx: sin esta guarda, devolveria 200 sin transcripcion al usuario
  // habiendole cobrado el credito.
  const calls = scriptFetch([
    json(206, { error: 'transcript-unavailable', message: 'no hay en es' }),
    json(200, { lang: 'en', content: 'english after retry' }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es', mode: 'native' } }, res);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 2, 'en native si puede reintentarse con otro idioma');
  assert.ok(calls[0].includes('mode=native'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Modo y coste.
//
// Pricing oficial de Supadata: native = 1 credito; generate = 2 creditos POR
// MINUTO de video; el 206 cobra 1 credito; consultar el job es gratis.
// El endpoint nuevo /transcript NO devuelve 206: esa respuesta pertenece al
// endpoint deprecado /youtube/transcript. En el actual llega un 404 con
// error "transcript-unavailable".
// ─────────────────────────────────────────────────────────────────────────────

test('un mode fuera del enum se rechaza antes de gastar un credito', async () => {
  const calls = scriptFetch([json(200, { lang: 'en', content: 'no deberia llegarse a llamar' })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', mode: 'inventado' } }, res);
  assert.equal(res.code, 400);
  assert.match(res.payload.error, /mode invalido/);
  assert.equal(calls.length, 0, 'no debe llamar a Supadata con un mode invalido');
});

test('los tres modos validos se aceptan', async () => {
  for (const mode of ['native', 'auto', 'generate']) {
    const calls = scriptFetch([json(200, { lang: 'en', content: 'contenido valido de prueba' })]);
    const res = fakeRes();
    await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'en', mode } }, res);
    assert.equal(res.code, 200, `mode=${mode} deberia funcionar`);
    assert.ok(calls[0].includes(`mode=${mode}`));
  }
});

test('en mode auto NO se reintenta con otros idiomas: cada uno cobra 2 creditos por minuto', async () => {
  // El endpoint nuevo responde 404 con transcript-unavailable, no 206.
  const calls = scriptFetch([
    json(404, { error: 'transcript-unavailable', message: 'no hay transcript' }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es', mode: 'auto' } }, res);
  assert.equal(res.code, 404);
  assert.match(res.payload.details, /transcript-unavailable/);
  assert.equal(calls.length, 1, 'un unico intento: reintentar en auto vuelve a generar y factura');
});

test('en mode native SI se reintenta con otros idiomas: 1 credito cada uno', async () => {
  // En native el 404 es barato y puede que exista subtitulo en otro idioma.
  const calls = scriptFetch([
    json(404, { error: 'transcript-unavailable', message: 'no hay en es' }),
    json(200, { lang: 'en', content: 'english after retry' }),
  ]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es', mode: 'native' } }, res);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('mode=native'));
});

test('un 400 de Supadata no se reintenta: no es un problema de idioma', async () => {
  const calls = scriptFetch([json(400, { error: 'invalid-request', message: 'mal formada' })]);
  const res = fakeRes();
  await controller.getYoutubeCaptions({ body: { video_id: 'v', language: 'es', mode: 'native' } }, res);
  assert.equal(res.code, 404);
  assert.match(res.payload.details, /invalid-request/);
  assert.equal(calls.length, 1, 'un 400 se repetiria identico con cada idioma');
});
