/**
 * Restore Validation Test Scenarios
 *
 * #021 — ValidPayload: clean cloud-items payload passes IntegrityReport
 * #022 — SchemaViolation: missing required fields fails validation
 * #023 — OrphanTranscript: transcript refs non-existent recording → FK error
 * #024 — DuplicateIds: same ID twice in same category → duplicate error
 * #025 — ConflictDetection: ID already exists locally → conflict reported
 * #026 — EmptyPayload: empty payload passes (nothing to validate)
 */

const { v4: uuidv4 } = require('uuid');
const ConvergenceAssert = require('../ConvergenceAssert');
const IntegrityReport = require('../IntegrityReport');

/**
 * #021 — ValidPayload
 * Create items, mark as backed up, fetch cloud-items, validate → PASS.
 */
async function scenarioValidPayload(env) {
  const A = await env.createDevice('A');
  const a = new ConvergenceAssert('021 — ValidPayload: clean payload passes');

  const subjId = uuidv4();
  await A.op('subject', 'CREATE', subjId, { name: 'Validator Subject' });
  await A.sync();

  const audioId = uuidv4();
  await A._api('POST', '/api/audio-recordings', {
    id: audioId, user_id: env.userId, subject_id: subjId,
    name: 'Val Audio', local_uri: '/local/val.m4a', duration: 60,
  });
  await A.markAsBackedUp('audio', audioId, 'https://cdn.test/val.m4a', { subject_id: subjId });

  const photoId = uuidv4();
  await A._api('POST', '/api/photos', {
    id: photoId, user_id: env.userId, subject_id: subjId,
    local_uri: '/local/val.jpg', es_favorita: 0,
  });
  await A.markAsBackedUp('photo', photoId, 'https://cdn.test/val.jpg', { subject_id: subjId });

  const docId = uuidv4();
  await A._api('POST', '/api/scanned_documents', {
    id: docId, user_id: env.userId, subject_id: subjId,
    name: 'Val Doc.pdf', local_uri: '/local/val.pdf',
  });
  await A.markAsBackedUp('document', docId, 'https://cdn.test/val.pdf', { subject_id: subjId });

  const cloud = await A.getCloudItems();
  a.equal(!!cloud, true, 'cloud-items returned');

  const report = new IntegrityReport('021 — ValidPayload');
  report.validate(cloud);

  a.equal(report.pass(), true, 'IntegrityReport passes');
  a.equal(report.results.schema.errors.length, 0, '0 schema errors');
  a.equal(report.results.integrity.fk_orphans.length, 0, '0 FK orphans');
  a.equal(report.results.integrity.duplicate_pks.length, 0, '0 duplicate PKs');
  a.equal(report.results.summary.total_items >= 3, true, `>=3 items (got ${report.results.summary.total_items})`);

  await A.destroy();
  return a.report();
}

/**
 * #022 — SchemaViolation
 * Manually inject item with missing required fields → FAIL.
 */
async function scenarioSchemaViolation(env) {
  const a = new ConvergenceAssert('022 — SchemaViolation: missing fields fails');

  const payload = {
    photos: [{ id: uuidv4() }],
    audio: [{ cloud_url: 'https://cdn.test/x.m4a' }],
    docs: [{ id: uuidv4(), cloud_url: 'https://cdn.test/x.pdf' }],
    transcripts: [],
    assessmentFiles: [],
    aiChats: [],
    flashcardDecks: [],
  };

  const report = new IntegrityReport('022 — SchemaViolation');
  report.validate(payload);

  a.equal(report.pass(), false, 'IntegrityReport fails');
  a.equal(report.results.schema.errors.length >= 2, true, `>=2 schema errors (got ${report.results.schema.errors.length})`);

  const hasMissingCloudUrl = report.results.schema.errors.some(e => e.includes("missing 'cloud_url'"));
  a.equal(hasMissingCloudUrl, true, 'error mentions missing cloud_url');

  const hasMissingId = report.results.schema.errors.some(e => e.includes("missing 'id'"));
  a.equal(hasMissingId, true, 'error mentions missing id');

  return a.report();
}

/**
 * #023 — OrphanTranscript
 * Transcript references non-existent audio recording → FK orphan error.
 */
async function scenarioOrphanTranscript(env) {
  const a = new ConvergenceAssert('023 — OrphanTranscript: FK error detected');

  const fakeRecId = uuidv4();
  const payload = {
    photos: [],
    audio: [],
    docs: [],
    transcripts: [{
      id: uuidv4(),
      recording_id: fakeRecId,
      transcript_type: 'audio',
      transcript_text: 'Hello world',
      cloud_url: 'https://cdn.test/t.json',
    }],
    assessmentFiles: [],
    aiChats: [],
    flashcardDecks: [],
  };

  const report = new IntegrityReport('023 — OrphanTranscript');
  report.validate(payload);

  a.equal(report.pass(), false, 'IntegrityReport fails on orphan');
  a.equal(report.results.integrity.fk_orphans.length, 1, '1 FK orphan');
  a.equal(report.results.integrity.fk_orphans[0].key, 'recording_id', 'orphan key is recording_id');
  a.equal(report.results.integrity.fk_orphans[0].value, fakeRecId, 'orphan value matches');

  return a.report();
}

/**
 * #024 — DuplicateIds
 * Same ID appears twice in photos → duplicate PK error.
 */
async function scenarioDuplicateIds(env) {
  const a = new ConvergenceAssert('024 — DuplicateIds: same ID twice fails');

  const dupId = uuidv4();
  const payload = {
    photos: [
      { id: dupId, cloud_url: 'https://cdn.test/a.jpg' },
      { id: dupId, cloud_url: 'https://cdn.test/b.jpg' },
    ],
    audio: [],
    docs: [],
    transcripts: [],
    assessmentFiles: [],
    aiChats: [],
    flashcardDecks: [],
  };

  const report = new IntegrityReport('024 — DuplicateIds');
  report.validate(payload);

  a.equal(report.pass(), false, 'IntegrityReport fails on duplicate');
  a.equal(report.results.integrity.duplicate_pks.length, 1, '1 duplicate PK');
  a.equal(report.results.integrity.duplicate_pks[0].id, dupId, 'duplicate ID matches');

  return a.report();
}

/**
 * #025 — ConflictDetection
 * Payload has items that already exist in backend (synced) → conflicts reported as warnings.
 */
async function scenarioConflictDetection(env) {
  const A = await env.createDevice('A');
  const a = new ConvergenceAssert('025 — ConflictDetection: existing IDs detected');

  const subjId = uuidv4();
  await A.op('subject', 'CREATE', subjId, { name: 'Conflict Subject' });
  await A.sync();

  const audioId = uuidv4();
  await A._api('POST', '/api/audio-recordings', {
    id: audioId, user_id: env.userId, subject_id: subjId,
    name: 'Conflict Audio', local_uri: '/local/conflict.m4a', duration: 90,
  });
  await A.markAsBackedUp('audio', audioId, 'https://cdn.test/conflict.m4a', { subject_id: subjId });

  const cloud = await A.getCloudItems();
  const foundInCloud = cloud.audio.find(x => x.id === audioId);
  a.equal(!!foundInCloud, true, 'audio in cloud-items');

  const report = new IntegrityReport('025 — ConflictDetection');
  report.validate(cloud);

  a.equal(report.pass(), true, 'IntegrityReport passes (conflicts are warnings)');

  await A.destroy();
  return a.report();
}

/**
 * #026 — EmptyPayload
 * Empty payload passes (nothing to validate).
 */
async function scenarioEmptyPayload(env) {
  const a = new ConvergenceAssert('026 — EmptyPayload: empty is valid');

  const payload = {
    photos: [],
    audio: [],
    docs: [],
    transcripts: [],
    assessmentFiles: [],
    aiChats: [],
    flashcardDecks: [],
  };

  const report = new IntegrityReport('026 — EmptyPayload');
  report.validate(payload);

  a.equal(report.pass(), true, 'IntegrityReport passes on empty');
  a.equal(report.results.summary.total_items, 0, '0 total items');
  a.equal(report.results.schema.errors.length, 0, '0 schema errors');
  a.equal(report.results.integrity.fk_orphans.length, 0, '0 FK orphans');

  return a.report();
}

module.exports = {
  scenarioValidPayload,
  scenarioSchemaViolation,
  scenarioOrphanTranscript,
  scenarioDuplicateIds,
  scenarioConflictDetection,
  scenarioEmptyPayload,
};
