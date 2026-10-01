const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { sendAiError, esRutaAiV2 } = require('../services/ai/contracts/aiErrors');

/**
 * Rate Limiting v1 — in-process store
 *
 * Store: MemoryStore (default). Sufficient for a single-process deployment.
 * Limitation: in a horizontally-scaled setup each process has its own counter,
 * making the per-IP limit effectively `max × replicas`. If Threshold ever runs
 * multiple replicas, migrate to a shared store (e.g. `rate-limit-redis`).
 * The contract (windowMs, max, key) is defined here and decoupled from the
 * middleware; swapping the store does not require changing any route file.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Global — baseline protection against volumetric abuse
// ─────────────────────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ─────────────────────────────────────────────────────────────────────────────
// AI — protect Groq/Gemini quota
//
// Key: user id del token, con IP como fallback.
// La cuota que se protege es la del proveedor, y esa cuota la consume el
// USUARIO, no la IP. Limitar por IP aqui era un error real: en una
// universidad, un dormitorio o una CGNAT movil, decenas de personas comparten
// una sola IP y una abuse de consumo bloquea a todos los demas.
//
// El AI limiter se monta dentro del router de IA, que va despues del
// middleware global de auth, asi que req.user ya esta disponible. Antes de la
// auth no lo estaria, y ese es el motivo por el que el limite contra fuerza
// bruta del login sigue siendo por IP.
const AI_LIMITE_POR_HORA = 200;

/**
 * El limitador de IA se monta despues de la auth, y solo entonces existe
 * req.user. Se extrae el id tolerando las dos formas en que los controladores
 * lo han ido dejando.
 */
function claveDeUsuario(req) {
    const user = req && req.user;
    if (!user) return null;
    const id = user.id !== undefined ? user.id : user.userId;
    return id === undefined || id === null ? null : String(id);
}

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: AI_LIMITE_POR_HORA,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator y no req.ip a secas: una IPv6 tiene /64 asignables, asi que
  // un atacante que rote direcciones dentro de su bloque se evadia el limite
  // entero. express-rate-limit aborta el arranque si se usa la IP cruda.
  keyGenerator: (req) => `u:${claveDeUsuario(req) ?? 'ip:' + ipKeyGenerator(req.ip)}`,
  handler: (req, res, _next, options) => {
    const resetTimeMs = req.rateLimit?.resetTime?.getTime?.() ?? (Date.now() + options.windowMs);
    const retryAfterSeconds = Math.ceil((resetTimeMs - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);

    // La API v2 habla el sobre estable; v1 sigue leyendo `error` como texto.
    if (esRutaAiV2(req)) {
      return sendAiError(res, { code: 'RATE_LIMITED', retryAfterSec: retryAfterSeconds }, req.id);
    }

    res.status(options.statusCode).json({
      error: 'AI usage limit exceeded. Please try again later.',
      retryAfter: retryAfterSeconds,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Login — password authentication
//
// Policy decisions (v1):
//   - Key: IP only. Combined IP+account requires reading req.body at middleware
//     level before validation; adds complexity without material gain in v1.
//     Documented as a known limitation.
//   - skipSuccessfulRequests: false — every attempt (success or failure)
//     consumes quota. This prevents an attacker from making N-1 failures and
//     one success in a sliding window indefinitely.
//   - Message: neutral — does not reveal whether the block is by IP or account.
//   - 10 attempts per 15-minute window per IP.
// ─────────────────────────────────────────────────────────────────────────────
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      error: 'Too many authentication attempts. Please try again later.',
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Biometric login — independent bucket from password login
//
// Policy decisions (v1):
//   - Separate limiter: does NOT share the counter with loginRateLimiter.
//     An attacker cannot exhaust the biometric bucket via the password endpoint
//     or vice versa.
//   - Tighter window (5 attempts / 15 min): biometric tokens are device-bound
//     secrets; a lower threshold is appropriate.
//   - Message: same neutral phrasing as loginRateLimiter.
// ─────────────────────────────────────────────────────────────────────────────
const biometricRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      error: 'Too many authentication attempts. Please try again later.',
    });
  },
});

module.exports = {
  globalLimiter,
  aiLimiter,
  AI_LIMITE_POR_HORA,
  // Preserved for backwards compat with any route that still references it.
  // Prefer loginRateLimiter / biometricRateLimiter for auth routes.
  authLimiter: loginRateLimiter,
  loginRateLimiter,
  biometricRateLimiter,
};
