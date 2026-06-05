#!/usr/bin/env node

/**
 * UUID Validation Test Script
 * Tests básicos sin dependencia de Jest
 */

const path = require('path');

// Importar funciones UUID
const { isValidUUID, generateOrValidateUUID, validateEntityId, uuidv4 } = require('./src/utils/uuid');

console.log('\n' + '='.repeat(60));
console.log('  UUID VALIDATION TEST SUITE');
console.log('='.repeat(60) + '\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertMatch(str, regex, message) {
  if (!regex.test(str)) {
    throw new Error(message || `String "${str}" does not match pattern ${regex}`);
  }
}

// ──────────────────────────────────────────────────
// Test Suite 1: isValidUUID
// ──────────────────────────────────────────────────
console.log('Test Suite 1: isValidUUID');
console.log('-'.repeat(60));

test('should accept valid UUID v4', () => {
  const validUUID = '550e8400-e29b-41d4-a456-426614174000';
  assert(isValidUUID(validUUID) === true, 'Valid UUID not accepted');
});

test('should reject invalid UUID format', () => {
  assert(isValidUUID('not-a-uuid') === false, 'Invalid UUID accepted');
  assert(isValidUUID('550e8400-e29b-41d4-x456-426614174000') === false, 'Invalid char accepted');
  assert(isValidUUID('') === false, 'Empty string accepted');
});

test('should handle uppercase UUIDs', () => {
  const uuid = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE';
  assert(isValidUUID(uuid) === true, 'Uppercase UUID rejected');
});

test('should handle mixed case UUIDs', () => {
  const uuid = 'AaAaAaAa-BbBb-4CcC-8DdD-EeEeEeEeEeEe';
  assert(isValidUUID(uuid) === true, 'Mixed case UUID rejected');
});

console.log('');

// ──────────────────────────────────────────────────
// Test Suite 2: generateOrValidateUUID
// ──────────────────────────────────────────────────
console.log('Test Suite 2: generateOrValidateUUID');
console.log('-'.repeat(60));

test('should generate valid UUID when called with no args', () => {
  const uuid = generateOrValidateUUID();
  assert(uuid !== undefined, 'UUID is undefined');
  assert(typeof uuid === 'string', 'UUID is not a string');
  assert(isValidUUID(uuid) === true, 'Generated UUID is not valid');
});

test('should generate different UUIDs on each call', () => {
  const uuid1 = generateOrValidateUUID();
  const uuid2 = generateOrValidateUUID();
  const uuid3 = generateOrValidateUUID();
  
  assert(uuid1 !== uuid2, 'UUID1 equals UUID2');
  assert(uuid2 !== uuid3, 'UUID2 equals UUID3');
  assert(uuid1 !== uuid3, 'UUID1 equals UUID3');
});

test('should reuse valid UUID if provided', () => {
  const inputUUID = '550e8400-e29b-41d4-a456-426614174000';
  const result = generateOrValidateUUID(inputUUID);
  assertEqual(result, inputUUID, 'UUID was not reused');
});

test('should generate new UUID if invalid UUID provided', () => {
  const invalidUUID = 'not-valid';
  const result = generateOrValidateUUID(invalidUUID);
  assert(result !== invalidUUID, 'Invalid UUID was not replaced');
  assert(isValidUUID(result) === true, 'Generated UUID is invalid');
});

test('should maintain UUID consistency across calls', () => {
  const uuid = generateOrValidateUUID();
  const result1 = generateOrValidateUUID(uuid);
  const result2 = generateOrValidateUUID(uuid);
  
  assertEqual(result1, uuid, 'First call changed UUID');
  assertEqual(result2, uuid, 'Second call changed UUID');
});

console.log('');

// ──────────────────────────────────────────────────
// Test Suite 3: validateEntityId
// ──────────────────────────────────────────────────
console.log('Test Suite 3: validateEntityId');
console.log('-'.repeat(60));

test('should return true for valid UUID', () => {
  const validUUID = '550e8400-e29b-41d4-a456-426614174000';
  assert(validateEntityId(validUUID) === true, 'Valid UUID rejected');
});

test('should return false for invalid UUID', () => {
  assert(validateEntityId('invalid') === false, 'Invalid UUID accepted');
});

test('should return true for null (optional IDs)', () => {
  assert(validateEntityId(null) === true, 'null rejected');
});

test('should return true for undefined (optional IDs)', () => {
  assert(validateEntityId(undefined) === true, 'undefined rejected');
});

test('should return false for empty string', () => {
  assert(validateEntityId('') === false, 'Empty string accepted');
});

console.log('');

// ──────────────────────────────────────────────────
// Test Suite 4: UUID Pattern Compliance
// ──────────────────────────────────────────────────
console.log('Test Suite 4: UUID Pattern Compliance');
console.log('-'.repeat(60));

test('should generate UUID v4 with 4 in version field', () => {
  const uuid = generateOrValidateUUID();
  const groups = uuid.split('-');
  assertMatch(groups[2], /^4/, 'Version field does not start with 4');
});

test('should generate UUID v4 with correct variant field', () => {
  const uuid = generateOrValidateUUID();
  const groups = uuid.split('-');
  const variantChar = groups[3][0].toLowerCase();
  assert(['8', '9', 'a', 'b'].includes(variantChar), `Invalid variant char: ${variantChar}`);
});

test('should have correct segment lengths', () => {
  const uuid = generateOrValidateUUID();
  const groups = uuid.split('-');
  assert(groups.length === 5, `Expected 5 segments, got ${groups.length}`);
  assert(groups[0].length === 8, `Segment 0 length should be 8, got ${groups[0].length}`);
  assert(groups[1].length === 4, `Segment 1 length should be 4, got ${groups[1].length}`);
  assert(groups[2].length === 4, `Segment 2 length should be 4, got ${groups[2].length}`);
  assert(groups[3].length === 4, `Segment 3 length should be 4, got ${groups[3].length}`);
  assert(groups[4].length === 12, `Segment 4 length should be 12, got ${groups[4].length}`);
});

console.log('');

// ──────────────────────────────────────────────────
// Test Suite 5: UUID Base Function
// ──────────────────────────────────────────────────
console.log('Test Suite 5: uuidv4 Base Function');
console.log('-'.repeat(60));

test('should generate valid UUID v4 base', () => {
  const uuid = uuidv4();
  assert(uuid !== undefined, 'Base UUID is undefined');
  assert(isValidUUID(uuid) === true, 'Base UUID is not valid v4 format');
});

test('should generate different UUIDs each call', () => {
  const uuid1 = uuidv4();
  const uuid2 = uuidv4();
  assert(uuid1 !== uuid2, 'Base function generated same UUID twice');
});

console.log('');

// ──────────────────────────────────────────────────
// Test Results
// ──────────────────────────────────────────────────
console.log('='.repeat(60));
console.log('  TEST RESULTS');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}`);
console.log('='.repeat(60) + '\n');

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED!\n');
  process.exit(0);
} else {
  console.log(`⚠️  ${failed} TEST(S) FAILED\n`);
  process.exit(1);
}
