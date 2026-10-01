/**
 * Tests de contrato del modulo de errores de la API de IA.
 *
 *   node --test tests/aiErrors.test.js
 *
 * Que se protege aqui
 * -------------------
 * El sobre publico es un contrato con el movil. Si un codigo cambia de estado
 * HTTP o de semantica de retryable, el AIClient decide mal: o cae a local
 * cuando no deberia, o se queda esperando cuando si deberia.
 *
 * El test mas importante es el del 401 de proveedor. Un 401 de Groq (API key
 * rota) y un 401 de usuario (JWT caducado) son el mismo numero y significan
 * cosas opuestas. Confundirlos manda al cliente a un refresh infinito de token
 * mientras el backend sigue roto, y el usuario ve "tu sesion expiro" sin
 * tener nada que ver.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { AI_ERRORS, toPublicAiError, sendAiError } = require('../services/ai/contracts/aiErrors');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Reproduce el error que lanza modelRegistry al agotarse todos los candidatos. */
function agotado(provider = 'groq') {
  const err = new Error(`Sin modelos disponibles en ${provider} para 'text'.`);
  err.code = `${provider.toUpperCase()}_ALL_MODELS_EXHAUSTED`;
  err.attempts = [{ model: 'gemini-3.8-flash', reason: 'provisional', status: 503 }];
  return err;
}

/** Reproduce el error que lanza modelRegistry cuando el proveedor rechaza la credencial. */
function authDeProveedor(provider = 'groq', status = 401) {
  const err = new Error(`Provider ${provider}: credencial rechazada (HTTP ${status})`);
  err.code = `${provider.toUpperCase()}_AUTH_BLOCKED`;
  err.status = status;
  return err;
}

// ── Sobre de respuesta ───────────────────────────────────────────────────────

test('el sobre tiene siempre la misma forma', () => {
  const { body } = toPublicAiError(agotado(), 'req-1');
  assert.deepEqual(Object.keys(body), ['error']);
  assert.equal(body.error.code, 'NO_MODEL_AVAILABLE');
  assert.equal(typeof body.error.retryable, 'boolean');
  assert.equal(body.error.requestId, 'req-1');
});

test('el requestId se genera si no lo pasan', () => {
  const a = toPublicAiError(agotado());
  const b = toPublicAiError(agotado());
  assert.ok(a.body.error.requestId);
  assert.notEqual(a.body.error.requestId, b.body.error.requestId);
});

test('el mensaje del proveedor nunca viaja al cliente', () => {
  const interno = agotado();
  interno.message = 'Sin modelos disponibles en groq: gpt-oss-120b retirado, quota agotada';
  const { body, logDetail } = toPublicAiError(interno, 'req-2');
  assert.equal(JSON.stringify(body).includes('gpt-oss-120b'), false);
  assert.equal(JSON.stringify(body).includes('quota'), false);
  // Pero el servidor si lo necesita para diagnosticar.
  assert.match(logDetail, /gpt-oss-120b/);
});

test('la lista de intentos fallidos no viaja al cliente', () => {
  const { body } = toPublicAiError(agotado(), 'req-3');
  assert.equal(body.error.attempts, undefined);
  assert.equal(JSON.stringify(body).includes('attempts'), false);
});

// ── Un codigo ya publico pasa intacto ───────────────────────────────────────

test('un codigo publico no se reinterpreta', () => {
  // Un limitador sabe que va a responder RATE_LIMITED antes de llamar. Si tiene
  // que disfrazarlo de error interno, el dia que olvide el status el 429 sale
  // como 500 y el movil cree que el backend esta caido en vez de que debe
  // esperar. El pass-through evita esa clase de error silencioso.
  for (const code of Object.keys(AI_ERRORS)) {
    const { status, body } = toPublicAiError({ code }, 'req-pt');
    assert.equal(body.error.code, code, `${code} deberia pasar intacto`);
    assert.equal(status, AI_ERRORS[code].status);
  }
});

test('RATE_LIMITED en pass-through conserva el retryAfter que le pasan', () => {
  const { status, body } = toPublicAiError({ code: 'RATE_LIMITED', retryAfterSec: 90 }, 'req-pt2');
  assert.equal(status, 429);
  assert.equal(body.error.retryAfterSec, 90);
  assert.equal(body.error.retryable, true);
});

test('RATE_LIMITED en pass-through sin retryAfter usa el valor por defecto', () => {
  const { body } = toPublicAiError({ code: 'RATE_LIMITED' }, 'req-pt3');
  assert.equal(body.error.retryAfterSec, 30);
});

test('el pass-through no filtra detalles internos', () => {
  const { body } = toPublicAiError({ code: 'NOT_FOUND', message: 'deck 42 es de otro usuario' }, 'req-pt4');
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(JSON.stringify(body).includes('42'), false);
});

test('un codigo desconocido NO pasa: se sigue traduciendo', () => {
  // El pass-through es solo para la tabla publica. Un codigo que no esta en ella
  // tiene que seguir su camino normal.
  const err = new Error('fallo raro');
  err.code = 'ALGO_INVENTADO';
  const { status, body } = toPublicAiError(err, 'req-pt5');
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
});

test('el sobre no puede crecer con campos nuevos', () => {
  // Comprobar una clave concreta no sirve: basta con llamarla de otra forma
  // para que el filtro deje de pasar. Lo que se protege es el CONJUNTO de
  // claves, que es el contrato, no un nombre.
  const permitidas = new Set(['code', 'retryable', 'retryAfterSec', 'requestId']);
  const iconos = [
    agotado(),
    agotado('gemini'),
    authDeProveedor(),
    authDeProveedor('gemini', 403),
    new Error('Uso no declarado: groq/vision.'),
    (() => { const e = new Error('timeout'); e.code = 'UNAUTHENTICATED'; return e; })(),
    (() => { const e = new Error('too large'); e.response = { status: 413 }; return e; })(),
    (() => { const e = new Error('rate limit'); e.status = 429; e.retryAfterSec = 7; return e; })(),
    (() => { const e = new Error('socket hang up'); e.attempts = [{ model: 'x' }]; return e; })(),
    { status: 500, extra: 'filtrado', response: { body: 'interno' } },
  ];
  iconos.forEach((err, i) => {
    const { body } = toPublicAiError(err, `req-sobre-${i}`);
    for (const clave of Object.keys(body.error)) {
      assert.equal(permitidas.has(clave), true, `clave inesperada "${clave}" en el caso ${i}`);
    }
    assert.deepEqual(Object.keys(body), ['error'], `caso ${i} no debe envolver en error`);
  });
});

test('un error con detalles adjuntos no los arrastra al sobre', () => {
  const err = new Error('fallo');
  err.attempts = [{ model: 'gpt-oss-120b', reason: 'provisional' }];
  err.response = { status: 500, body: 'stack del proveedor', headers: { get: () => null } };
  err.cause = new Error('socket hang up');
  err.original = new Error('raiz');
  const { body } = toPublicAiError(err, 'req-21b');
  assert.equal(JSON.stringify(body).includes('gpt-oss-120b'), false);
  assert.equal(JSON.stringify(body).includes('stack'), false);
  assert.equal(JSON.stringify(body).includes('raiz'), false);
  assert.equal(JSON.stringify(body).includes('socket'), false);
});

// ── Tabla de codigos ─────────────────────────────────────────────────────────

test('cada codigo tiene el estado HTTP que declara el contrato', () => {
  const esperados = {
    UNAUTHENTICATED: 401,
    RATE_LIMITED: 429,
    NO_MODEL_AVAILABLE: 503,
    CAPABILITY_UNAVAILABLE: 503,
    UPSTREAM_TIMEOUT: 504,
    PAYLOAD_TOO_LARGE: 413,
    INVALID_REQUEST: 400,
    INTERNAL_ERROR: 500,
    NOT_FOUND: 404,
  };
  for (const [code, status] of Object.entries(esperados)) {
    assert.equal(AI_ERRORS[code].status, status, `${code} deberia ser ${status}`);
  }
});

test('retryable distingue "vuelve a intentar" de "no reintentes"', () => {
  assert.equal(AI_ERRORS.NO_MODEL_AVAILABLE.retryable, true, 'caer a local');
  assert.equal(AI_ERRORS.RATE_LIMITED.retryable, true, 'esperar y reintentar');
  assert.equal(AI_ERRORS.UPSTREAM_TIMEOUT.retryable, true, 'caer a local');
  // Estos tres no: reintentar es un bucle inutil o esconde un bug.
  assert.equal(AI_ERRORS.INVALID_REQUEST.retryable, false, 'bug o dato invalido');
  assert.equal(AI_ERRORS.PAYLOAD_TOO_LARGE.retryable, false, 'trocear, no repetir');
  assert.equal(AI_ERRORS.CAPABILITY_UNAVAILABLE.retryable, false, 'avisar');
  assert.equal(AI_ERRORS.UNAUTHENTICATED.retryable, false, 'refrescar token');
});

test('CAPABILITY_UNAVAILABLE y NO_MODEL_AVAILABLE no se confunden', () => {
  // Mismo 503, semanticas opuestas: una dice "cae a local", la otra "avisa".
  const sinRanking = new Error("Uso no declarado: groq/vision. Anade el ranking en config/aiModels.js.");
  const { body } = toPublicAiError(sinRanking, 'req-4');
  assert.equal(body.error.code, 'CAPABILITY_UNAVAILABLE');
  assert.equal(body.error.retryable, false);

  const { body: agotados } = toPublicAiError(agotado(), 'req-5');
  assert.equal(agotados.error.code, 'NO_MODEL_AVAILABLE');
  assert.equal(agotados.error.retryable, true);
});

// ── Acceso denegado: indistinguible de "no existe" ───────────────────────────

test('un recurso de otro usuario responde 404, no 403', () => {
  // Si el acceso denegado devolviera 403, el cliente aprende que ese ID existe y
  // puede enumerar los recursos de los demas comprobando la diferencia de status.
  const denegado = new Error('no es tuyo');
  denegado.code = 'ACCESS_DENIED';
  const { status, body } = toPublicAiError(denegado, 'req-nf-1');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(body.error.retryable, false);
});

test('no existe y es de otro usuario producen el mismo sobre', () => {
  const inexistente = new Error('no encontrado');
  inexistente.code = 'NOT_FOUND';
  const deOtro = new Error('no es tuyo');
  deOtro.code = 'ACCESS_DENIED';

  const a = toPublicAiError(inexistente, 'req-nf-2');
  const b = toPublicAiError(deOtro, 'req-nf-2');
  assert.equal(a.status, b.status);
  assert.deepEqual(a.body, b.body, 'el cliente no debe poder distinguirlos');
});

test('un 404 del upstream tambien es NOT_FOUND', () => {
  const err = new Error('not found');
  err.status = 404;
  const { status, body } = toPublicAiError(err, 'req-nf-3');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('el acceso denegado se registra como warn con detalle', () => {
  const err = new Error('deck 42 pertenece a otro usuario');
  err.code = 'ACCESS_DENIED';
  const { logLevel, logDetail } = toPublicAiError(err, 'req-nf-4');
  assert.equal(logLevel, 'warn');
  assert.match(logDetail, /otro usuario/);
});

test('NOT_FOUND no filtra el motivo interno', () => {
  const err = new Error('deck 42 pertenece al usuario 7');
  err.code = 'ACCESS_DENIED';
  const { body } = toPublicAiError(err, 'req-nf-5');
  assert.equal(JSON.stringify(body).includes('usuario 7'), false);
  assert.equal(JSON.stringify(body).includes('42'), false);
});

// ── El caso que separa un bug de unauez ─────────────────────────────────────

test('un 401 del proveedor NO se traduce a UNAUTHENTICATED', () => {
  // Si esto falla, el movil le dice al usuario "tu sesion expiro" cuando lo que
  // se rompio fue nuestra API key, y entra en un refresh infinito de token.
  const { status, body } = toPublicAiError(authDeProveedor(), 'req-6');
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(status, 500);
  assert.notEqual(body.error.code, 'UNAUTHENTICATED');
});

test('un 403 del proveedor tampoco', () => {
  const { body } = toPublicAiError(authDeProveedor('gemini', 403), 'req-7');
  assert.equal(body.error.code, 'INTERNAL_ERROR');
});

test('el fallo de credencial se registra como critico, no como error', () => {
  const { logLevel, logDetail } = toPublicAiError(authDeProveedor(), 'req-8');
  assert.equal(logLevel, 'critical');
  assert.match(logDetail, /credencial del proveedor/);
});

test('un 401/403 sin marcar se trata como interno por seguridad', () => {
  // No se sabe de quien es. Asumir "del usuario" es la mentira peligrosa.
  const huerfano = new Error('Unauthorized');
  huerfano.status = 401;
  const { status, body, logLevel } = toPublicAiError(huerfano, 'req-9');
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(logLevel, 'critical');
});

test('un 401 marcado por nuestro propio middleware SI es UNAUTHENTICATED', () => {
  const nuestro = new Error('Token invalido o expirado.');
  nuestro.code = 'UNAUTHENTICATED';
  const { status, body } = toPublicAiError(nuestro, 'req-10');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'UNAUTHENTICATED');
});

// ── Mapeo de fallos reales ───────────────────────────────────────────────────

test('agotamiento de candidatos es NO_MODEL_AVAILABLE con espera', () => {
  const { status, body } = toPublicAiError(agotado('gemini'), 'req-11');
  assert.equal(status, 503);
  assert.equal(body.error.code, 'NO_MODEL_AVAILABLE');
  assert.equal(body.error.retryable, true);
  assert.equal(body.error.retryAfterSec, 30);
});

test('un fallo fatal no clasificado es interno', () => {
  const err = new Error('error no clasificado');
  err.code = 'MODEL_CALL_FAILED';
  err.original = new Error('TypeError');
  const { status, body } = toPublicAiError(err, 'req-12');
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
});

test('un timeout de transporte es UPSTREAM_TIMEOUT, no NO_MODEL_AVAILABLE', () => {
  // La distincion importa: timeout cae a local, agotamiento tambien, pero el
  // diagnostico es distinto y el timeout no dice nada del catalogo.
  const err = new Error('socket hang up');
  const { status, body } = toPublicAiError(err, 'req-13');
  assert.equal(status, 504);
  assert.equal(body.error.code, 'UPSTREAM_TIMEOUT');
});

test('un AbortController propio es UPSTREAM_TIMEOUT', () => {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  const { body } = toPublicAiError(err, 'req-14');
  assert.equal(body.error.code, 'UPSTREAM_TIMEOUT');
});

test('el status anidado en err.response tambien se lee', () => {
  const err = new Error('too large');
  err.response = { status: 413 };
  const { status, body } = toPublicAiError(err, 'req-15');
  assert.equal(status, 413);
  assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('un 400 del proveedor es INVALID_REQUEST', () => {
  const err = new Error('messages[0].content must be a string');
  err.status = 400;
  const { status, body } = toPublicAiError(err, 'req-16');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'INVALID_REQUEST');
  assert.equal(body.error.retryable, false);
});

test('un 429 respeta el Retry-After del proveedor', () => {
  const err = new Error('rate limit');
  err.status = 429;
  err.retryAfterSec = 7;
  const { status, body } = toPublicAiError(err, 'req-17');
  assert.equal(status, 429);
  assert.equal(body.error.code, 'RATE_LIMITED');
  assert.equal(body.error.retryAfterSec, 7);
});

test('un Retry-After sucio no rompe el contrato', () => {
  for (const valor of [0, -5, NaN, 'pronto', null]) {
    const err = new Error('rate limit');
    err.status = 429;
    err.retryAfterSec = valor;
    const { body } = toPublicAiError(err, 'req-18');
    assert.equal(typeof body.error.retryAfterSec, 'number');
    assert.equal(body.error.retryAfterSec, 30);
  }
});

test('un 429 sin Retry-After usa el valor por defecto', () => {
  const err = new Error('rate limit');
  err.status = 429;
  const { body } = toPublicAiError(err, 'req-19');
  assert.equal(body.error.retryAfterSec, 30);
});

test('un error raro no lanza: siempre sale un sobre valido', () => {
  const raro = { status: 200, code: null, message: { anidado: true } };
  const { status, body } = toPublicAiError(raro, 'req-20');
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.ok(AI_ERRORS[body.error.code]);
});

test('sendAiError escribe el status y el sobre, y registra', () => {
  const llamadas = [];
  const logger = { critical: (...a) => llamadas.push(['critical', ...a]) };
  let statusDevuelto = null;
  let jsonDevuelto = null;
  const res = {
    status(s) { statusDevuelto = s; return this; },
    json(b) { jsonDevuelto = b; return this; },
  };
  sendAiError(res, authDeProveedor(), 'req-21', { logger });
  assert.equal(statusDevuelto, 500);
  assert.equal(jsonDevuelto.error.code, 'INTERNAL_ERROR');
  assert.equal(jsonDevuelto.error.requestId, 'req-21');
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0][1], /req-21/);
});