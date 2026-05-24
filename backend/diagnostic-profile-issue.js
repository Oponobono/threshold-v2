#!/usr/bin/env node
/**
 * Script de Diagnóstico para el Problema de "Error Interno del Servidor"
 * en la Actualización del Perfil
 * 
 * Ejecuta:  node diagnostic-profile-issue.js
 */

const { db, initializeDb } = require('./db');
const path = require('path');
const fs = require('fs');

const diagnostic = {
  timestamp: new Date().toISOString(),
  results: {},
  errors: []
};

const addResult = (name, status, details) => {
  diagnostic.results[name] = { status, details };
};

const addError = (name, error) => {
  diagnostic.errors.push({ name, error: error.message || String(error) });
};

(async () => {
  try {
    console.log('🔍 Iniciando diagnóstico...\n');
    
    // Initialize DB
    console.log('[1/6] Inicializando base de datos...');
    await initializeDb();
    addResult('Database Initialization', 'OK', 'Base de datos inicializada correctamente');
    
    // Check users table structure
    console.log('[2/6] Verificando estructura de tabla users...');
    db.all('PRAGMA table_info(users)', [], (err, columns) => {
      if (err) {
        addError('Table Structure Check', err);
      } else {
        const expectedColumns = [
          'id', 'email', 'password_hash', 'name', 'lastname', 'username',
          'major', 'university', 'semester', 'study_goal', 'share_pin',
          'display_name', 'profile_image', 'active_grading_version_id',
          'approval_threshold'
        ];
        
        const existingColumns = new Set(columns.map(c => c.name));
        const missing = expectedColumns.filter(c => !existingColumns.has(c));
        
        if (missing.length === 0) {
          addResult('Table Structure', 'OK', `Todas las ${expectedColumns.length} columnas existen`);
        } else {
          addResult('Table Structure', 'WARNING', `Faltan columnas: ${missing.join(', ')}`);
        }
        
        console.log(`   ✓ Tabla tiene ${columns.length} columnas`);
        if (missing.length > 0) {
          console.log(`   ⚠️  Faltan: ${missing.join(', ')}`);
        }
      }
      
      // Check for existing users
      console.log('[3/6] Verificando usuarios existentes...');
      db.all('SELECT id, email, username FROM users LIMIT 5', [], (err, users) => {
        if (err) {
          addError('Users Check', err);
        } else {
          addResult('Users Check', users.length > 0 ? 'OK' : 'WARNING', 
            `Encontrados ${users.length} usuario(s)`);
          console.log(`   ✓ Usuarios encontrados: ${users.length}`);
          users.forEach(u => {
            console.log(`     - ID: ${u.id}, Email: ${u.email}, Username: ${u.username}`);
          });
        }
        
        // Test update with dummy data
        if (users.length > 0) {
          console.log('[4/6] Probando actualización de perfil...');
          const testUser = users[0];
          const testUsername = `testupdate_${Date.now()}`;
          
          const query = `UPDATE users SET name = ?, lastname = ?, username = ? WHERE id = ?`;
          const values = ['Test', 'Update', testUsername, testUser.id];
          
          db.run(query, values, function(err) {
            if (err) {
              addError('Profile Update Test', err);
              console.log('   ❌ Error en actualización:', err.message);
            } else {
              addResult('Profile Update Test', 'OK', `Actualización exitosa (${this.changes} filas)`);
              console.log(`   ✓ Actualización exitosa`);
            }
            
            // Check indexes
            console.log('[5/6] Verificando índices...');
            db.all(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`, [], (err, indexes) => {
              if (err) {
                addError('Indexes Check', err);
              } else {
                const requiredIndexes = [
                  'idx_users_username_unique',
                  'idx_users_share_pin_unique',
                  'idx_decks_user_created'
                ];
                
                const existingIndexes = new Set(indexes.map(i => i.name));
                const missingIndexes = requiredIndexes.filter(i => !existingIndexes.has(i));
                
                if (missingIndexes.length === 0) {
                  addResult('Indexes', 'OK', 'Todos los índices esperados existen');
                  console.log('   ✓ Índices OK');
                } else {
                  addResult('Indexes', 'WARNING', `Faltan índices: ${missingIndexes.join(', ')}`);
                  console.log(`   ⚠️  Faltan índices: ${missingIndexes.join(', ')}`);
                }
              }
              
              // Summary
              console.log('\n[6/6] Generando reporte...\n');
              console.log('═══════════════════════════════════════');
              console.log('📊 REPORTE DE DIAGNÓSTICO');
              console.log('═══════════════════════════════════════\n');
              
              Object.entries(diagnostic.results).forEach(([name, { status, details }]) => {
                const icon = status === 'OK' ? '✓' : status === 'WARNING' ? '⚠️' : '❌';
                console.log(`${icon} ${name}: ${status}`);
                console.log(`   ${details}\n`);
              });
              
              if (diagnostic.errors.length > 0) {
                console.log('ERRORES DETECTADOS:');
                console.log('─────────────────────────────────────\n');
                diagnostic.errors.forEach(({ name, error }) => {
                  console.log(`❌ ${name}:`);
                  console.log(`   ${error}\n`);
                });
              }
              
              // Save diagnostic report
              const reportPath = path.resolve(__dirname, 'diagnostic-report.json');
              fs.writeFileSync(reportPath, JSON.stringify(diagnostic, null, 2));
              console.log(`\n📁 Reporte guardado en: ${reportPath}`);
              console.log('\nℹ️  Si hay errores, comparte el contenido de diagnostic-report.json');
              
              process.exit(diagnostic.errors.length > 0 ? 1 : 0);
            });
          });
        } else {
          console.log('[4/6] Saltando prueba de actualización (no hay usuarios)');
          process.exit(1);
        }
      });
    });
  } catch (err) {
    console.error('❌ Error fatal:', err);
    diagnostic.errors.push({ name: 'Fatal Error', error: err.message });
    process.exit(1);
  }
})();
