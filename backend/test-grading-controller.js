#!/usr/bin/env node
/**
 * Test del controlador getGradingSystems con request simulado
 */

const { db, initializeDb } = require('./db');

(async () => {
  try {
    await initializeDb();
    
    console.log('Simulando request al controlador getGradingSystems...\n');
    
    // Simular el middleware de autenticación
    const mockReq = {
      user: { id: 1 }  // Usuario autenticado
    };
    
    const mockRes = {
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
    
    // Copiar el código exacto del controlador
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
    
    // Ejecutar
    getGradingSystems(mockReq, mockRes);
    
    // Esperar a que se ejecute la callback
    setTimeout(() => {
      console.log('Status Code:', mockRes.statusCode);
      console.log('Response Data:', JSON.stringify(mockRes.data, null, 2));
      
      if (mockRes.statusCode === 200 && mockRes.data.systems) {
        console.log('\n✅ RESPUESTA CORRECTA');
        console.log(`Sistemas devueltos: ${mockRes.data.systems.length}`);
        
        if (mockRes.data.systems.length > 0) {
          console.log('\nPrimer sistema:');
          const sys = mockRes.data.systems[0];
          console.log(JSON.stringify(sys, null, 2));
        }
      } else {
        console.log('\n❌ ERROR EN RESPUESTA');
      }
      
      process.exit(0);
    }, 500);
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
