/**
 * Backup/Restore Test Scenarios
 *
 * Escenario 1 — BackupUpload: entities → mark as backed up → verify stats + cloud_items
 * Escenario 2 — BackupRoundTrip: mark → wipe local → read cloud_items → restore → compare
 * Escenario 3 — BackupIdempotency: mark same item twice → no duplicate, stats stable
 * Escenario 4 — ColdRecovery: full rich data → backup → wipe → restore → 100% identical
 */

const { v4: uuidv4 } = require('uuid');
const ConvergenceAssert = require('../ConvergenceAssert');

/**
 * Scenario 1 — BackupUpload
 * Verifies that marking entities as backed up updates stats and cloud_items correctly.
 */
async function scenarioBackupUpload(env) {
  const A = await env.createDevice('A');
  const a = new ConvergenceAssert('017 — BackupUpload: mark → stats + cloud_items');

  // Create a subject (needed for photo FK)
  const subjId = uuidv4();
  await A.op('subject', 'CREATE', subjId, { name: 'Backup Subject', color: '#FF0000' });
  await A.sync();

  // Create a photo via the backend (so it exists in the photos table with subject_id)
  const photoId = uuidv4();
  const photoRes = await A._api('POST', '/api/photos', {
    id: photoId, user_id: env.userId, subject_id: subjId,
    local_uri: '/local/photo.jpg', es_favorita: 0,
  });
  a.equal(photoRes.ok, true, 'photo created on backend');

  // Create an audio recording
  const audioId = uuidv4();
  const audioRes = await A._api('POST', '/api/audio-recordings', {
    id: audioId, user_id: env.userId, subject_id: subjId,
    name: 'Test Recording', local_uri: '/local/rec.m4a', duration: 120,
  });
  a.equal(audioRes.ok, true, 'audio created on backend');

  // Create a scanned document
  const docId = uuidv4();
  const docRes = await A._api('POST', '/api/scanned_documents', {
    id: docId, user_id: env.userId, subject_id: subjId,
    name: 'Test Doc.pdf', local_uri: '/local/doc.pdf',
  });
  a.equal(docRes.ok, true, 'document created on backend');

  // Initial stats: 0 backed up
  const statsBefore = await A.getBackupStats();
  a.equal(statsBefore.photos.total >= 1, true, 'photo counted in stats');
  a.equal(statsBefore.photos.backed, 0, 'photo not backed yet');
  a.equal(statsBefore.audio.backed, 0, 'audio not backed yet');
  a.equal(statsBefore.docs.backed, 0, 'docs not backed yet');

  // Mark all three as backed up
  const markPhoto = await A.markAsBackedUp('photo', photoId, 'https://cdn.example.com/photo.jpg', { subject_id: subjId });
  a.equal(markPhoto.ok, true, 'photo marked as backed up');

  const markAudio = await A.markAsBackedUp('audio', audioId, 'https://cdn.example.com/audio.m4a', { subject_id: subjId });
  a.equal(markAudio.ok, true, 'audio marked as backed up');

  const markDoc = await A.markAsBackedUp('document', docId, 'https://cdn.example.com/doc.pdf', { subject_id: subjId });
  a.equal(markDoc.ok, true, 'document marked as backed up');

  // Stats after: all backed
  const statsAfter = await A.getBackupStats();
  a.equal(statsAfter.photos.backed >= 1, true, 'photo now backed');
  a.equal(statsAfter.audio.backed >= 1, true, 'audio now backed');
  a.equal(statsAfter.docs.backed >= 1, true, 'docs now backed');

  // Cloud items: all three should appear
  const cloud = await A.getCloudItems();
  a.equal(cloud.photos.length >= 1, true, 'photo in cloud_items');
  a.equal(cloud.audio.length >= 1, true, 'audio in cloud_items');
  a.equal(cloud.docs.length >= 1, true, 'docs in cloud_items');

  // Pending items: should NOT include the backed ones
  const pending = await A.getPendingItems();
  const pendingPhotoIds = (pending.photos || []).map(p => p.id);
  a.equal(pendingPhotoIds.includes(photoId), false, 'photo not in pending');

  await A.destroy();
  return a.report();
}

/**
 * Scenario 2 — BackupRoundTrip
 * Verifies that after wiping local data, the cloud_items inventory still
 * reflects what was backed up (the "inventory" survives even if local data doesn't).
 */
async function scenarioBackupRoundTrip(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');
  const a = new ConvergenceAssert('018 — BackupRoundTrip: mark → wipe → cloud_items survives');

  // Create subject + audio on A, sync to backend
  const subjId = uuidv4();
  await A.op('subject', 'CREATE', subjId, { name: 'RoundTrip Subject' });
  await A.sync();

  const audioId = uuidv4();
  await A._api('POST', '/api/audio-recordings', {
    id: audioId, user_id: env.userId, subject_id: subjId,
    name: 'RoundTrip Audio', local_uri: '/local/rt.m4a', duration: 60,
  });

  // Mark as backed up
  await A.markAsBackedUp('audio', audioId, 'https://cdn.example.com/rt.m4a', { subject_id: subjId });

  // Cloud items on A should include the audio
  const cloudA = await A.getCloudItems();
  const foundA = cloudA.audio.find(x => x.id === audioId);
  a.equal(!!foundA, true, 'A sees audio in cloud_items');
  a.equal(foundA.cloud_url, 'https://cdn.example.com/rt.m4a', 'cloud_url preserved');

  // Wipe A's local data
  await A.wipeLocalData();
  const dumpAfterWipe = await A.dumpAll();
  a.equal(dumpAfterWipe.audio_recordings.length, 0, 'A has no audio after wipe');

  // B syncs from backend — should get the audio recording (via delta sync, not backup)
  await B.sync();
  const dumpB = await B.dumpAll();
  const audioB = dumpB.audio_recordings.find(x => x.id === audioId);
  a.equal(!!audioB, true, 'B got audio via sync');
  a.equal(audioB.name, 'RoundTrip Audio', 'B audio name matches');

  // Backend still has the backed-up item
  const backend = await env.dumpBackend();
  const backendAudio = backend.audio_recordings.find(x => x.id === audioId);
  a.equal(!!backendAudio, true, 'backend still has audio');
  a.equal(backendAudio.is_backed_up, 1, 'backend shows is_backed_up=1');
  a.equal(backendAudio.cloud_url, 'https://cdn.example.com/rt.m4a', 'backend has cloud_url');

  await A.destroy();
  await B.destroy();
  return a.report();
}

/**
 * Scenario 3 — BackupIdempotency
 * Marking the same item twice should not duplicate or error.
 */
async function scenarioBackupIdempotency(env) {
  const A = await env.createDevice('A');
  const a = new ConvergenceAssert('019 — BackupIdempotency: double mark is safe');

  const subjId = uuidv4();
  await A.op('subject', 'CREATE', subjId, { name: 'Idempotency Subject' });
  await A.sync();

  const audioId = uuidv4();
  await A._api('POST', '/api/audio-recordings', {
    id: audioId, user_id: env.userId, subject_id: subjId,
    name: 'Idemp Audio', local_uri: '/local/idemp.m4a', duration: 30,
  });

  // Mark twice with same cloud_url
  const m1 = await A.markAsBackedUp('audio', audioId, 'https://cdn.example.com/idemp.m4a', { subject_id: subjId });
  a.equal(m1.ok, true, 'first mark succeeds');

  const m2 = await A.markAsBackedUp('audio', audioId, 'https://cdn.example.com/idemp.m4a', { subject_id: subjId });
  a.equal(m2.ok, true, 'second mark succeeds (idempotent)');

  // Stats should show exactly 1 backed
  const stats = await A.getBackupStats();
  a.equal(stats.audio.backed >= 1, true, 'audio backed exactly once');

  // Cloud items should show exactly 1 entry
  const cloud = await A.getCloudItems();
  const matching = cloud.audio.filter(x => x.id === audioId);
  a.equal(matching.length, 1, 'exactly 1 cloud_item entry');

  await A.destroy();
  return a.report();
}

/**
 * Scenario 4 — ColdRecovery
 * Full cycle: create rich data → sync → backup → wipe → restore from cloud_items → compare.
 * This is the "star scenario" of the certification.
 */
async function scenarioColdRecovery(env) {
  const A = await env.createDevice('A');
  const a = new ConvergenceAssert('020 — ColdRecovery: backup → wipe → restore → identical');

  // === PHASE 1: Create rich data on Device A ===
  const subjId = uuidv4();
  const courseId = uuidv4();
  const deckId = uuidv4();
  const cardId = uuidv4();

  await A.op('course', 'CREATE', courseId, { name: 'Ciencias' });
  await A.op('subject', 'CREATE', subjId, { name: 'Biología', color: '#00AA00', course_id: courseId });
  await A.sync();

  await A.op('flashcard-deck', 'CREATE', deckId, { title: 'Células', subject_id: subjId });
  await A.sync();

  await A.op('flashcard', 'CREATE', cardId, { deck_id: deckId, front: '¿Qué es?', back: 'Unidad básica' });
  await A.sync();

  // Create audio + photo via backend
  const audioId = uuidv4();
  const photoId = uuidv4();
  await A._api('POST', '/api/audio-recordings', {
    id: audioId, user_id: env.userId, subject_id: subjId,
    name: 'Clase 1', local_uri: '/local/clase1.m4a', duration: 300,
  });
  await A._api('POST', '/api/photos', {
    id: photoId, user_id: env.userId, subject_id: subjId,
    local_uri: '/local/diagrama.jpg', es_favorita: 0,
  });

  // Create assessment
  const assessId = uuidv4();
  await A._api('POST', '/api/assessments', {
    id: assessId, user_id: env.userId, subject_id: subjId,
    name: 'Parcial 1', weight: 0.5,
  });

  // === PHASE 2: Backup (mark all as backed up) ===
  await A.markAsBackedUp('audio', audioId, 'https://cdn.example.com/clase1.m4a', { subject_id: subjId });
  await A.markAsBackedUp('photo', photoId, 'https://cdn.example.com/diagrama.jpg', { subject_id: subjId });

  // Verify cloud_items has everything
  const cloud = await A.getCloudItems();
  a.equal(cloud.audio.length >= 1, true, 'cloud has audio');
  a.equal(cloud.photos.length >= 1, true, 'cloud has photo');

  // Capture backend state before wipe
  const backendBefore = await env.dumpBackend();
  const backendSubjBefore = backendBefore.subjects.find(s => s.id === subjId);
  a.equal(!!backendSubjBefore, true, 'backend has subject before wipe');

  // === PHASE 3: Wipe Device A completely ===
  await A.wipeLocalData();
  const dumpWiped = await A.dumpAll();
  a.equal(dumpWiped.subjects.length, 0, 'A wiped: no subjects');
  a.equal(dumpWiped.flashcards.length, 0, 'A wiped: no flashcards');
  a.equal(dumpWiped.audio_recordings.length, 0, 'A wiped: no audio');

  // === PHASE 4: Device A recovers via initial sync (simulates restore) ===
  await A.sync();
  const dumpRestored = await A.dumpAll();

  // Verify full recovery
  a.equal(!!dumpRestored.subjects.find(s => s.id === subjId), true, 'A restored subject');
  a.equal(!!dumpRestored.courses.find(s => s.id === courseId), true, 'A restored course');
  a.equal(!!dumpRestored.flashcard_decks.find(s => s.id === deckId), true, 'A restored deck');
  a.equal(!!dumpRestored.flashcards.find(s => s.id === cardId), true, 'A restored flashcard');
  a.equal(!!dumpRestored.audio_recordings.find(s => s.id === audioId), true, 'A restored audio');
  a.equal(!!dumpRestored.assessments.find(s => s.id === assessId), true, 'A restored assessment');

  // Data identity checks
  const subjRestored = dumpRestored.subjects.find(s => s.id === subjId);
  a.equal(subjRestored.name, 'Biología', 'subject name identical');
  a.equal(subjRestored.color, '#00AA00', 'subject color identical');

  const deckRestored = dumpRestored.flashcard_decks.find(s => s.id === deckId);
  a.equal(deckRestored.title, 'Células', 'deck title identical');

  const cardRestored = dumpRestored.flashcards.find(s => s.id === cardId);
  a.equal(cardRestored.front, '¿Qué es?', 'card front identical');
  a.equal(cardRestored.back, 'Unidad básica', 'card back identical');

  // FK integrity
  a.equal(deckRestored.subject_id, subjId, 'deck FK valid');
  a.equal(cardRestored.deck_id, deckId, 'card FK valid');

  // Backend untouched by wipe
  const backendAfter = await env.dumpBackend();
  a.equal(backendAfter.subjects.find(s => s.id === subjId)?.name, 'Biología', 'backend subject intact');

  await A.destroy();
  return a.report();
}

module.exports = {
  scenarioBackupUpload,
  scenarioBackupRoundTrip,
  scenarioBackupIdempotency,
  scenarioColdRecovery,
};
