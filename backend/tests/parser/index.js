const assert = require('assert');
const path = require('path');
const P = require(path.join(__dirname, '../../services/ai/pipelines/flashcard/FlashcardResponseParser'));

let passed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('objeto canónico { topic, cards }', () => {
  const r = P.parseTopicAndCards('{"topic":"Fundamentos de Docker","cards":[{"x":1},{"x":2}]}');
  assert.strictEqual(r.topic, 'Fundamentos de Docker');
  assert.strictEqual(r.cards.length, 2);
});

test('objeto legacy { items, topic }', () => {
  const r = P.parseTopicAndCards('{"items":[{"a":1}],"topic":"Redes"}');
  assert.strictEqual(r.topic, 'Redes');
  assert.strictEqual(r.cards.length, 1);
});

test('array pelado sin topic', () => {
  const r = P.parseTopicAndCards('[{"a":1},{"a":2}]');
  assert.strictEqual(r.topic, null);
  assert.strictEqual(r.cards.length, 2);
});

test('array de un solo elemento (el objeto anidado no debe confundirse)', () => {
  const r = P.parseTopicAndCards('[{"a":1}]');
  assert.strictEqual(r.topic, null);
  assert.strictEqual(r.cards.length, 1);
});

test('objeto pre-parseado como entrada', () => {
  const r = P.parseTopicAndCards({ cards: [1, 2, 3], topic: '**Tema**' });
  assert.strictEqual(r.topic, 'Tema');
  assert.strictEqual(r.cards.length, 3);
});

test('variante antigua { flashcards }', () => {
  const r = P.parseTopicAndCards('{"flashcards":[{"question":"q","answer":"a"}]}');
  assert.strictEqual(r.cards.length, 1);
  assert.strictEqual(r.cards[0].data.front, 'q');
});

test('respuesta envuelta en código Markdown', () => {
  const r = P.parseTopicAndCards('```json\n{"topic":"Bio","cards":[{}]}\n```');
  assert.strictEqual(r.topic, 'Bio');
  assert.strictEqual(r.cards.length, 1);
});

test('lanza si no hay array de tarjetas', () => {
  assert.throws(() => P.parseTopicAndCards('{}'));
  assert.throws(() => P.parseTopicAndCards('{"foo":1}'));
  assert.throws(() => P.parseTopicAndCards('no json'));
});

test('normalizeTopic limpia y limita', () => {
  assert.strictEqual(P.normalizeTopic('  **Fisica**  '), 'Fisica');
  assert.strictEqual(P.normalizeTopic('"Química"'), 'Química');
  assert.strictEqual(P.normalizeTopic('Zyren'), null);
  assert.strictEqual(P.normalizeTopic(''), null);
  assert.strictEqual(P.normalizeTopic(undefined), null);
  assert.strictEqual(P.normalizeTopic('x'.repeat(80)).length, 60);
});

test('instrucciones de prompt presentes', () => {
  assert.ok(P.TOPIC_PROMPT_INSTRUCTION.includes('topic'));
  assert.ok(P.TOPIC_FORMAT_INSTRUCTION.includes('"cards"'));
});

for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  ✅ ${t.name}`);
  } catch (err) {
    console.error(`  ❌ ${t.name}`);
    console.error(err.message);
    process.exitCode = 1;
  }
}

console.log(`\n[Parser] ${passed}/${tests.length} tests PASS`);
if (process.exitCode) process.exit(process.exitCode);
