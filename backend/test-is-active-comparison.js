#!/usr/bin/env node
/**
 * Test de compatibilidad: is_active = true vs is_active = 1
 */

const { db, initializeDb } = require('./db');

(async () => {
  try {
    await initializeDb();
    
    console.log('Testeando comparaciones de is_active...\n');
    
    // Test 1: is_active = 1
    console.log('[Test 1] Query con: is_active = 1');
    db.all(
      `SELECT COUNT(*) as count FROM grading_versions WHERE is_active = 1`,
      [],
      (err, rows) => {
        if (err) {
          console.error('❌ Error:', err.message);
        } else {
          console.log(`✓ Resultado: ${rows[0].count} registros\n`);
        }
        
        // Test 2: is_active = true
        console.log('[Test 2] Query con: is_active = true');
        db.all(
          `SELECT COUNT(*) as count FROM grading_versions WHERE is_active = true`,
          [],
          (err, rows) => {
            if (err) {
              console.error('❌ Error:', err.message);
            } else {
              console.log(`✓ Resultado: ${rows[0].count} registros\n`);
            }
            
            // Test 3: Comparación directa con parámetro
            console.log('[Test 3] Query con parámetro true');
            db.all(
              `SELECT COUNT(*) as count FROM grading_versions WHERE is_active = ?`,
              [true],
              (err, rows) => {
                if (err) {
                  console.error('❌ Error:', err.message);
                } else {
                  console.log(`✓ Resultado: ${rows[0].count} registros\n`);
                }
                
                // Test 4: Comparación directa con parámetro 1
                console.log('[Test 4] Query con parámetro 1');
                db.all(
                  `SELECT COUNT(*) as count FROM grading_versions WHERE is_active = ?`,
                  [1],
                  (err, rows) => {
                    if (err) {
                      console.error('❌ Error:', err.message);
                    } else {
                      console.log(`✓ Resultado: ${rows[0].count} registros\n`);
                    }
                    process.exit(0);
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
