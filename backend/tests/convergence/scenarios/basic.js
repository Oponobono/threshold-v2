async function scenarioCreate(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await A.op('subject', 'CREATE', id, { name: 'Math', color: '#FF0000' });
  await A.sync();
  await B.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('001 — CREATE sync convergence');
  const subA = dumpA.subjects.find(s => s.id === id) || {};
  const subB = dumpB.subjects.find(s => s.id === id) || {};
  const subBack = backend.subjects.find(s => s.id === id) || {};
  a.equal(subA.name, 'Math', 'A has name');
  a.equal(subA.id, id, 'A has id');
  a.deepEqual(subA, subB, 'A=B');
  a.deepEqual(subA, subBack, 'A=backend');
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioUpdate(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await A.op('subject', 'CREATE', id, { name: 'Physics', color: '#00FF00' });
  await A.sync();
  await B.sync();

  await A.op('subject', 'UPDATE', id, { name: 'Advanced Physics' });
  await A.sync();
  await B.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('002 — UPDATE sync convergence');
  const subA = dumpA.subjects.find(s => s.id === id);
  const subB = dumpB.subjects.find(s => s.id === id);
  const subBack = backend.subjects.find(s => s.id === id);
  a.equal(subA?.name, 'Advanced Physics', 'A name updated');
  a.equal(subB?.name, 'Advanced Physics', 'B got updated name');
  a.equal(subBack?.name, 'Advanced Physics', 'Backend got updated name');
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioConcurrentUpdateSameField(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await A.op('subject', 'CREATE', id, { name: 'Chemistry', color: '#0000FF' });
  await A.sync();
  await B.sync();

  await A.op('subject', 'UPDATE', id, { name: 'Organic Chemistry' });
  await B.op('subject', 'UPDATE', id, { name: 'Inorganic Chemistry' });

  await A.sync();
  await B.sync();
  await A.sync();
  await B.sync();
  await A.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('003 — Concurrent UPDATE on same field');
  // Both devices must converge to same name (last-writer-wins by sync order)
  a.equal(dumpA.subjects.find(s => s.id === id)?.name,
    dumpB.subjects.find(s => s.id === id)?.name,
    'A and B converge to same name');
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioDelete(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await A.op('subject', 'CREATE', id, { name: 'Biology' });
  await A.sync();
  await B.sync();

  await A.op('subject', 'DELETE', id);
  await A.sync();
  await B.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('004 — DELETE sync convergence');
  a.equal(dumpA.subjects.find(s => s.id === id), undefined, 'A has no deleted subject');
  a.equal(dumpB.subjects.find(s => s.id === id), undefined, 'B has no deleted subject');
  a.equal(backend.subjects.find(s => s.id === id), undefined, 'Backend has no deleted subject');
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioRestore(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await A.op('subject', 'CREATE', id, { name: 'History' });
  await A.sync();
  await B.sync();

  await A.op('subject', 'DELETE', id);
  await A.sync();
  await B.sync();

  await A.op('subject', 'CREATE', id, { name: 'World History' });
  await A.sync();
  await B.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('005 — RESTORE (DELETE+CREATE) convergence');
  const subA = dumpA.subjects.find(s => s.id === id);
  const subB = dumpB.subjects.find(s => s.id === id);
  const subBack = backend.subjects.find(s => s.id === id);
  a.equal(subA?.name, 'World History', 'A restored name');
  a.equal(subB?.name, 'World History', 'B got restored name');
  a.equal(subBack?.name, 'World History', 'Backend got restored name');
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioIdempotentDoubleCreate(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await A.op('subject', 'CREATE', id, { name: 'DoubleCreate' });
  await A.sync();
  await A.op('subject', 'CREATE', id, { name: 'DoubleCreate' });
  await A.sync();

  await B.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('006 — Idempotent double CREATE');
  a.deepEqual(
    dumpA.subjects.find(s => s.id === id),
    dumpB.subjects.find(s => s.id === id),
    'A=B'
  );
  a.deepEqual(
    dumpA.subjects.find(s => s.id === id),
    backend.subjects.find(s => s.id === id),
    'A=backend'
  );
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioOfflineThenSync(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const idA_subj = uuidv4();
  const idA_crs = uuidv4();
  const idB_subj = uuidv4();
  const idB_crs = uuidv4();

  await A.op('subject', 'CREATE', idA_subj, { name: 'Offline Physics' });
  await A.op('course', 'CREATE', idA_crs, { name: 'Physics 101' });
  await B.op('subject', 'CREATE', idB_subj, { name: 'Offline Chemistry' });
  await B.op('course', 'CREATE', idB_crs, { name: 'Chemistry 101' });

  await A.sync();
  await B.sync();
  await A.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('007 — Offline then sync both devices');
  // Each device should have its own + the other's after converge
  a.equal(dumpA.subjects.find(s => s.id === idA_subj)?.name, 'Offline Physics', 'A has own subject');
  a.equal(dumpA.subjects.find(s => s.id === idB_subj)?.name, 'Offline Chemistry', 'A got B subject');
  a.equal(dumpA.courses.find(s => s.id === idA_crs)?.name, 'Physics 101', 'A has own course');
  a.equal(dumpA.courses.find(s => s.id === idB_crs)?.name, 'Chemistry 101', 'A got B course');
  a.equal(dumpB.subjects.find(s => s.id === idA_subj)?.name, 'Offline Physics', 'B got A subject');
  a.equal(dumpB.subjects.find(s => s.id === idB_subj)?.name, 'Offline Chemistry', 'B has own subject');
  a.equal(dumpB.courses.find(s => s.id === idA_crs)?.name, 'Physics 101', 'B got A course');
  a.equal(dumpB.courses.find(s => s.id === idB_crs)?.name, 'Chemistry 101', 'B has own course');
  a.equal(backend.subjects.find(s => s.id === idA_subj)?.name, 'Offline Physics', 'Backend has A subject');
  a.equal(backend.subjects.find(s => s.id === idB_subj)?.name, 'Offline Chemistry', 'Backend has B subject');
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioStaleClientRejected(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await A.op('subject', 'CREATE', id, { name: 'Original Name' });
  await A.sync();
  await B.sync();

  // B updates the subject (legitimate)
  await B.op('subject', 'UPDATE', id, { name: 'Updated by B' });
  await B.sync();

  // A tries stale update with old version
  const queue = await A._all(`SELECT * FROM sync_queue`);
  for (const item of queue) {
    await A._run(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
  }
  await A.op('subject', 'UPDATE', id, { name: 'Stale update from A' });
  A.lastSyncVersion = 0;
  await A.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('008 — Stale client rejected (409)');
  const subBack = backend.subjects.find(s => s.id === id);
  a.equal(subBack?.name, 'Updated by B', 'Backend preserved B update (stale A rejected)');
  // A's stale op was rejected with 409 and remains in queue (expected, not a sync failure)
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioFlashcardDeckWithCards(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const { v4: uuidv4 } = require('uuid');

  const deckId = uuidv4();
  const cardId = uuidv4();
  await A.op('flashcard-deck', 'CREATE', deckId, { title: 'Test Deck' });
  await A.sync();
  await B.sync();

  await A.op('flashcard', 'CREATE', cardId, { deck_id: deckId, front: 'Q1', back: 'A1' });
  await A.sync();
  await B.sync();

  const backend = await env.dumpBackend();
  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('009 — Flashcard deck + card sync');
  a.equal(!!dumpA.flashcard_decks.find(s => s.id === deckId), true, 'A has deck');
  a.equal(!!dumpB.flashcard_decks.find(s => s.id === deckId), true, 'B has deck');
  a.equal(!!dumpB.flashcards.find(s => s.id === cardId), true, 'B has card');
  a.deepEqual(
    dumpA.flashcard_decks.find(s => s.id === deckId),
    dumpB.flashcard_decks.find(s => s.id === deckId),
    'deck A=B'
  );
  a.equal(
    dumpA.flashcards.find(s => s.id === cardId)?.front,
    dumpB.flashcards.find(s => s.id === cardId)?.front,
    'card front A=B'
  );
  a.equal(
    dumpA.flashcards.find(s => s.id === cardId)?.back,
    dumpB.flashcards.find(s => s.id === cardId)?.back,
    'card back A=B'
  );
  a.equal(!!dumpA.flashcards.find(s => s.id === cardId), true, 'A has card');
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');
  await A.destroy(); await B.destroy();
  return a.report();
}

async function scenarioInitialSync(env) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await env.queryBackend(
    `INSERT INTO subjects (id, user_id, name, sync_version, created_at, updated_at)
     VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))`,
    [id, env.userId, 'Pre-existing Subject']
  );

  const A = await env.createDevice('A');
  await A.sync();

  const dumpA = await A.dumpAll();

  const assert = require('../ConvergenceAssert');
  const a = new assert('010 — Initial sync pulls pre-existing data');
  a.equal(!!dumpA.subjects.find(s => s.id === id), true, 'A got pre-existing subject');
  a.equal(dumpA.subjects.find(s => s.id === id)?.name, 'Pre-existing Subject', 'A got correct name');
  a.noQueue(dumpA.sync_queue, 'A');
  await A.destroy();
  return a.report();
}

module.exports = {
  scenarioCreate,
  scenarioUpdate,
  scenarioConcurrentUpdateSameField,
  scenarioDelete,
  scenarioRestore,
  scenarioIdempotentDoubleCreate,
  scenarioOfflineThenSync,
  scenarioStaleClientRejected,
  scenarioFlashcardDeckWithCards,
  scenarioInitialSync,
};
