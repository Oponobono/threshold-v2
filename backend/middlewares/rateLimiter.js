const { rateLimit } = require('express-rate-limit');

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
// ─────────────────────────────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    const resetTimeMs = req.rateLimit?.resetTime?.getTime?.() ?? (Date.now() + options.windowMs);
    const retryAfterSeconds = Math.ceil((resetTimeMs - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
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
  // Preserved for backwards compat with any route that still references it.
  // Prefer loginRateLimiter / biometricRateLimiter for auth routes.
  authLimiter: loginRateLimiter,
  loginRateLimiter,
  biometricRateLimiter,
};
