#!/usr/bin/env node
/**
 * Script de Diagnóstico para Grading Systems API
 * 
 * Verifica:
 * - Estructura de la tabla grading_versions
 * - Contenido de grading_systems
 * - Compatibilidad de tipos de datos
 * - Ejecución de la query GET /api/grading-systems
 */

const { db, initializeDb } = require('./db');

(async () => {
  try {
    console.log('🔍 Iniciando diagnóstico de Grading Systems...\n');
    
    // Initialize DB
    console.log('[1/5] Inicializando base de datos...');
    await initializeDb();
    console.log('✓ BD inicializada\n');
    
    // Check grading_systems table
    console.log('[2/5] Verificando tabla grading_systems...');
    db.all('SELECT COUNT(*) as count FROM grading_systems', [], (err, rows) => {
      if (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
      }
      const count = rows[0].count;
      console.log(`✓ Total de sistemas: ${count}\n`);
      
      if (count === 0) {
        console.log('⚠️  No hay sistemas de calificación seeded');
        process.exit(1);
      }
      
      // Check grading_versions table
      console.log('[3/5] Verificando tabla grading_versions...');
      db.all('PRAGMA table_info(grading_versions)', [], (err, columns) => {
        if (err) {
          console.error('❌ Error:', err.message);
          process.exit(1);
        }
        
        console.log('✓ Columnas de grading_versions:');
        columns.forEach(col => {
          console.log(`  - ${col.name}: ${col.type}`);
        });
        
        const isActiveCol = columns.find(c => c.name === 'is_active');
        console.log(`\n  is_active type: ${isActiveCol?.type || 'NOT FOUND'}`);
        
        if (!isActiveCol) {
          console.error('\n❌ ERROR: Columna is_active no encontrada!');
          process.exit(1);
        }
        
        console.log('\n[4/5] Verificando contenido de grading_versions...');
        
        // Test the actual query from the controller
        const testUserId = 1;
        const query = `SELECT gs.*,
                gv.id as active_version_id,
                gv.min_value, gv.max_value, gv.passing_value, gv.precision,
                gv.owner_type, gv.owner_id
         FROM grading_systems gs
         LEFT JOIN grading_versions gv ON gv.grading_system_id = gs.id
           AND gv.is_active = true
           AND (gv.owner_type = 'system'
                OR (gv.owner_type = 'user' AND gv.owner_id = ?))
         WHERE gs.is_system_seeded = 1
            OR gs.created_by_user_id = ?
         ORDER BY gs.is_system_seeded DESC, gs.name ASC`;
        
        db.all(query, [String(testUserId), testUserId], (err, rows) => {
          if (err) {
            console.error('❌ Error en query:', err.message);
            console.error('Tipo de error:', err.code);
            process.exit(1);
          }
          
          console.log(`✓ Query ejecutada exitosamente`);
          console.log(`✓ Sistemas devueltos: ${rows.length}`);
          
          if (rows.length > 0) {
            console.log('\nPrimer sistema:');
            const first = rows[0];
            console.log(`  id: ${first.id}`);
            console.log(`  name: ${first.name}`);
            console.log(`  code: ${first.code}`);
            console.log(`  active_version_id: ${first.active_version_id}`);
            console.log(`  min_value: ${first.min_value}`);
            console.log(`  max_value: ${first.max_value}`);
            console.log(`  passing_value: ${first.passing_value}`);
          }
          
          console.log('\n[5/5] Verificando tipos de datos...');
          
          // Check if is_active stores are compatible
          db.all('SELECT is_active, typeof(is_active) as type FROM grading_versions LIMIT 3', [], (err, samples) => {
            if (err) {
              console.error('❌ Error:', err.message);
              process.exit(1);
            }
            
            console.log('Muestras de is_active:');
            samples.forEach((s, i) => {
              console.log(`  ${i+1}. Value: ${s.is_active}, Type: ${s.type}`);
            });
            
            console.log('\n═════════════════════════════════════');
            console.log('✅ DIAGNÓSTICO COMPLETADO');
            console.log('═════════════════════════════════════\n');
            console.log('Resumen:');
            console.log(`✓ Tabla grading_systems: ${count} registros`);
            console.log(`✓ Tabla grading_versions: Existe`);
            console.log(`✓ Columna is_active: ${isActiveCol.type}`);
            console.log(`✓ Query devuelve: ${rows.length} sistemas`);
            
            if (rows.length === 0) {
              console.log('\n⚠️  ADVERTENCIA: La query devuelve 0 sistemas');
              console.log('   Esto causará que no aparezcan escalas en la UI');
            } else {
              console.log('\n✅ TODO ESTÁ CORRECTO');
            }
            
            process.exit(0);
          });
        });
      });
    });
  } catch (err) {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  }
})();
