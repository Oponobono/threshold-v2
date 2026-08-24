/**
 * seed_test_group.js
 * Inyecta datos de prueba para validación E2E offline en el usuario oponobono@gmail.com.
 * Idempotente: no duplica si ya existe el grupo con PIN E2ETEST01.
 *
 * Uso: node scripts/seed_test_group.js
 * Para resetear: node scripts/seed_test_group.js --reset
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const db = new sqlite3.Database(path.resolve(__dirname, '..', 'database.sqlite'));

const USER_ID = 'cd960c6e-63e6-4c72-9a4f-20b06d667a19'; // oponobono@gmail.com
const GROUP_PIN = 'E2ETEST01';
const NOW = new Date().toISOString();
const reset = process.argv.includes('--reset');

db.serialize(() => {
  if (reset) {
    // Clean up previous seed data
    db.run(`DELETE FROM group_memberships WHERE group_pin_id = ?`, [GROUP_PIN]);
    db.run(`DELETE FROM groups WHERE group_pin_id = ?`, [GROUP_PIN]);
    db.run(`DELETE FROM assessment_results WHERE user_id = ? AND assessment_id IN (
              SELECT id FROM assessments WHERE name LIKE '%(E2E)%')`, [USER_ID]);
    db.run(`DELETE FROM assessments WHERE user_id = ? AND name LIKE '%(E2E)%'`, [USER_ID]);
    db.run(`DELETE FROM subjects WHERE user_id = ? AND name LIKE '%(E2E)%'`, [USER_ID]);
    db.run(`DELETE FROM flashcard_decks WHERE user_id = ? AND title LIKE '%E2E%'`, [USER_ID]);
    console.log('[SEED] Reset done. Re-seeding...');
  }

  db.get('SELECT id FROM groups WHERE group_pin_id = ?', [GROUP_PIN], (err, existing) => {
    if (err) { console.error('Error checking group:', err.message); db.close(); return; }
    if (existing && !reset) {
      console.log(`[SEED] Group ${GROUP_PIN} already exists.`);
      console.log('[SEED] Run with --reset to re-seed: node scripts/seed_test_group.js --reset');
      verifyAndClose();
      return;
    }

    const GROUP_ID = crypto.randomUUID();
    const SUBJECT_ID = crypto.randomUUID();
    const ASSESSMENT_1_ID = crypto.randomUUID();
    const ASSESSMENT_2_ID = crypto.randomUUID();
    const RESULT_1_ID = crypto.randomUUID();
    const RESULT_2_ID = crypto.randomUUID();
    const DECK_1_ID = crypto.randomUUID();
    const DECK_2_ID = crypto.randomUUID();
    const MEMBERSHIP_ID = crypto.randomUUID();

    db.run('BEGIN TRANSACTION');

    // 1. Group
    db.run(
      `INSERT INTO groups (id, group_pin_id, name, creator_user_id, is_public, password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [GROUP_ID, GROUP_PIN, 'Threshold E2E Test', USER_ID, 1, null, NOW],
      (err) => { if (err) console.error('[SEED] Group:', err.message); else console.log('[SEED] ✓ Group created:', GROUP_PIN); }
    );

    // 2. Membership
    db.run(
      `INSERT INTO group_memberships (id, user_id, group_pin_id, role, joined_at)
       VALUES (?, ?, ?, ?, ?)`,
      [MEMBERSHIP_ID, USER_ID, GROUP_PIN, 'admin', NOW],
      (err) => { if (err) console.error('[SEED] Membership:', err.message); else console.log('[SEED] ✓ Membership created'); }
    );

    // 3. Subject (minimal columns — backend schema sin sync_version)
    db.run(
      `INSERT INTO subjects (id, user_id, name) VALUES (?, ?, ?)`,
      [SUBJECT_ID, USER_ID, 'Matemáticas (E2E)'],
      (err) => { if (err) console.error('[SEED] Subject:', err.message); else console.log('[SEED] ✓ Subject created'); }
    );

    // 4. Assessments (grade_value 0–5 scale, weight in %)
    db.run(
      `INSERT INTO assessments (id, user_id, subject_id, name, type, weight, out_of, is_completed, normalized_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ASSESSMENT_1_ID, USER_ID, SUBJECT_ID, 'Parcial 1 (E2E)', 'exam', 50, 5, 1, 4.2, NOW, NOW],
      (err) => { if (err) console.error('[SEED] Assessment 1:', err.message); else console.log('[SEED] ✓ Assessment 1 created (4.2/5)'); }
    );
    db.run(
      `INSERT INTO assessments (id, user_id, subject_id, name, type, weight, out_of, is_completed, normalized_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ASSESSMENT_2_ID, USER_ID, SUBJECT_ID, 'Parcial 2 (E2E)', 'exam', 50, 5, 1, 3.8, NOW, NOW],
      (err) => { if (err) console.error('[SEED] Assessment 2:', err.message); else console.log('[SEED] ✓ Assessment 2 created (3.8/5)'); }
    );

      // 5. Assessment results
      db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [USER_ID], (err, u) => {
        const gvId = u ? u.active_grading_version_id || 1 : 1;
        db.run(
          `INSERT INTO assessment_results (id, assessment_id, user_id, raw_value, normalized_value, grading_version_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [RESULT_1_ID, ASSESSMENT_1_ID, USER_ID, 4.2, 4.2, gvId, NOW, NOW],
          (err) => { if (err) console.error('[SEED] Result 1:', err.message); else console.log('[SEED] ✓ Result 1 created'); }
        );
        db.run(
          `INSERT INTO assessment_results (id, assessment_id, user_id, raw_value, normalized_value, grading_version_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [RESULT_2_ID, ASSESSMENT_2_ID, USER_ID, 3.8, 3.8, gvId, NOW, NOW],
          (err) => { if (err) console.error('[SEED] Result 2:', err.message); else console.log('[SEED] ✓ Result 2 created'); }
        );
      });

    // 6. Flashcard decks (vacíos, para la prueba)
    db.run(
      `INSERT INTO flashcard_decks (id, user_id, subject_id, title, description, is_public, total_reviews, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [DECK_1_ID, USER_ID, SUBJECT_ID, 'Deck E2E — Álgebra', 'Prueba offline', 0, 0, NOW],
      (err) => { if (err) console.error('[SEED] Deck 1:', err.message); else console.log('[SEED] ✓ Deck 1 created'); }
    );
    db.run(
      `INSERT INTO flashcard_decks (id, user_id, subject_id, title, description, is_public, total_reviews, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [DECK_2_ID, USER_ID, SUBJECT_ID, 'Deck E2E — Cálculo', 'Prueba offline', 0, 0, NOW],
      (err) => { if (err) console.error('[SEED] Deck 2:', err.message); else console.log('[SEED] ✓ Deck 2 created'); }
    );

    db.run('COMMIT', (err) => {
      if (err) { console.error('[SEED] COMMIT error:', err.message); db.close(); return; }
      console.log('\n[SEED] ✓ Seed completo.');
      console.log('[SEED] Group PIN para la app:', GROUP_PIN);
      verifyAndClose();
    });
  });
});

function verifyAndClose() {
  db.all(
    `SELECT gm.user_id, u.username FROM group_memberships gm
     JOIN users u ON gm.user_id = u.id WHERE gm.group_pin_id = ?`,
    [GROUP_PIN],
    (e, rows) => {
      console.log('[SEED] Verify members:', JSON.stringify(rows));
      db.get(
        `SELECT currentAverage FROM (
           SELECT SUM(a.normalized_value * a.weight) / NULLIF(SUM(a.weight),0) as currentAverage
           FROM assessments a WHERE a.user_id = ? AND a.normalized_value IS NOT NULL
         )`,
        [USER_ID],
        (e2, row) => {
          console.log('[SEED] Estimated GPA (raw):', row);
          db.close();
        }
      );
    }
  );
}
