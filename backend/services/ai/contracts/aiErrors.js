/**
 * Contrato de error de la API de IA (v2).
 *
 * Este modulo es el UNICO punto donde un error interno se traduce a un codigo
 * publico. Si algun otro sitio responde con su propia forma de error, el movil
 * recibe dos dialectos distintos y el AIClient no puede decidir cuando caer a
 * local sin interpretarlos uno por uno.
 *
 * El sobre de respuesta es estable y no depende de lo que diga el proveedor:
 *
 *   { "error": { "code", "retryable", "retryAfterSec"?, "requestId" } }
 *
 * Nunca se filtra el mensaje del proveedor ni la lista de intentos fallidos:
 * eso es informacion de la infraestructura, no del cliente.
 *
 * La decision que mas importa aqui
 * -------------------------------
 * Un 401 de GROQ NO es un 401 de USUARIO. Si la API key del backend esta
 * rota o revocada, la sesion del usuario sigue siendo valida y el mensaje
 * "tu sesion expiro" es una mentira que ademas manda al cliente a un refresh
 * infinito. Por eso un fallo de credencial del proveedor se traduce a un 500
 * interno que el movil nunca muestra, y solo UNAUTHENTICATED, que es el unico
 * codigo que el propio servidor emite para su JWT, significa "token malo".
 *
 * Y NOT_FOUND responde tambien a un acceso denegado. Un recurso que pertenece
 * a otro usuario y uno que no existen tienen que ser indistinguibles: si el
 * acceso denegado devuelve 403, el cliente aprende que ese ID existe y puede
 * enumerar los recursos de los demas.
 */

const crypto = require('node:crypto');

const { esFalloDeRed } = require('../../../utils/modelHealth');

/**
 * Tabla publica. El estado HTTP y la semantica de retryable son parte del
 * contrato: cambiarlos es un cambio de API, no un refactor.
 *
 * retryable no significa "reintenta ya". Significa "vale la pena volver a
 * intentarlo en otro momento", y es la senal que el AIClient usa para abrir o
 * no el circuit breaker. Un RATE_LIMITED es retryable pero NO es una caida del
 * backend: es una espera.
 */
const AI_ERRORS = {
  UNAUTHENTICATED: { status: 401, retryable: false },
  // Un acceso denegado responde 404 y no 403 a proposito: indistinguible de
  // "no existe", para no confirmar que IDs son reales.
  NOT_FOUND: { status: 404, retryable: false },
  RATE_LIMITED: { status: 429, retryable: true, retryAfterSec: 30 },
  NO_MODEL_AVAILABLE: { status: 503, retryable: true, retryAfterSec: 30 },
  CAPABILITY_UNAVAILABLE: { status: 503, retryable: false },
  UPSTREAM_TIMEOUT: { status: 504, retryable: true },
  PAYLOAD_TOO_LARGE: { status: 413, retryable: false },
  INVALID_REQUEST: { status: 400, retryable: false },
  INTERNAL_ERROR: { status: 500, retryable: false },
};

const RETRY_AFTER_POR_DEFECTO = 30;

/**
 * Prefijo de la API de IA v2. Solo estas rutas hablan el sobre v2.
 *
 * Vive aqui y no en el middleware porque lo consultan tres capas distintas (el
 * auth, el limitador de cuota y las guardas de propiedad) y la respuesta a la
 * pregunta "este request habla v1 o v2" tiene que ser la MISMA en las tres. Si
 * cada una Santiago su propio prefijo, un dia se desincronizan y un cliente
 * recibe el dialecto equivocado sin que nada falle.
 */
const PREFIJO_AI_V2 = '/api/ai/v2';

/** ¿Este request va a la API de IA v2? */
function esRutaAiV2(req) {
  const url = String((req && req.originalUrl) || (req && req.url) || '').split('?')[0];
  return url === PREFIJO_AI_V2 || url.startsWith(`${PREFIJO_AI_V2}/`);
}

/** El codigo publico de un error de proveedor bloqueado: GROQ_AUTH_BLOCKED, GEMINI_AUTH_BLOCKED... */
const ES_AUTH_DE_PROVEEDOR = /^[A-Z]+_AUTH_BLOCKED$/;

/** Todos los candidatos del ranking se agotaron: GROQ_ALL_MODELS_EXHAUSTED... */
const ES_AGOTAMIENTO = /^[A-Z]+_ALL_MODELS_EXHAUSTED$/;

/** El ranking de esa capacidad no esta declarado en config/aiModels.js. */
const SIN_RANKING = /Uso no declarado/;

function statusDe(err) {
  const directo = err && err.status;
  if (Number.isInteger(directo) && directo >= 100 && directo < 600) return directo;
  // fetch envuelve el status en err.response.status o en err.cause
  const anidado = err && err.response && err.response.status;
  if (Number.isInteger(anidado)) return anidado;
  const causa = err && err.cause && err.cause.status;
  if (Number.isInteger(causa)) return causa;
  return null;
}

function mensajeDe(err) {
  if (!err) return '';
  const directo = typeof err.message === 'string' ? err.message : '';
  const cuerpo = err.details && err.details.error && err.details.error.message;
  const anidado = err.cause && typeof err.cause.message === 'string' ? err.cause.message : '';
  return [directo, cuerpo, anidado].filter(Boolean).join(' ');
}

/** Cuanto debe esperar el cliente, en segundos. */
function retryAfterDe(err, porDefecto) {
  const candidatos = [
    err && err.retryAfterSec,
    err && err.retryAfter,
    err && err.response && err.response.retryAfterSec,
  ];
  for (const c of candidatos) {
    if (Number.isFinite(c) && c > 0) return Math.ceil(c);
  }
  // El header del proveedor puede venir en segundos o en milisegundos.
  const headers = err && err.response && err.response.headers;
  if (headers && headers.get) {
    const bruto = headers.get('retry-after');
    const n = Number(bruto);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  return porDefecto;
}

/**
 * Traduce un error interno al sobre publico. PURA: no toca res, ni la red, ni
 * el reloj. Devuelve tambien el nivel de log y el detalle interno, porque el
 * movil no debe verlos pero el servidor si los necesita.
 *
 * @param {unknown} err
 * @param {string} [requestId]
 * @returns {{status:number, body:object, logLevel:string, logDetail:string}}
 */
function toPublicAiError(err, requestId) {
  const id = requestId || crypto.randomUUID();
  const status = statusDe(err);
  const codigo = (err && err.code) || '';
  const mensaje = mensajeDe(err);

  let code;
  let retryAfterSec;
  let logLevel = 'error';
  let logDetail = mensaje || String(err);

  if (Object.prototype.hasOwnProperty.call(AI_ERRORS, codigo)) {
    // El codigo ya es publico. Quien llama (un limitador, un validador) sabe la
    // respuesta antes de llegar aqui, y no deberia tener que disfrazar su
    // decision de codigo interno ni acordarse de montar tambien el status: si lo
    // hiciera, un RATE_LIMITED sin status se caeria en INTERNAL_ERROR y un 429
    // acabaria siendo un 500. Pass-through, y el sobre sale igual de completo.
    code = codigo;
    logLevel = codigo === 'UNAUTHENTICATED' ? 'info' : 'warn';
    if (codigo === 'RATE_LIMITED') retryAfterSec = retryAfterDe(err, RETRY_AFTER_POR_DEFECTO);
  } else if (ES_AUTH_DE_PROVEEDOR.test(codigo)) {
    // La credencial DEL SERVIDOR esta rota. El cliente no puede hacer nada y su
    // sesion es valida: nunca se traduce a UNAUTHENTICATED.
    code = 'INTERNAL_ERROR';
    logLevel = 'critical';
    logDetail = `credencial del proveedor rechazada (${codigo}): ${mensaje}`;
  } else if (ES_AGOTAMIENTO.test(codigo)) {
    code = 'NO_MODEL_AVAILABLE';
  } else if (codigo === 'MODEL_CALL_FAILED') {
    code = 'INTERNAL_ERROR';
  } else if (SIN_RANKING.test(mensaje)) {
    // No hay ranking para esa capacidad. Para el cliente equivale a "no hay
    // modelo capaz", pero del lado servidor es una falta de configuracion y
    // por eso se deja en warn para que se note sin tratarlo como incidente.
    code = 'CAPABILITY_UNAVAILABLE';
    logLevel = 'warn';
  } else if (codigo === 'NOT_FOUND' || codigo === 'ACCESS_DENIED') {
    // ACCESS_DENIED es el mismo caso: existe pero no es tuyo. Se responde 404.
    code = 'NOT_FOUND';
    logLevel = 'warn';
  } else if (codigo === 'UNAUTHENTICATED' || (err && err.authenticated === false)) {
    // El unico camino que produce esto es nuestro propio middleware de JWT.
    code = 'UNAUTHENTICATED';
    logLevel = 'info';
    logDetail = mensaje || 'token ausente o invalido';
  } else if (esFalloDeRed(mensaje) || codigo === 'UPSTREAM_TIMEOUT'
             || (err && err.name === 'AbortError')) {
    // La lista de señales de red es la de modelHealth, no una copia: si las dos
    // piezas no comparten criterio, un mismo fallo se traduce de dos formas.
    code = 'UPSTREAM_TIMEOUT';
  } else if (status === 413) {
    code = 'PAYLOAD_TOO_LARGE';
  } else if (status === 404) {
    code = 'NOT_FOUND';
  } else if (status === 429) {
    code = 'RATE_LIMITED';
    retryAfterSec = retryAfterDe(err, RETRY_AFTER_POR_DEFECTO);
  } else if (status === 400 || status === 422) {
    code = 'INVALID_REQUEST';
  } else if (status === 401 || status === 403) {
    // Un 401/403 SIN la marca de proveedor no se sabe de quien es. Asumir que
    // es del usuario seria justo el bug que este modulo evita, asi que se
    // trata como fallo interno y se avisa al operador.
    code = 'INTERNAL_ERROR';
    logLevel = 'critical';
    logDetail = `401/403 sin marcar (origen desconocido): ${mensaje}`;
  } else {
    code = 'INTERNAL_ERROR';
  }

  const def = AI_ERRORS[code];
  const cuerpo = { code, retryable: def.retryable, requestId: id };
  if (def.retryAfterSec !== undefined || retryAfterSec !== undefined) {
    cuerpo.retryAfterSec = retryAfterSec !== undefined
      ? retryAfterSec
      : def.retryAfterSec;
  }

  return { status: def.status, body: { error: cuerpo }, logLevel, logDetail };
}

/**
 * Escribe la respuesta de error de la API de IA. Unico punto de salida.
 *
 * @param {object} res  respuesta de Express
 * @param {unknown} err error interno
 * @param {string} [requestId]
 * @param {{logger?:object}} [opciones]
 */
function sendAiError(res, err, requestId, opciones = {}) {
  const { status, body, logLevel, logDetail } = toPublicAiError(err, requestId);
  const logger = opciones.logger || console;
  const metodo = logger[logLevel] || logger.error || logger.log;
  if (typeof metodo === 'function') {
    metodo.call(logger, `[ai] ${body.error.code} requestId=${body.error.requestId}`, logDetail);
  }
  return res.status(status).json(body);
}

module.exports = {
  AI_ERRORS,
  PREFIJO_AI_V2,
  RETRY_AFTER_POR_DEFECTO,
  esRutaAiV2,
  toPublicAiError,
  sendAiError,
};