/**
 * Authorization Security Tests — Cross-Tenant Isolation
 *
 * Verifica que los parches P0/P1 del Security Baseline v1 cierran
 * las brechas de autorización. Patrón por escenario:
 *
 *   1. Crear recurso como Tenant A
 *   2. Atacar como Tenant B (diferente JWT)
 *   3. Verificar HTTP status (403/404)
 *   4. Verificar que el estado del recurso de A no cambió (no partial mutation)
 */

const ConvergenceAssert = require('../ConvergenceAssert');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-threshold';

/**
 * Crea un segundo usuario en la base de datos del entorno
 * y devuelve su userId + jwtToken.
 */
async function createAttacker(env) {
  const attackerId = uuidv4();
  const ts = Date.now();
  const email = 'attacker_' + ts + '@sec.test';
  const hash = await bcrypt.hash('attacker-pass', 4);
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      'INSERT INTO users (id, email, password_hash, name, username, share_pin) VALUES (?, ?, ?, ?, ?, ?)',
      [attackerId, email, hash, 'Attacker', 'attacker_' + ts, 'ATK' + ts],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
  const token = jwt.sign({ id: attackerId, email }, JWT_SECRET, { expiresIn: '1h' });
  return { id: attackerId, token };
}

/**
 * Realiza una fetch autenticada como un usuario concreto.
 */
async function authedFetch(backendUrl, path, method, body, token) {
  const response = await fetch(backendUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await response.json(); } catch {}
  return { status: response.status, body: json };
}

/**
 * SEC-001 — Audio UPDATE: Tenant B no puede modificar grabación de Tenant A
 * VULN-001 (Crítico) — audioController.updateAudioRecording
 */
async function scenarioSec001AudioUpdateIDOR(env) {
  const a = new ConvergenceAssert('SEC-001 — Audio UPDATE cross-tenant (IDOR)');
  const attacker = await createAttacker(env);

  // A crea una grabación
  const recordingId = uuidv4();
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      'INSERT INTO audio_recordings (id, user_id, name, local_uri, duration) VALUES (?, ?, ?, ?, ?)',
      [recordingId, env.userId, 'Original Name', 'file://local/rec.m4a', 60],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });

  // B intenta cambiar el nombre de la grabación de A
  const attackRes = await authedFetch(
    env.backendUrl,
    '/api/audio-recordings/' + recordingId,
    'PUT',
    { name: 'Hacked Name', cloud_url: 'https://evil.com/stolen.m4a' },
    attacker.token
  );

  // Debe ser rechazado (403/404: fila existe pero no pertenece al atacante)
  a.equal(
    attackRes.status === 403 || attackRes.status === 404 || attackRes.body?.changes === 0,
    true,
    'B atacando audio de A -> debe ser rechazado'
  );

  // Verificar que el recurso de A no fue alterado
  const row = await new Promise((resolve) => {
    env.backendDb.get(
      'SELECT name, cloud_url, user_id FROM audio_recordings WHERE id = ?',
      [recordingId],
      (err, r) => resolve(r)
    );
  });
  a.equal(row.name, 'Original Name', 'Nombre de A debe ser intacto');
  a.equal(row.cloud_url, null, 'cloud_url de A debe ser null (sin cambios)');
  a.equal(String(row.user_id), String(env.userId), 'user_id de A debe ser el original');

  // B intenta reapuntar el user_id (campo eliminado de la allowlist)
  const ownershipHijack = await authedFetch(
    env.backendUrl,
    '/api/audio-recordings/' + recordingId,
    'PUT',
    { user_id: attacker.id },
    attacker.token
  );
  const rowAfter = await new Promise((resolve) => {
    env.backendDb.get(
      'SELECT user_id FROM audio_recordings WHERE id = ?',
      [recordingId],
      (err, r) => resolve(r)
    );
  });
  a.equal(
    String(rowAfter.user_id),
    String(env.userId),
    'Ownership de A no debe cambiar después de intento de hijack'
  );

  // A sí puede modificar su propio recurso
  const ownerRes = await authedFetch(
    env.backendUrl,
    '/api/audio-recordings/' + recordingId,
    'PUT',
    { name: 'Updated By Owner' },
    env.jwtToken
  );
  a.equal(ownerRes.status, 200, 'Owner puede actualizar su propio recurso');

  return a.report();
}

/**
 * SEC-002 — Schedule DELETE: Tenant B no puede borrar horario de Tenant A
 * VULN-003 (Alto) — schedulesController.deleteSchedule
 */
async function scenarioSec002ScheduleDeleteIDOR(env) {
  const a = new ConvergenceAssert('SEC-002 — Schedule DELETE cross-tenant (IDOR)');
  const attacker = await createAttacker(env);

  // Crear una materia de A primero (necesaria por FK)
  const subjectId = uuidv4();
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      'INSERT INTO subjects (id, user_id, name, color, sync_version) VALUES (?, ?, ?, ?, 0)',
      [subjectId, env.userId, 'Test Subject', '#FF0000'],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });

  // A crea un horario
  const scheduleId = uuidv4();
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      'INSERT INTO schedules (id, user_id, subject_id, day_of_week, start_time, end_time, sync_version) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [scheduleId, env.userId, subjectId, 1, '08:00', '10:00'],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });

  // B intenta borrar el horario de A
  const attackRes = await authedFetch(
    env.backendUrl,
    '/api/schedules/' + scheduleId,
    'DELETE',
    null,
    attacker.token
  );

  // La query tiene AND user_id = ? → 0 changes → el horario sigue existiendo
  const rowAfter = await new Promise((resolve) => {
    env.backendDb.get(
      'SELECT id FROM schedules WHERE id = ?',
      [scheduleId],
      (err, r) => resolve(r)
    );
  });
  a.equal(!!rowAfter, true, 'Schedule de A debe seguir existiendo después del ataque de B');

  // A sí puede borrar su propio horario
  const ownerRes = await authedFetch(
    env.backendUrl,
    '/api/schedules/' + scheduleId,
    'DELETE',
    null,
    env.jwtToken
  );
  a.equal(ownerRes.status, 200, 'Owner puede borrar su propio horario');
  const rowGone = await new Promise((resolve) => {
    env.backendDb.get(
      'SELECT id FROM schedules WHERE id = ?',
      [scheduleId],
      (err, r) => resolve(r)
    );
  });
  a.equal(rowGone, undefined, 'Horario eliminado por su owner');

  return a.report();
}

/**
 * SEC-003 — Flashcard updateCardStatus: Tenant B no puede alterar estado FSRS de tarjeta de A
 * VULN-003 (Alto) — flashcardsController.updateCardStatus
 */
async function scenarioSec003FlashcardStatusIDOR(env) {
  const a = new ConvergenceAssert('SEC-003 — Flashcard STATUS cross-tenant (IDOR)');
  const attacker = await createAttacker(env);

  // Crear deck y tarjeta de A
  const deckId = uuidv4();
  const cardId = uuidv4();
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      'INSERT INTO flashcard_decks (id, user_id, title, sync_version) VALUES (?, ?, ?, 0)',
      [deckId, env.userId, 'Test Deck'],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      'INSERT INTO flashcards (id, deck_id, front, back, status, sync_version) VALUES (?, ?, ?, ?, ?, 0)',
      [cardId, deckId, 'Front', 'Back', 'new'],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });

  // B intenta cambiar el status de la tarjeta de A
  const attackRes = await authedFetch(
    env.backendUrl,
    '/api/flashcards/' + cardId,
    'PUT',
    { status: 'mastered' },
    attacker.token
  );
  a.equal(attackRes.status, 403, 'B atacando tarjeta de A → 403');

  // Verificar que el status no cambió
  const row = await new Promise((resolve) => {
    env.backendDb.get(
      'SELECT status FROM flashcards WHERE id = ?',
      [cardId],
      (err, r) => resolve(r)
    );
  });
  a.equal(row.status, 'new', 'Status de tarjeta de A debe ser intacto');

  // A sí puede cambiar su propio status
  const ownerRes = await authedFetch(
    env.backendUrl,
    '/api/flashcards/' + cardId,
    'PUT',
    { status: 'mastered' },
    env.jwtToken
  );
  a.equal(ownerRes.status, 200, 'Owner puede cambiar status de su propia tarjeta');

  return a.report();
}

/**
 * SEC-004 — initialSync no expone secretos
 * VULN-006 (Alto) — syncController.initialSync SELECT *
 */
async function scenarioSec004InitialSyncNoSecrets(env) {
  const a = new ConvergenceAssert('SEC-004 — initialSync no expone secretos');

  const res = await authedFetch(
    env.backendUrl,
    '/api/sync/initial',
    'GET',
    null,
    env.jwtToken
  );
  a.equal(res.status, 200, 'initialSync retorna 200');

  const user = res.body?.payload?.user;
  a.equal(!!user, true, 'payload.user existe');

  // Campos que jamás deben aparecer
  const forbidden = ['password_hash', 'biometric_token', 'reset_token', 'reset_token_expiry'];
  for (const field of forbidden) {
    a.equal(
      user[field],
      undefined,
      'payload.user no debe exponer: ' + field
    );
  }

  // Campos que sí deben estar
  const required = ['id', 'email', 'name', 'username', 'share_pin'];
  for (const field of required) {
    a.equal(
      user[field] !== undefined,
      true,
      'payload.user debe incluir: ' + field
    );
  }

  return a.report();
}

/**
 * SEC-005 — Calendar Events: userId fallback eliminado
 * VULN-005 (Medio) — calendarEventsController
 */
async function scenarioSec005CalendarNoFallback(env) {
  const a = new ConvergenceAssert('SEC-005 — Calendar no acepta user_id del body/query');
  const attacker = await createAttacker(env);

  // Crear evento de A
  const eventId = uuidv4();
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      'INSERT INTO calendar_events (id, user_id, title, event_type, start_date, end_date, sync_version) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [eventId, env.userId, 'Private Event', 'study', '2026-01-01', '2026-01-01'],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });

  // B autenticado intenta leer el evento de A pasando user_id=A en query
  const readRes = await authedFetch(
    env.backendUrl,
    '/api/calendar/events/' + eventId + '?user_id=' + env.userId,
    'GET',
    null,
    attacker.token
  );
  // El userId viene de req.user.id (attacker), no del query. El evento es de A → 404.
  a.equal(readRes.status, 404, 'B no puede leer evento de A via user_id en query');

  // B intenta actualizar el evento de A usando user_id=A en body
  const updateRes = await authedFetch(
    env.backendUrl,
    '/api/calendar/events/' + eventId,
    'PUT',
    { title: 'Hacked', user_id: env.userId },
    attacker.token
  );
  a.equal(updateRes.status === 403 || updateRes.status === 404, true,
    'B no puede actualizar evento de A'
  );

  // Verificar que el título no cambió
  const row = await new Promise((resolve) => {
    env.backendDb.get(
      'SELECT title FROM calendar_events WHERE id = ?',
      [eventId],
      (err, r) => resolve(r)
    );
  });
  a.equal(row?.title, 'Private Event', 'Título de evento de A sigue intacto');

  return a.report();
}

module.exports = {
  scenarioSec001AudioUpdateIDOR,
  scenarioSec002ScheduleDeleteIDOR,
  scenarioSec003FlashcardStatusIDOR,
  scenarioSec004InitialSyncNoSecrets,
  scenarioSec005CalendarNoFallback,
};
