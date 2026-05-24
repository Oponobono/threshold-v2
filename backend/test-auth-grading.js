#!/usr/bin/env node
/**
 * Test del endpoint /api/grading-systems sin y con autenticación
 */

const http = require('http');
const { db, initializeDb } = require('./db');
const { authenticateToken } = require('./middlewares/authMiddleware');
const jwt = require('jsonwebtoken');
const secrets = require('./config/secrets');

(async () => {
  try {
    await initializeDb();
    
    console.log('Testeando /api/grading-systems...\n');
    
    // Crear un token válido
    const userId = 1;
    const email = 'user@example.com';
    const validToken = jwt.sign({ id: userId, email }, secrets.JWT_SECRET, { expiresIn: '30d' });
    
    console.log(`Token válido generado: ${validToken.substring(0, 30)}...`);
    console.log(`UserId en token: ${userId}\n`);
    
    // Test 1: Sin token
    console.log('[Test 1] Petición SIN token');
    const mockReq1 = {
      headers: {}
    };
    const mockRes1 = {
      statusCode: 200,
      data: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
      }
    };
    
    authenticateToken(mockReq1, mockRes1, () => {
      console.log(`  → Status: ${mockRes1.statusCode}`);
      console.log(`  → Response: ${JSON.stringify(mockRes1.data)}\n`);
    });
    
    // Test 2: Con token válido
    console.log('[Test 2] Petición CON token válido');
    const mockReq2 = {
      headers: {
        'authorization': `Bearer ${validToken}`
      }
    };
    const mockRes2 = {
      statusCode: 200,
      data: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
      }
    };
    
    let middlewarePassed = false;
    authenticateToken(mockReq2, mockRes2, () => {
      middlewarePassed = true;
      console.log(`  ✓ Middleware pasó!`);
      console.log(`  → req.user: ${JSON.stringify(mockReq2.user)}`);
    });
    
    if (!middlewarePassed) {
      console.log(`  → Status: ${mockRes2.statusCode}`);
      console.log(`  → Response: ${JSON.stringify(mockRes2.data)}`);
    }
    
    // Test 3: Ahora ejecutar el controlador con el request autenticado
    if (middlewarePassed) {
      console.log('\n[Test 3] Ejecutando getGradingSystems con req autenticado');
      
      const getGradingSystems = (req, res) => {
        const userId = req.user.id;
        db.all(
          `SELECT gs.*,
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
           ORDER BY gs.is_system_seeded DESC, gs.name ASC`,
          [String(userId), userId],
          (err, rows) => {
            if (err) {
              console.error('[GradingController] Error fetching systems:', err.message);
              return res.status(500).json({ error: 'Error obteniendo sistemas de calificación.' });
            }
            res.json({ systems: rows });
          }
        );
      };
      
      const mockRes3 = {
        statusCode: 200,
        data: null,
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.data = data;
        }
      };
      
      getGradingSystems(mockReq2, mockRes3);
      
      setTimeout(() => {
        console.log(`  → Status: ${mockRes3.statusCode}`);
        if (mockRes3.statusCode === 200) {
          console.log(`  → Systems devueltos: ${mockRes3.data.systems.length}`);
        } else {
          console.log(`  → Error: ${JSON.stringify(mockRes3.data)}`);
        }
      }, 500);
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
