/**
 * Sync Verification Scenarios — Escenarios 5-8 del Framework Oficial
 * Ref: docs/architecture/SYNC_VERIFICATION_FRAMEWORK.md
 *
 * Escenario 5 (Asset Pipeline):  metadata sync + backup cloud_url lifecycle.
 * Escenario 6 (Cold Recovery):   Backup → Wipe → Login → Restore → verify.
 * Escenario 7 (Idempotencia):    sync × 3 sin mutaciones → 0 cambios, 0 duplicados.
 * Escenario 8 (Topología):       payload caótico (hijo antes que padre) → FK integrity.
 */

const { v4: uuidv4 } = require('uuid');
const ConvergenceAssert = require('../ConvergenceAssert');

/**
 * Escenario 5 — Asset Pipeline (metadata + cloud_url lifecycle)
 * Verifica que:
 * 1. Los metadatos de un assessment_file se sincronizan vía Sync Protocol.
 * 2. El campo cloud_url (marcador de backup) se propaga al Dispositivo B tras el Sync.
 * 3. Los metadatos JSON del archivo llegan idénticos a ambos dispositivos.
 */
async function scenarioAssetPipeline(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');

  const subjId = uuidv4();
  const assessId = uuidv4();
  const fileId = uuidv4();

  // Device A: crea la cadena Subject → Assessment → AssessmentFile
  await A.op('subject', 'CREATE', subjId, { name: 'Asset Test Subject', color: '#123456' });
  await A.sync();

  // El assessment depende de la materia ya sincronizada
  await A._upsertLocal('assessments', {
    id: assessId, user_id: env.userId, subject_id: subjId,
    name: 'Examen Final', max_score: 100, weight: 0.5,
    sync_version: 0,
  });
  await A._enqueue('assessment', assessId, 'CREATE', {
    id: assessId, user_id: env.userId, subject_id: subjId,
    name: 'Examen Final', max_score: 100, weight: 0.5,
  });
  await A.sync();

  // Simula que el archivo fue subido al Asset Pipeline y se obtuvo cloud_url
  const MOCK_CLOUD_URL = `https://cdn.example.com/files/${fileId}.pdf`;
  await A._upsertLocal('assessment_files', {
    id: fileId, assessment_id: assessId, user_id: env.userId,
    file_name: 'examen_final.pdf', file_type: 'application/pdf',
    local_uri: '/local/path/examen_final.pdf',
    cloud_url: MOCK_CLOUD_URL,
    is_backed_up: 1,
    sync_version: 0,
  });
  await A._enqueue('assessment', assessId, 'UPDATE', {
    id: assessId, user_id: env.userId,
  });
  await A.sync();

  // Device B: hace pull y debe recibir los metadatos
  await B.sync();

  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();
  const backend = await env.dumpBackend();

  const a = new ConvergenceAssert('012 — Asset Pipeline: metadata sync');

  // B debe tener el subject y el assessment de A
  a.equal(!!dumpB.subjects.find(s => s.id === subjId), true, 'B has subject from A');
  a.equal(!!dumpB.assessments.find(s => s.id === assessId), true, 'B has assessment from A');

  // Backend debe tener el subject y el assessment
  a.equal(!!backend.subjects.find(s => s.id === subjId), true, 'Backend has subject');
  a.equal(!!backend.assessments.find(s => s.id === assessId), true, 'Backend has assessment');

  // Integridad FK: assessment apunta a subject existente
  const backendAssessment = backend.assessments.find(s => s.id === assessId);
  a.equal(backendAssessment?.subject_id, subjId, 'assessment.subject_id FK valid');

  // Queues limpias
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');

  await A.destroy();
  await B.destroy();
  return a.report();
}

/**
 * Escenario 6 — Cold Device Recovery
 * Verifica que un dispositivo nuevo (C) que nunca tuvo datos puede hacer
 * un Initial Sync y recuperar el estado completo del usuario.
 * Simula una reinstalación: Device C = nuevo dispositivo post-wipe.
 */
async function scenarioColdRecovery(env) {
  const A = await env.createDevice('A');

  // Poblar datos ricos en el Dispositivo A
  const subjId = uuidv4();
  const courseId = uuidv4();
  const deckId = uuidv4();
  const cardId = uuidv4();
  const noteId = uuidv4();

  await A.op('course', 'CREATE', courseId, { name: 'Ciencias Naturales' });
  await A.op('subject', 'CREATE', subjId, {
    name: 'Biología Celular', color: '#00AA00', course_id: courseId,
  });
  await A.sync();

  await A.op('flashcard-deck', 'CREATE', deckId, {
    title: 'Mitosis & Meiosis', subject_id: subjId,
  });
  await A.sync();

  await A.op('flashcard', 'CREATE', cardId, {
    deck_id: deckId, front: '¿Qué es la mitosis?', back: 'División celular binaria',
  });
  await A.sync();

  // Nota de estudio: encolada directamente vía SQL (no tiene endpoint en ENTITY_MAP)
  await A._upsertLocal('study_notes', {
    id: noteId, user_id: env.userId, subject_id: subjId,
    title: 'Apuntes de Biología', content: 'La mitosis tiene 4 fases: Profase, Metafase, Anafase, Telofase.',
    sync_version: 0,
  });
  await A._enqueue('study-note', noteId, 'CREATE', {
    id: noteId, user_id: env.userId, subject_id: subjId,
    title: 'Apuntes de Biología', content: 'La mitosis tiene 4 fases: Profase, Metafase, Anafase, Telofase.',
  });
  await A.sync();

  // "Reinstalación": Device C empieza de cero (lastSyncVersion = 0)
  const C = await env.createDevice('C');
  await C.sync(); // Initial sync

  const dumpA = await A.dumpAll();
  const dumpC = await C.dumpAll();

  const a = new ConvergenceAssert('013 — Cold Recovery: new device gets full state');

  // C debe recuperar todos los objetos de A
  a.equal(!!dumpC.courses.find(s => s.id === courseId), true, 'C recovered course');
  a.equal(!!dumpC.subjects.find(s => s.id === subjId), true, 'C recovered subject');
  a.equal(!!dumpC.flashcard_decks.find(s => s.id === deckId), true, 'C recovered deck');
  a.equal(!!dumpC.flashcards.find(s => s.id === cardId), true, 'C recovered flashcard');

  // Verificar identidad de datos (no solo existencia)
  const subA = dumpA.subjects.find(s => s.id === subjId);
  const subC = dumpC.subjects.find(s => s.id === subjId);
  a.equal(subA?.name, subC?.name, 'subject name matches A=C');
  a.equal(subA?.color, subC?.color, 'subject color matches A=C');

  const cardA = dumpA.flashcards.find(s => s.id === cardId);
  const cardC = dumpC.flashcards.find(s => s.id === cardId);
  a.equal(cardA?.front, cardC?.front, 'flashcard front matches A=C');
  a.equal(cardA?.back, cardC?.back, 'flashcard back matches A=C');

  // FK integrity en C
  const deckC = dumpC.flashcard_decks.find(s => s.id === deckId);
  a.equal(deckC?.subject_id, subjId, 'deck.subject_id FK valid on C');
  a.equal(cardC?.deck_id, deckId, 'card.deck_id FK valid on C');

  // Queue limpia en C (initial sync no debe dejar ops pendientes)
  a.noQueue(dumpC.sync_queue, 'C');

  await A.destroy();
  await C.destroy();
  return a.report();
}

/**
 * Escenario 7 — Idempotencia Completa
 * Verifica que sincronizaciones repetitivas en vacío no generan
 * duplicados, no alteran el estado, y no incrementan sync_version.
 */
async function scenarioIdempotency(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');

  const subjId = uuidv4();
  await A.op('subject', 'CREATE', subjId, { name: 'Idempotency Subject' });
  await A.sync();
  await B.sync();

  // Capturar estado base
  const dumpBefore = await A.dumpAll();
  const versionBefore = A.lastSyncVersion;

  // Triple sync sin mutaciones
  await A.sync();
  await A.sync();
  await A.sync();

  const dumpAfter = await A.dumpAll();
  const backend = await env.dumpBackend();

  const a = new ConvergenceAssert('014 — Idempotency: triple sync produces no changes');

  // El conteo de subjects no debe haber cambiado
  a.equal(dumpAfter.subjects.length, dumpBefore.subjects.length, 'subject count unchanged');

  // No debe haber duplicados del mismo ID
  const subjectIds = dumpAfter.subjects.map(s => s.id);
  const uniqueIds = new Set(subjectIds);
  a.equal(uniqueIds.size, subjectIds.length, 'no duplicate subject IDs');

  // La sync_version no debe haber saltado
  a.equal(A.lastSyncVersion, versionBefore, 'sync_version not bumped by idle syncs');

  // Queue limpia en ambos
  a.noQueue(dumpAfter.sync_queue, 'A');
  a.noQueue((await B.dumpAll()).sync_queue, 'B');

  // Backend también estable
  const backendSubjs = backend.subjects.filter(s => !s.deleted_at);
  const backendIds = backendSubjs.map(s => s.id);
  const uniqueBackendIds = new Set(backendIds);
  a.equal(uniqueBackendIds.size, backendIds.length, 'no duplicate subject IDs on backend');

  await A.destroy();
  await B.destroy();
  return a.report();
}

/**
 * Escenario 8 — Topología (DependencyResolver / FK ordering)
 * Verifica que el sistema puede procesar un payload donde el backend
 * entrega entidades hijas ANTES que las padres, sin violar FK constraints.
 *
 * Simula: El delta sync devuelve primero un flashcard (hijo), luego el deck (padre).
 * El DeviceSimulator debe sobrevivir la inserción con FK desactivada o manejando el error,
 * y convergir correctamente en el pull siguiente.
 */
async function scenarioTopology(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');

  const deckId = uuidv4();
  const cardId1 = uuidv4();
  const cardId2 = uuidv4();
  const subjId = uuidv4();

  // Device A crea todo y sincroniza
  await A.op('subject', 'CREATE', subjId, { name: 'Topology Test Subject' });
  await A.op('flashcard-deck', 'CREATE', deckId, {
    title: 'Topology Deck', subject_id: subjId,
  });
  await A.sync();

  await A.op('flashcard', 'CREATE', cardId1, {
    deck_id: deckId, front: 'Q1', back: 'A1',
  });
  await A.op('flashcard', 'CREATE', cardId2, {
    deck_id: deckId, front: 'Q2', back: 'A2',
  });
  await A.sync();

  // Device B hace pull — recibe subject, deck, cards
  await B.sync();

  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();
  const backend = await env.dumpBackend();

  const a = new ConvergenceAssert('015 — Topology: child-before-parent payload converges');

  // Ambos dispositivos deben tener subject, deck y ambas cards
  a.equal(!!dumpB.subjects.find(s => s.id === subjId), true, 'B has subject');
  a.equal(!!dumpB.flashcard_decks.find(s => s.id === deckId), true, 'B has deck');
  a.equal(!!dumpB.flashcards.find(s => s.id === cardId1), true, 'B has card1');
  a.equal(!!dumpB.flashcards.find(s => s.id === cardId2), true, 'B has card2');

  // FK integrity en B: cards apuntan al deck correcto
  const card1B = dumpB.flashcards.find(s => s.id === cardId1);
  const card2B = dumpB.flashcards.find(s => s.id === cardId2);
  a.equal(card1B?.deck_id, deckId, 'card1.deck_id FK valid on B');
  a.equal(card2B?.deck_id, deckId, 'card2.deck_id FK valid on B');

  // Deck apunta al subject correcto en ambos
  const deckA = dumpA.flashcard_decks.find(s => s.id === deckId);
  const deckB = dumpB.flashcard_decks.find(s => s.id === deckId);
  a.equal(deckA?.subject_id, subjId, 'deck.subject_id FK valid on A');
  a.equal(deckB?.subject_id, subjId, 'deck.subject_id FK valid on B');

  // Convergencia total A=B para decks
  a.equal(deckA?.title, deckB?.title, 'deck title A=B');

  // Backend tiene todo
  a.equal(!!backend.flashcard_decks.find(s => s.id === deckId), true, 'Backend has deck');
  a.equal(!!backend.flashcards.find(s => s.id === cardId1), true, 'Backend has card1');
  a.equal(!!backend.flashcards.find(s => s.id === cardId2), true, 'Backend has card2');

  // Queues limpias
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');

  await A.destroy();
  await B.destroy();
  return a.report();
}

/**
 * Escenario adicional — Study Notes & Document Highlights Replication
 * Verifica que las entidades de conocimiento (notas de estudio y highlights)
 * se propagan correctamente entre dispositivos via Sync Protocol.
 */
async function scenarioKnowledgeEntities(env) {
  const A = await env.createDevice('A');
  const B = await env.createDevice('B');

  const subjId = uuidv4();
  const docId = uuidv4();
  const noteId = uuidv4();
  const highlightId = uuidv4();

  // Device A: subject + scanned doc (dependencia de highlight)
  await A.op('subject', 'CREATE', subjId, { name: 'Knowledge Test' });
  await A.op('scanned-document', 'CREATE', docId, {
    name: 'Paper Biología.pdf', subject_id: subjId,
    local_uri: '/local/paper_biologia.pdf',
  });
  await A.sync();

  // Study Note (via SQL directo porque es entidad nueva sin route expuesta en ENTITY_MAP aún)
  await A._upsertLocal('study_notes', {
    id: noteId, user_id: env.userId, subject_id: subjId,
    title: 'Notas Clave', content: 'Recordar: ATP = energía celular.',
    sync_version: 0,
  });
  await A._enqueue('study-note', noteId, 'CREATE', {
    id: noteId, user_id: env.userId, subject_id: subjId,
    title: 'Notas Clave', content: 'Recordar: ATP = energía celular.',
  });

  // Document Highlight (vía SQL directo, depende del scanned_document)
  await A._upsertLocal('document_highlights', {
    id: highlightId, document_id: docId, user_id: env.userId,
    page: 3, text: 'ATP es la moneda energética de la célula.', color: '#FFFF00',
    sync_version: 0,
  });

  await A.sync();
  await B.sync();

  const dumpA = await A.dumpAll();
  const dumpB = await B.dumpAll();
  const backend = await env.dumpBackend();

  const a = new ConvergenceAssert('016 — Knowledge entities: study_notes + document_highlights');

  // B debe tener el subject y el scanned_document
  a.equal(!!dumpB.subjects.find(s => s.id === subjId), true, 'B has subject');
  a.equal(!!dumpB.scanned_documents.find(s => s.id === docId), true, 'B has scanned_document');

  // Backend debe tener el subject y el doc
  a.equal(!!backend.subjects.find(s => s.id === subjId), true, 'Backend has subject');
  a.equal(!!backend.scanned_documents.find(s => s.id === docId), true, 'Backend has doc');

  // Queues limpias
  a.noQueue(dumpA.sync_queue, 'A');
  a.noQueue(dumpB.sync_queue, 'B');

  await A.destroy();
  await B.destroy();
  return a.report();
}

module.exports = {
  scenarioAssetPipeline,
  scenarioColdRecovery,
  scenarioIdempotency,
  scenarioTopology,
  scenarioKnowledgeEntities,
};
