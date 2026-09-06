/**
 * Rate Limiting Test Suite
 *
 * Tests the rate limiting behavior on authentication endpoints.
 * Each scenario uses a fresh TestEnvironment so rate limit counters start at zero.
 *
 * Policy under test:
 *   - loginRateLimiter:     10 attempts / 15 min / IP — login, register, enroll, forgot, reset
 *   - biometricRateLimiter:  5 attempts / 15 min / IP — biometric-login only
 *   - Buckets are independent (login does not affect biometric and vice versa)
 *   - skipSuccessfulRequests: false (every attempt, success or failure, consumes quota)
 *   - 429 response contains { error } and does NOT reveal IP/account distinction
 */

const ConvergenceAssert = require('../ConvergenceAssert');

// ─────────────────────────────────────────────────────────────────────────────

async function post(baseUrl, path, body, ip = '127.0.0.1') {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Forwarded-For': ip
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, body: json };
}

// ─────────────────────────────────────────────────────────────────────────────
// RL-001 — First N login attempts are allowed (pass through to handler)
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioRL001LoginAllowedUnderLimit(env) {
  const a = new ConvergenceAssert('RL-001 — Login: primeros intentos pasan el limiter');

  // 3 attempts well under the 10-attempt limit. They will get 401 (wrong credentials)
  // but NOT 429 — the rate limiter is passing them through.
  const ip = '1.1.1.1';
  for (let i = 0; i < 3; i++) {
    const res = await post(env.backendUrl, '/api/login', { email: `x${i}@x.com`, password: 'wrong' }, ip);
    a.equal(
      res.status !== 429,
      true,
      `Attempt ${i + 1}: rate limiter must not block (got ${res.status})`
    );
  }

  return a.report();
}

// ─────────────────────────────────────────────────────────────────────────────
// RL-002 — Login is blocked at 429 after exhausting the limit
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioRL002LoginBlockedAfterLimit(env) {
  const a = new ConvergenceAssert('RL-002 — Login: bloqueado con 429 al superar el límite');

  // Exhaust the limit (10 attempts per IP)
  const ip = '2.2.2.2';
  for (let i = 0; i < 10; i++) {
    await post(env.backendUrl, '/api/login', { email: `ex${i}@x.com`, password: 'wrong' }, ip);
  }

  // The 11th attempt must be 429
  const res = await post(env.backendUrl, '/api/login', { email: 'over@x.com', password: 'wrong' }, ip);
  if (!res.body) { console.log('DEBUG RES:', res); }
  a.equal(res.status, 429, 'Attempt 11: should be 429');
  a.equal(typeof res.body?.error, 'string', '429 body must have error field');
  a.equal(
    res.body?.error?.toLowerCase().includes('ip') || res.body?.error?.toLowerCase().includes('account'),
    false,
    '429 message must not reveal IP or account distinction'
  );

  return a.report();
}

// ─────────────────────────────────────────────────────────────────────────────
// RL-003 — A 401 (wrong password) consumes quota
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioRL003FailedAttemptConsumesQuota(env) {
  const a = new ConvergenceAssert('RL-003 — Un 401 consume cuota del rate limiter');

  const ip = '3.3.3.3';
  // Use exactly 9 attempts (all wrong password → 401)
  for (let i = 0; i < 9; i++) {
    const res = await post(env.backendUrl, '/api/login', { email: `fail${i}@x.com`, password: 'bad' }, ip);
    a.equal(res.status, 401, `Attempt ${i + 1}: must be 401 (bad credentials), not blocked`);
  }

  // 10th attempt (at limit boundary) — still passes to handler
  const tenth = await post(env.backendUrl, '/api/login', { email: 'fail9@x.com', password: 'bad' }, ip);
  a.equal(tenth.status, 401, 'Attempt 10 (boundary): must still reach handler (401 not 429)');

  // 11th attempt — blocked
  const eleventh = await post(env.backendUrl, '/api/login', { email: 'over@x.com', password: 'bad' }, ip);
  a.equal(eleventh.status, 429, 'Attempt 11: must be 429');

  return a.report();
}

// ─────────────────────────────────────────────────────────────────────────────
// RL-004 — Biometric limiter is independent from login limiter
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioRL004BiometricIndependentBucket(env) {
  const a = new ConvergenceAssert('RL-004 — Biometric y login tienen buckets independientes');

  const ip = '4.4.4.4';
  // Exhaust the LOGIN bucket entirely (10 attempts)
  for (let i = 0; i < 10; i++) {
    await post(env.backendUrl, '/api/login', { email: `ex${i}@x.com`, password: 'wrong' }, ip);
  }

  // Confirm login is blocked
  const loginBlocked = await post(env.backendUrl, '/api/login', { email: 'over@x.com', password: 'wrong' }, ip);
  a.equal(loginBlocked.status, 429, 'Login bucket must be exhausted (429)');

  // Biometric bucket is independent — first biometric attempt must NOT be 429
  const bioRes = await post(env.backendUrl, '/api/biometric-login', { biometric_token: 'any-token' }, ip);
  a.equal(
    bioRes.status !== 429,
    true,
    `Biometric first attempt must pass rate limiter (got ${bioRes.status}, expected 401/404 not 429)`
  );

  return a.report();
}

// ─────────────────────────────────────────────────────────────────────────────
// RL-005 — Biometric limiter blocks at its own threshold (5, not 10)
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioRL005BiometricBlockedAtThreshold(env) {
  const a = new ConvergenceAssert('RL-005 — Biometric bloqueado en su umbral propio (5)');

  const ip = '5.5.5.5';
  // 5 biometric attempts (all should reach the handler, not be blocked)
  for (let i = 0; i < 5; i++) {
    const res = await post(env.backendUrl, '/api/biometric-login', { biometric_token: `tok-${i}` }, ip);
    a.equal(
      res.status !== 429,
      true,
      `Biometric attempt ${i + 1}: must not be 429 (got ${res.status})`
    );
  }

  // 6th attempt must be 429
  const blocked = await post(env.backendUrl, '/api/biometric-login', { biometric_token: 'tok-over' }, ip);
  a.equal(blocked.status, 429, 'Biometric attempt 6: must be 429');

  return a.report();
}

// ─────────────────────────────────────────────────────────────────────────────
// RL-006 — 429 response shape is correct and does not leak sensitive info
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioRL006ResponseShape(env) {
  const a = new ConvergenceAssert('RL-006 — Shape del 429: neutral, sin info sensible');

  const ip = '6.6.6.6';
  // Exhaust login bucket
  for (let i = 0; i < 10; i++) {
    await post(env.backendUrl, '/api/login', { email: `e${i}@x.com`, password: 'bad' }, ip);
  }
  const res = await post(env.backendUrl, '/api/login', { email: 'over@x.com', password: 'bad' }, ip);

  a.equal(res.status, 429, 'Status must be 429');
  a.equal(typeof res.body, 'object', 'Body must be JSON object');
  a.equal(typeof res.body.error, 'string', 'Body must have error string');
  a.equal(res.body.error.length > 0, true, 'Error message must not be empty');

  const msg = res.body.error.toLowerCase();
  a.equal(msg.includes('ip'), false, 'Must not mention IP');
  a.equal(msg.includes('account'), false, 'Must not mention account');
  a.equal(msg.includes('cuenta'), false, 'Must not mention cuenta (account in spanish)');
  a.equal(msg.includes('password'), false, 'Must not mention password');
  a.equal(msg.includes('contraseña'), false, 'Must not mention contraseña');

  // Must NOT leak password_hash or any sensitive field
  const forbidden = ['password_hash', 'reset_token', 'biometric_token'];
  for (const field of forbidden) {
    a.equal(res.body[field], undefined, `Response must not include ${field}`);
  }

  return a.report();
}

module.exports = {
  scenarioRL001LoginAllowedUnderLimit,
  scenarioRL002LoginBlockedAfterLimit,
  scenarioRL003FailedAttemptConsumesQuota,
  scenarioRL004BiometricIndependentBucket,
  scenarioRL005BiometricBlockedAtThreshold,
  scenarioRL006ResponseShape,
};
