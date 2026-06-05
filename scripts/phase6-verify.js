#!/usr/bin/env node

/**
 * Phase 6: Quick Integration Check
 * Verifica que todos los componentes críticos estén conectados correctamente
 * 
 * Ejecutar: npm run verify:phase6
 * O manualmente: node scripts/phase6-verify.js
 */

const fs = require('fs');
const path = require('path');

// Colors para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkFileContains(filePath, searchStrings) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return searchStrings.every(str => content.includes(str));
}

function runChecks() {
  log('blue', '\n🔍 PHASE 6: QUICK INTEGRATION CHECK\n');
  let passed = 0;
  let failed = 0;

  const checks = [
    // ─────────────────────────────────────────
    // 1. DatabaseContext
    // ─────────────────────────────────────────
    {
      name: 'DatabaseContext.tsx exists',
      check: () =>
        checkFileExists(
          path.join(__dirname, '../mobile/src/context/DatabaseContext.tsx')
        ),
    },
    {
      name: 'DatabaseContext exports DatabaseProvider',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/context/DatabaseContext.tsx'),
          ['export function DatabaseProvider', 'export function useDatabaseReady']
        ),
    },
    {
      name: 'DatabaseContext prevents render until DB ready',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/context/DatabaseContext.tsx'),
          ['if (!isReady) return null', 'appInit()']
        ),
    },

    // ─────────────────────────────────────────
    // 2. UserRepository
    // ─────────────────────────────────────────
    {
      name: 'UserRepository.ts exists',
      check: () =>
        checkFileExists(
          path.join(
            __dirname,
            '../mobile/src/services/database/repositories/UserRepository.ts'
          )
        ),
    },
    {
      name: 'UserRepository has methods: getCurrentUser, updateToken, saveUser, clearUser',
      check: () =>
        checkFileContains(
          path.join(
            __dirname,
            '../mobile/src/services/database/repositories/UserRepository.ts'
          ),
          [
            'getCurrentUser',
            'updateToken',
            'saveUser',
            'clearUser',
          ]
        ),
    },
    {
      name: 'UserRepository exports singleton instance',
      check: () =>
        checkFileContains(
          path.join(
            __dirname,
            '../mobile/src/services/database/repositories/UserRepository.ts'
          ),
          ['export const userRepository']
        ),
    },

    // ─────────────────────────────────────────
    // 3. SyncService Conflict Resolution
    // ─────────────────────────────────────────
    {
      name: 'SyncService has resolveConflict method',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/services/database/SyncService.ts'),
          ['resolveConflict', 'last-write-wins']
        ),
    },
    {
      name: 'SyncService logs sync operations',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/services/database/SyncService.ts'),
          [
            '[SyncService] Iniciando sync',
            '[SyncService] ✅',
            '[SyncService] ❌',
          ]
        ),
    },
    {
      name: 'SyncService has ConflictStrategy type',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/services/database/SyncService.ts'),
          ['type ConflictStrategy']
        ),
    },

    // ─────────────────────────────────────────
    // 4. UUID Utils
    // ─────────────────────────────────────────
    {
      name: 'uuid.ts has isValidUUID function',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/utils/uuid.ts'),
          [
            'export function isValidUUID',
            'UUID_V4_REGEX',
            '4[0-9a-f]{3}',
          ]
        ),
    },
    {
      name: 'uuid.ts has generateOrValidateUUID function',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/utils/uuid.ts'),
          ['export function generateOrValidateUUID', 'isValidUUID(maybeUUID)']
        ),
    },
    {
      name: 'uuid.ts validates UUID v4 format',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/utils/uuid.ts'),
          ['89ab', 'UUID_V4_REGEX.test(id)']
        ),
    },

    // ─────────────────────────────────────────
    // 5. _layout.tsx Integration
    // ─────────────────────────────────────────
    {
      name: '_layout.tsx imports DatabaseProvider',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/app/_layout.tsx'),
          ['DatabaseProvider', 'useDatabaseReady']
        ),
    },
    {
      name: '_layout.tsx wraps app with DatabaseProvider',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/app/_layout.tsx'),
          [
            '<DatabaseProvider>',
            '<RootNavigator />',
            '</DatabaseProvider>',
          ]
        ),
    },
    {
      name: '_layout.tsx gates rendering until DB ready',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/app/_layout.tsx'),
          ['!isDatabaseReady || !appIsReady', 'return null']
        ),
    },

    // ─────────────────────────────────────────
    // 6. Migrations
    // ─────────────────────────────────────────
    {
      name: 'migrations.ts includes users table',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/services/database/migrations.ts'),
          [
            'CREATE TABLE IF NOT EXISTS users',
            'id TEXT PRIMARY KEY',
            'email TEXT NOT NULL UNIQUE',
            'token TEXT NOT NULL',
          ]
        ),
    },
    {
      name: 'migrations.ts has index on users.email',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/services/database/migrations.ts'),
          ['idx_users_email', 'ON users(email)']
        ),
    },

    // ─────────────────────────────────────────
    // 7. Repositories Index
    // ─────────────────────────────────────────
    {
      name: 'repositories/index.ts exports UserRepository',
      check: () =>
        checkFileContains(
          path.join(
            __dirname,
            '../mobile/src/services/database/repositories/index.ts'
          ),
          ["export { UserRepository, userRepository, type User }"]
        ),
    },

    // ─────────────────────────────────────────
    // 8. Tests
    // ─────────────────────────────────────────
    {
      name: '__tests__/offline-sync.test.ts exists',
      check: () =>
        checkFileExists(
          path.join(__dirname, '../mobile/src/__tests__/offline-sync.test.ts')
        ),
    },
    {
      name: 'offline-sync.test.ts has all test suites',
      check: () =>
        checkFileContains(
          path.join(__dirname, '../mobile/src/__tests__/offline-sync.test.ts'),
          [
            "describe('UUID Generation & Validation'",
            "describe('Offline Operations'",
            "describe('Sync Queue Management'",
            "describe('Conflict Resolution'",
            "describe('Data Integrity'",
          ]
        ),
    },
  ];

  log('blue', '════════════════════════════════════════════\n');

  checks.forEach((check, index) => {
    try {
      const result = check.check();
      if (result) {
        log('green', `✅ [${index + 1}] ${check.name}`);
        passed++;
      } else {
        log('red', `❌ [${index + 1}] ${check.name}`);
        failed++;
      }
    } catch (error) {
      log('red', `❌ [${index + 1}] ${check.name} (Error: ${error.message})`);
      failed++;
    }
  });

  log('blue', '\n════════════════════════════════════════════\n');

  if (failed === 0) {
    log('green', `✨ ALL CHECKS PASSED! (${passed}/${passed})\n`);
    log('green', 'You are ready for Phase 6 testing!\n');
    process.exit(0);
  } else {
    log('yellow', `⚠️  ${failed} check(s) failed, ${passed} passed\n`);
    log('yellow', 'Please fix the issues above before proceeding.\n');
    process.exit(1);
  }
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
runChecks();
