# Security Review: Threshold

**Date:** 2026-05-30  
**Scope:** Full codebase (backend + mobile)  
**Reviewer:** opencode security-review skill  
**Confidence:** High

---

## Summary

- **Findings:** 15 (3 Critical, 3 High, 8 Medium, 1 Low)
- **Risk Level:** Critical
- **Confidence:** High
- **Focus Areas:** Authentication, authorization, secrets management, [[API_DOCUMENTATION|API]] security, input validation, mobile client security

---

## Findings

### VULN-001 — Live API Keys Committed to Git (Critical)

- **Location:** `backend/.env:16-29`, `mobile/.env:5-6`
- **Confidence:** High
- **Issue:** Real, functional API keys for Groq, Gemini, Supadata, and Uploadthing are committed in plaintext to the git repository.
- **Impact:** Any attacker with repo access (or access to the git history) can use these keys to consume paid services at the owner's expense. The Uploadthing token is a JWT containing `sk_live_...` and the app ID, allowing full file storage access.
- **Evidence:**
  ```
  # backend/.env
  GROQ_API_KEY=gsk_***
  GEMINI_API_KEY=AIzaSy***
  UPLOADTHING_TOKEN=eyJ***
  SUPADATA_API_KEY=sd_***
  ```
- **Fix:**
  1. Rotate all four keys immediately (Groq, Gemini, Supadata, Uploadthing).
  2. Add `.env` to `.gitignore` (currently it is NOT gitignored).
  3. Remove `.env` files from git history using `git filter-branch` or `bfg-repo-cleaner`.
  4. Use a secrets manager (e.g., GitHub Secrets, Doppler, 1Password CLI) or environment variables in production.

---

### VULN-002 — Groq API Key Exposed in Mobile Client Bundle (Critical)

- **Location:** `mobile/.env:5`, `mobile/src/components/recordings/RecordingDetail.tsx:53`, `mobile/src/components/ai/VideoDetail.tsx:45`
- **Confidence:** High
- **Issue:** The `EXPO_PUBLIC_GROQ_API_KEY` prefix in Expo/React Native means the key is bundled into the client-side JS bundle, which is trivially extractable via decompilation or MitM.
- **Impact:** Anyone who downloads the app can extract the Groq API key and use it for arbitrary LLM API calls at the owner's expense.
- **Evidence:**
  ```
  # mobile/.env
  EXPO_PUBLIC_GROQ_API_KEY=gsk_***
  ```
  Additionally, `RecordingDetail.tsx` and `VideoDetail.tsx` use `process.env.EXPO_PUBLIC_GROQ_API_KEY` directly in the client bundle.
- **Fix:**
  1. Remove `EXPO_PUBLIC_GROQ_API_KEY` from the mobile `.env`.
  2. All API calls should go through the backend proxy (which already has the key). The mobile app should NEVER hold direct third-party API keys.
  3. The [[OFFLINE_ARCHITECTURE|offline]] transcription via `whisper.rn` (already implemented) is the correct approach — no API key needed on device.
  4. Rotate the Groq key after removing it from the mobile bundle.

---

### VULN-003 — Upload Routes Are Completely Unauthenticated (Critical)

- **Location:** `backend/server.js:105` vs `:110`
- **Confidence:** High
- **Issue:** Upload routes are registered BEFORE the JWT authentication middleware.
  - Line 105: `app.use('/api', uploadRoutes);`
  - Line 110: `app.use('/api', authenticateToken);`
  This means `POST /api/upload` and `DELETE /api/upload/:key` accept requests from anyone, with no authentication, no ownership validation, and no rate limiting.
- **Impact:** An unauthenticated attacker can upload arbitrary files (up to 64MB, filtered MIME types) to the Uploadthing CDN, and delete existing files. This could be used to: consume the Uploadthing quota, upload malicious content, or delete legitimate user files.
- **Fix:**
  1. Move `uploadRoutes` to AFTER the `authenticateToken` middleware (after line 110).
  2. Add rate limiting to upload routes.
  3. Add user ownership validation: `validateOwner` or check `req.user.id` in the upload controller.

---

### VULN-004 — JWT Secret Default Is Hardcoded (High)

- **Location:** `backend/config/secrets.js:34`
- **Confidence:** High
- **Issue:** When `NODE_ENV` is not `'production'`, the JWT secret falls back to the hardcoded string `'super-secret-default-key-change-me'`. Since the `.env` file does NOT define `JWT_SECRET`, this default is ALWAYS used in development.
- **Impact:** Anyone who runs the app in development (or if `NODE_ENV` is unset in production) can forge valid JWT tokens, impersonate any user, and access all authenticated API endpoints.
- **Evidence:**
  ```js
  JWT_SECRET: getSecret('JWT_SECRET', 'super-secret-default-key-change-me', isProd),
  ```
- **Fix:**
  1. Set a strong, unique `JWT_SECRET` in the production `.env`.
  2. In development, also set a `JWT_SECRET` — do not rely on the default.
  3. Consider using a 256-bit random hex string.

---

### VULN-005 — No JWT_SECRET in .env (High)

- **Location:** `backend/.env` (all lines)
- **Confidence:** High
- **Issue:** The `.env` file configures all third-party API keys but does NOT define `JWT_SECRET`. This means the hardcoded default is always active.
- **Impact:** Combined with VULN-004, this means the JWT secret is predictable in any environment where `.env` lacks a custom `JWT_SECRET`.
- **Fix:** Add `JWT_SECRET=your-strong-secret-here` to `backend/.env`.

---

### VULN-006 — Swagger UI Publicly Accessible (High)

- **Location:** `backend/server.js:77`
- **Confidence:** High
- **Issue:** Swagger UI is served at `/api-docs` without any authentication. It exposes the complete API surface, request schemas, parameter structures, and endpoint details.
- **Impact:** An attacker can enumerate all API endpoints, understand data structures, and craft targeted attacks. This increases the attack surface.
- **Fix:**
  1. Restrict Swagger to development environments only.
  2. Add authentication (e.g., basic auth) to `/api-docs` in production.
  3. Or serve it on a different port bound to localhost only.

---

### VULN-007 — Group Passwords Stored and Compared in Plaintext (Medium)

- **Location:** `backend/controllers/learningController.js:236,278`
- **Confidence:** High
- **Issue:** Group passwords are stored in plaintext in the database and compared with `===` instead of being hashed with bcrypt.
- **Impact:** Anyone with database access (SQL injection, backup file, DB file exposure) can read all group passwords. If users reuse passwords across services, this is a credential leak.
- **Evidence:**
  ```js
  // Line 236: stored as-is
  // Line 278: compared as-is
  if (password !== group.password) { ... }
  ```
- **Fix:**
  1. Hash group passwords with bcrypt before storage.
  2. Use `bcrypt.compare()` for verification.
  3. Migrate existing plaintext passwords in the database.

---

### VULN-008 — Dynamic SQL Column Builders Across Multiple Controllers (Medium)

- **Location:** Multiple files including:
  - `backend/controllers/subjectsController.js:344-347`
  - `backend/controllers/youtubeController.js:92`
  - `backend/controllers/assessmentsController.js:453`
  - `backend/controllers/galleryController.js:233`
  - `backend/controllers/scannedDocumentsController.js:151`
  - `backend/controllers/audioController.js:160`
  - `backend/controllers/youtubeController.js:224`
- **Confidence:** High
- **Issue:** Multiple controllers build dynamic UPDATE queries by joining field names into `SET column = ?, ...` strings. While most filter field names through hardcoded conditionals, `subjectsController.js` uses `Object.keys(fieldsToUpdate)` where keys come from `req.body` (user-controlled). The `allowedFields` whitelist partially mitigates this, but the pattern is fragile.
- **Impact:** If a field name passes the whitelist that contains SQL metacharacters or if the whitelist is incomplete, SQL injection is possible. The pattern itself is a maintainability risk.
- **Fix:**
  1. Replace dynamic builders with explicit column-by-column updates.
  2. If dynamic builders must be used, validate field names against a strict enum/whitelist and never allow arbitrary `Object.keys()` from `req.body`.

---

### VULN-009 — No Email/Password Validation on Register (Medium)

- **Location:** `backend/controllers/authController.js:26-27`
- **Confidence:** High
- **Issue:** Registration only checks `if (!email || !password)`. There is no email format validation, no password strength requirement (length, complexity), and no confirmation field.
- **Impact:** Users can register with weak passwords (`"a"`), making brute-force attacks trivial. Also, typo'd emails (`user@gmal.com`) are accepted, causing account recovery issues.
- **Fix:**
  1. Validate email format with a regex or library (e.g., `validator.isEmail()`).
  2. Enforce minimum password length (8-12 chars) and optionally complexity requirements.
  3. Add Zod schemas to auth routes (the `validatorMiddleware.js` and `zod` dependency already exist).

---

### VULN-010 — Auth Rate Limit Is Too Permissive (Medium)

- **Location:** `backend/middlewares/rateLimiter.js:40-47`
- **Confidence:** High
- **Issue:** The `authLimiter` allows 200 requests per hour per IP for login/register. This is approximately 1 request every 18 seconds — far too permissive for brute-force protection.
- **Impact:** An attacker can try 200 different passwords per hour per IP, making password guessing feasible over time. With IP rotation (botnet), unlimited attempts are possible.
- **Fix:**
  1. Reduce `authLimiter` to 5-10 attempts per 15-minute window for login.
  2. Add progressive delays after failed attempts.
  3. Consider account lockout after N consecutive failures.
  4. Optionally add CAPTCHA after 3 failed attempts.

---

### VULN-011 — `/auth/enroll-biometric` Has No Rate Limiting (Medium)

- **Location:** `backend/routes/auth.js:112`
- **Confidence:** High
- **Issue:** The biometric enrollment endpoint has no `authLimiter` applied, unlike the login/register routes.
- **Impact:** An attacker with a stolen JWT token can enroll unlimited biometric tokens, granting persistent access even after password changes.
- **Fix:** Apply the `authLimiter` to `/auth/enroll-biometric`.

---

### VULN-012 — `/health` and `/api/status` Leak Internal Information (Medium)

- **Location:** `backend/server.js:81-99`
- **Confidence:** High
- **Issue:** The public health and status endpoints return `db` type ([[DATABASE_DOCUMENTATION|SQLite]] vs PostgreSQL) and `NODE_ENV`, giving attackers knowledge of the database backend and environment.
- **Impact:** Low direct impact, but aids attackers in crafting specific exploits (e.g., SQLite-specific injection vs PostgreSQL).
- **Fix:**
  1. Remove `db` and `env` from public health responses.
  2. Only return `{ status: 'OK' }` for public endpoints.
  3. Create a separate authenticated endpoint for detailed health information.

---

### VULN-013 — No Account Lockout Mechanism (Medium)

- **Location:** `backend/controllers/authController.js`, `backend/middlewares/rateLimiter.js`
- **Confidence:** Medium
- **Issue:** There is no account lockout after consecutive failed login attempts. The only protection is the IP-based rate limiter (200 req/h).
- **Impact:** With IP rotation (botnet), unlimited brute-force attempts are possible. There is no mechanism to temporarily lock accounts after N failures.
- **Fix:**
  1. Track failed login attempts per user in the database.
  2. Implement account lockout (e.g., 15-minute lock after 5 failures).
  3. Notify user via email when account is locked.

---

### VULN-014 — Upload Routes Lack Rate Limiting and Ownership Validation (Medium)

- **Location:** `backend/routes/upload.js` (all routes), `backend/server.js:105`
- **Confidence:** High
- **Issue:** Upload routes (even if moved behind auth) lack rate limiting and ownership validation. A user could upload hundreds of files, consuming Uploadthing quota.
- **Impact:** Resource exhaustion, quota overage charges, storage of malicious content.
- **Fix:**
  1. Add rate limiting to upload routes (e.g., 10 files per hour per user).
  2. Add file type and size validation (already partially done with multer MIME filtering).
  3. Add user ownership to uploaded file records.

---

### VULN-015 — Test/Diagnostic Files in Production Tree (Low)

- **Location:** `backend/test-auth-grading.js`, `backend/test-api-client.js`, `backend/test-profile-update.js`, `backend/diagnostic-profile-issue.js`, `backend/diagnostic-grading-systems.js`
- **Confidence:** High
- **Issue:** Multiple test and diagnostic scripts exist in the production `backend/` directory. While none contain passwords or secrets, they indicate poor separation of test and production code.
- **Impact:** Low. These files are not routable endpoints, but may contain hardcoded test data or queries that could aid an attacker.
- **Fix:** Move test/diagnostic scripts to a `tests/` directory, add to `.gitignore`, or remove from production deployments.

---

## Positive Findings (Good Practices)

- **Helmet** is used for HTTP security headers (XSS, clickjacking, etc.) — `server.js:65`
- **Rate limiting** is applied globally (1000 req/15min) — `server.js:66`
- **Parameterized queries** (`?` placeholders) are consistently used for SQL value binding — `db.js` and all controllers
- **bcrypt** is used for user password hashing — `authController.js:32`
- **Prompt injection protection** (PromptShield v2) is implemented for AI features — `utils/promptShield.js`
- **JWT authentication** is correctly applied after public routes — `server.js:110`
- **`skipSuccessfulRequests: true`** on auth rate limiter avoids penalizing legitimate users — `rateLimiter.js:46`
- **Multer file validation** rejects unsupported MIME types — `server.js:48-61`
- **No eval()/exec() usage** anywhere in the codebase
- **No child_process** or shell execution patterns

---

## Recommendations (Ordered by Priority)

1. **Immediate (Critical):** Rotate ALL API keys (Groq, Gemini, Supadata, Uploadthing). They are compromised.
2. **Immediate (Critical):** Move upload routes behind JWT authentication middleware.
3. **Immediate (High):** Add `JWT_SECRET` to `.env` with a strong random value.
4. **High:** Remove API keys from mobile client bundle; proxy all API calls through the backend.
5. **High:** Restrict Swagger UI to development environments or add authentication.
6. **High:** Hash group passwords with bcrypt.
7. **Medium:** Tighten auth rate limiting (5-10 attempts per 15 minutes).
8. **Medium:** Add email/password validation to registration.
9. **Medium:** Add rate limiting to biometric enrollment.
10. **Medium:** Sanitize health endpoint responses.
11. **Medium:** Add account lockout mechanism.
12. **Medium:** Add rate limiting to upload routes.
13. **Low:** Move test/diagnostic files out of the production directory.
14. **Ongoing:** Add `zod` validation schemas to all request bodies (the dependency already exists).

---
**Tags:** #audits
