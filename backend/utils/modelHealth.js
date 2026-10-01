/**
 * modelHealth.js — Clasificación de fallos y caché de salud en runtime.
 *
 * El error de origen: el registry iteraba sobre una lista de modelos y solo
 * buscaba "este modelo existe". Cuando un proveedor retira un modelo, la
 * diferencia entre "está muerto para siempre", "está saturado ahora" y "vivo
 * pero no sirve para esto" no se veía, y los tres casos terminaban igual:
 * reintentar o agotar la lista con un error opaco.
 *
 * Este módulo separa los tres. La distinción importa porque las tres clases
 * tienen TTL radicalmente distintos:
 *
 *   dead         cache larga, en horas. Un modelo retirado no vuelve.
 *   transient    cooldown corto con backoff. Un 503 de demanda NO mata el modelo.
 *   incompatible sin TTL. El modelo vive; la capacidad no existe para ese ID.
 *
 *   auth (401/403) no es ninguna de las anteriores: mata al PROVIDER entero.
 *   Iterar sobre modelos cuando la credencial es invalida quema cuota sin
 *   resolver nada.
 *
 * Los estados observados en produccion que motivan cada regla estan comentados
 * junto a la regla. Todos verificados por invocacion contra las APIs reales.
 */

const AI_MODELS = require('../config/aiModels');

/** TTL de un modelo marcado muerto. */
const DEAD_TTL_MS = 6 * 60 * 60 * 1000;

/** Base del backoff para fallos transitorios. */
const TRANSIENT_BASE_MS = 15 * 1000;

/** Techo del backoff para no esperar mas de esto por modelo. */
const TRANSIENT_MAX_MS = 5 * 60 * 1000;

/**
 * Fallos transitorios consecutivos a partir de los cuales el modelo se
 * considera persistentemente degradado.
 *
 * El techo del backoff (5 min) hace que un 503 sostenido termine siendo
 * indistinguible del ruido: se reintenta cada 5 minutos para siempre y nadie se
 * entera. A partir de este umbral el fallo se expone en `snapshot()` como
 * alerta y el modelo baja al final de su ranking, sin chegar a marcarse muerto.
 */
const PERSISTENT_COOLDOWN_THRESHOLD = 12;

/**
 * Subcadenas que identifican un fallo de RED o de timeout, no un rechazo del
 * modelo. Vive aqui y no en cada consumidor porque ya ocurrio el fallo: el
 * clasificador reconocia "socket hang up" y "fetch failed", el traductor de
 * errores de la API los ignoraba, y los dos modulos dejaron de estar de
 * acuerdo sobre que es un timeout. Una sola lista, un solo criterio.
 */
const SENALES_DE_RED = [
  'timeout',
  'timed out',
  'econnreset',
  'etimedout',
  'econnrefused',
  'econnaborted',
  'enotfound',
  'eai_again',
  'fetch failed',
  'socket hang up',
  'abort_err',
  'und_err_socket',
];

const REGEX_DE_RED = new RegExp(SENALES_DE_RED.join('|'), 'i');

/** ¿El texto de este error es un fallo de red o de timeout? */
function esFalloDeRed(msg = '') {
  return REGEX_DE_RED.test(msg);
}

/**
 * @typedef {Object} HealthVerdict
 * @property {'dead'|'transient'|'incompatible'|'auth'|'fatal'} class
 * @property {string} reason   Texto corto y legible para diagnostico.
 * @property {string} [capability]  Capacidad rechazada, solo si class='incompatible'.
 * @property {number} [status]      HTTP status, si lo hubo.
 */

function extractMessage(err) {
  if (!err) return '';
  const parts = [];
  if (typeof err.message === 'string') parts.push(err.message);
  if (typeof err.details === 'string') parts.push(err.details);
  else if (err.details && typeof err.details === 'object') {
    if (typeof err.details.error?.message === 'string') parts.push(err.details.error.message);
    if (typeof err.details.message === 'string') parts.push(err.details.message);
  }
  if (err.error && typeof err.error.message === 'string') parts.push(err.error.message);
  return parts.join(' ').toLowerCase();
}

function extractStatus(err) {
  if (!err) return undefined;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (typeof err.response?.status === 'number') return err.response.status;
  if (typeof err.details?.status === 'number') return err.details.status;
  return undefined;
}

/**
 * Clasifica un error de invocacion de modelo.
 *
 * El orden importa: auth se evalua antes que dead porque un 403 de un proveedor
 * que tambien reporta 404 no debe interpretarse como "modelo retirado".
 *
 * @param {any} err
 * @param {Object} [ctx]
 * @param {string} [ctx.capability] Capacidad que se intentaba usar.
 * @returns {HealthVerdict}
 */
function classifyError(err, ctx = {}) {
  const status = extractStatus(err);
  const msg = extractMessage(err);
  const capability = ctx.capability;

  // ── 1. Auth: cortar el provider entero, no iterar modelos ────────────────
  if (status === 401 || status === 403) {
    return {
      class: 'auth',
      status,
      reason: `credencial rechazada (HTTP ${status}); el provider esta caido, no el modelo`,
    };
  }

  // ── 2. Muerto: retirado del catalogo del proveedor ───────────────────────
  // Medido: Groq devuelve 404 model_not_found para Llama y qwen retirados, y
  // 400 model_decommissioned para otros. Ambos significan lo mismo y ambos
  // deben cachearse como muertos. Antes solo se reconocia el codigo 404.
  const saysModelGone =
    msg.includes('model_not_found') ||
    msg.includes('model_decommissioned') ||
    msg.includes('no longer available') ||
    msg.includes('is not found for api version') ||
    (msg.includes('model') && (msg.includes('does not exist') || msg.includes('not found')));

  if ((status === 404 || status === 400) && saysModelGone) {
    return {
      class: 'dead',
      status,
      reason: msg.includes('no longer available to new users')
        ? 'no disponible para esta credencial (restringido a cuentas previas)'
        : `retirado del catalogo del proveedor (HTTP ${status})`,
    };
  }

  // ── 3. Incompatible: el modelo vive, la capacidad no ─────────────────────
  // Medido: gpt-oss-120b y gpt-oss-20b devuelven 400 "messages[0].content must
  // be a string" cuando se les manda un bloque image_url. No estan muertos: no
  // tienen vision. Marcarlo como muerto los habria retirado del chat tambien.
  if (status === 400 && (msg.includes('content must be a string') || msg.includes('does not support'))) {
    return {
      class: 'incompatible',
      status,
      capability: capability || 'vision',
      reason: `el modelo no acepta ${capability || 'vision'} (sigue vivo para texto)`,
    };
  }

  // ── 4. Transitorio: reintentar mas tarde, NO marcar muerto ───────────────
  // Medido: gemini-flash-latest devolvio 503 "high demand" de forma sostenida y
  // gemini-* devolvio 429 por cuota. Cachear estos como muertos perderia modelos
  // sanos en cuanto baja la demanda.
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return {
      class: 'transient',
      status,
      reason: `provisional (HTTP ${status}): ${msg.includes('quota') ? 'cuota' : msg.includes('demand') ? 'demanda' : 'servicio'}`,
    };
  }

  if (esFalloDeRed(msg)) {
    return { class: 'transient', reason: 'fallo de red' };
  }

  // ── 5. Cualquier otra cosa es un bug real y se propaga sin enmascarar ────
  return {
    class: 'fatal',
    status,
    reason: status ? `error no clasificado (HTTP ${status})` : 'error no clasificado',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Caché de salud
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, {until:number, reason:string, consecutive:number}>} */
const deadCache = new Map();
/** @type {Map<string, {until:number, reason:string, consecutive:number}>} */
const transientCache = new Map();
/**
 * Racha de fallos transitorios, SIN TTL.
 *
 * Va separada del cooldown a proposito. El cooldown dice "no lo intentes
 * todavia" y expira a proposito; la racha dice "lleva N fallando" y debe
 * sobrevivir a esa expiracion. Si el contador viviera en la entrada del
 * cooldown, prune() la borraria al vencer el TTL y con trafico bajo un 503
 * sostenido reiniciaria su contador cada 30 minutos, sin alcanzar nunca el
 * umbral de alerta. Solo un exito lo limpia.
 *
 * @type {Map<string, {consecutive:number, firstAt:number, lastReason:string}>}
 */
const streakCache = new Map();
/** @type {Map<string, Set<string>>} modelo -> capacidades rechazadas (sin TTL) */
const capabilityCache = new Map();
/** @type {Set<string>} providers con credencial rechazada */
const authBlocked = new Set();

function now() { return Date.now(); }

function isLive(entry) { return entry && entry.until > now(); }

function isDead(modelId) { return isLive(deadCache.get(modelId)); }

function isCoolingDown(modelId) { return isLive(transientCache.get(modelId)); }

/** Un modelo queda bloqueado si esta muerto, en cooldown, o no soporta la capacidad. */
function isBlocked(modelId, capability) {
  if (isDead(modelId)) return 'muerto';
  if (isCoolingDown(modelId)) return 'transitorio';
  if (capability && capabilityCache.get(modelId)?.has(capability)) return 'sin capacidad';
  return null;
}

/** Registra el resultado de un veredicto sobre un modelo. */
function record(modelId, verdict) {
  const t = now();

  if (verdict.class === 'dead') {
    deadCache.set(modelId, { until: t + DEAD_TTL_MS, reason: verdict.reason, consecutive: 1 });
    transientCache.delete(modelId);
    return;
  }

  if (verdict.class === 'incompatible') {
    if (verdict.capability) {
      if (!capabilityCache.has(modelId)) capabilityCache.set(modelId, new Set());
      capabilityCache.get(modelId).add(verdict.capability);
    }
    return;
  }

  if (verdict.class === 'transient') {
    const streak = streakCache.get(modelId);
    const consecutive = (streak?.consecutive || 0) + 1;
    const backoff = Math.min(TRANSIENT_BASE_MS * Math.pow(2, consecutive - 1), TRANSIENT_MAX_MS);
    const yaAlertado = (streak?.consecutive || 0) >= PERSISTENT_COOLDOWN_THRESHOLD;

    transientCache.set(modelId, { until: t + backoff, reason: verdict.reason, consecutive });
    streakCache.set(modelId, {
      consecutive,
      firstAt: streak?.firstAt || t,
      lastReason: verdict.reason,
    });

    // Se avisa al cruzar el umbral y no en cada fallo posterior: un 503
    // sostenido durante dias debe producir UNA alerta, no miles de lineas.
    if (!yaAlertado && consecutive >= PERSISTENT_COOLDOWN_THRESHOLD) {
      const horas = Math.max(1, Math.round((t - (streak?.firstAt || t)) / 60000));
      console.warn(
        `[modelHealth] ALERTA ${modelId}: ${consecutive} fallos transitorios consecutivos `
        + `en ~${horas} min. Sigue vivo pero degradado; baja al final del ranking. `
        + `Motivo: ${verdict.reason}`
      );
    }
    return;
  }

  if (verdict.class === 'auth') {
    authBlocked.add(modelId);
  }
}

function isProviderBlocked(provider) { return authBlocked.has(provider); }

function blockProvider(provider) { authBlocked.add(provider); }

function unblockProvider(provider) { authBlocked.delete(provider); }

/** Modelo sano: limpiado de cualquier estado de fallo, incluida la racha. */
function markHealthy(modelId) {
  deadCache.delete(modelId);
  transientCache.delete(modelId);
  streakCache.delete(modelId);
}

/** Vista para diagnostico y para el endpoint de modelos online. */
function snapshot() {
  const clean = (map) => Object.fromEntries(
    [...map.entries()].map(([k, v]) => [k, { reason: v.reason, msLeft: Math.max(0, v.until - now()), consecutive: v.consecutive }])
  );
  return {
    dead: clean(deadCache),
    transient: clean(transientCache),
    incompatible: Object.fromEntries(
      [...capabilityCache.entries()].map(([k, v]) => [k, [...v]])
    ),
    authBlocked: [...authBlocked],
    persistentCooldown: Object.fromEntries(
      [...streakCache.entries()]
        .filter(([, v]) => v.consecutive >= PERSISTENT_COOLDOWN_THRESHOLD)
        .map(([k, v]) => [k, {
          consecutive: v.consecutive,
          sinceMin: Math.max(0, Math.round((now() - v.firstAt) / 60000)),
          reason: v.lastReason,
          // Un 503 que no se resuelve debe gritar, no fundirse con el ruido.
          alert: `modelo ${k} lleva ${v.consecutive} fallos transitorios consecutivos`,
        }])
    ),
  };
}

/**
 * Limpieza de entradas expiradas. Un deadCache que nunca se limpia crece sin limite.
 *
 * prune() NO toca streakCache a proposito: la racha sobrevive al TTL, que es
 * justo lo que permite que un 503 sostenido con trafico bajo llegue a alertar.
 */
function prune() {
  for (const [k, v] of deadCache) if (!isLive(v)) deadCache.delete(k);
  for (const [k, v] of transientCache) if (!isLive(v)) transientCache.delete(k);
}

function reset() {
  deadCache.clear();
  transientCache.clear();
  streakCache.clear();
  capabilityCache.clear();
  authBlocked.clear();
}

module.exports = {
  SENALES_DE_RED,
  esFalloDeRed,
  classifyError,
  isDead,
  isCoolingDown,
  isBlocked,
  isProviderBlocked,
  blockProvider,
  unblockProvider,
  markHealthy,
  record,
  snapshot,
  prune,
  reset,
  DEAD_TTL_MS,
  TRANSIENT_BASE_MS,
  TRANSIENT_MAX_MS,
  // Reexportado por comodidad: quien decide capacidad consulta la misma fuente.
  findEntry: AI_MODELS.findEntry,
};
