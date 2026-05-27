// Seeders para los sistemas de calificación iniciales (Seeded Systems)

const seededSystems = [
  {
    system: {
      code: '0_100_PCT',
      name: 'Porcentaje (0-100%)',
      type: 'numeric',
      mode: 'continuous',
      direction: 'ascending',
      country_code: 'GLOBAL',
      is_system_seeded: 1
    },
    version: {
      owner_type: 'system',
      min_value: 0,
      max_value: 100,
      passing_value: 60,
      precision: 2,
      is_active: 1
    },
    scales: [
      { min_score: 90, max_score: 100, label: 'Excelente', gpa_equivalent: 4.0, color: '#4CAF50', sort_order: 1, is_passing: 1 },
      { min_score: 80, max_score: 89.99, label: 'Muy Bueno', gpa_equivalent: 3.0, color: '#8BC34A', sort_order: 2, is_passing: 1 },
      { min_score: 70, max_score: 79.99, label: 'Bueno', gpa_equivalent: 2.0, color: '#CDDC39', sort_order: 3, is_passing: 1 },
      { min_score: 60, max_score: 69.99, label: 'Aceptable', gpa_equivalent: 1.0, color: '#FFC107', sort_order: 4, is_passing: 1 },
      { min_score: 0, max_score: 59.99, label: 'Reprobado', gpa_equivalent: 0.0, color: '#F44336', sort_order: 5, is_passing: 0 }
    ]
  },
  {
    system: {
      code: 'US_GPA_4',
      name: 'GPA (Escala 4.0)',
      type: 'gpa',
      mode: 'continuous',
      direction: 'ascending',
      country_code: 'US',
      is_system_seeded: 1
    },
    version: {
      owner_type: 'system',
      min_value: 0,
      max_value: 4.0,
      passing_value: 2.0,
      precision: 2,
      is_active: 1
    },
    scales: [
      { min_score: 3.7, max_score: 4.0, label: 'A', gpa_equivalent: 4.0, color: '#4CAF50', sort_order: 1, is_passing: 1 },
      { min_score: 3.0, max_score: 3.69, label: 'B', gpa_equivalent: 3.0, color: '#8BC34A', sort_order: 2, is_passing: 1 },
      { min_score: 2.0, max_score: 2.99, label: 'C', gpa_equivalent: 2.0, color: '#FFC107', sort_order: 3, is_passing: 1 },
      { min_score: 1.0, max_score: 1.99, label: 'D', gpa_equivalent: 1.0, color: '#FF9800', sort_order: 4, is_passing: 0 },
      { min_score: 0.0, max_score: 0.99, label: 'F', gpa_equivalent: 0.0, color: '#F44336', sort_order: 5, is_passing: 0 }
    ]
  },
  {
    system: {
      code: 'US_LETTER',
      name: 'EE.UU. – Escala de Letras (A-F)',
      type: 'letter',
      mode: 'discrete',
      direction: 'ascending',
      country_code: 'US',
      is_system_seeded: 1
    },
    version: {
      owner_type: 'system',
      min_value: 0,
      max_value: 100,
      passing_value: 60,
      precision: 0,
      is_active: 1
    },
    scales: [
      { min_score: 93, max_score: 100, label: 'A', gpa_equivalent: 4.0, color: '#34C759', sort_order: 1, is_passing: 1 },
      { min_score: 90, max_score: 92, label: 'A-', gpa_equivalent: 3.7, color: '#34C759', sort_order: 2, is_passing: 1 },
      { min_score: 87, max_score: 89, label: 'B+', gpa_equivalent: 3.3, color: '#5AC8FA', sort_order: 3, is_passing: 1 },
      { min_score: 83, max_score: 86, label: 'B', gpa_equivalent: 3.0, color: '#5AC8FA', sort_order: 4, is_passing: 1 },
      { min_score: 80, max_score: 82, label: 'B-', gpa_equivalent: 2.7, color: '#5AC8FA', sort_order: 5, is_passing: 1 },
      { min_score: 77, max_score: 79, label: 'C+', gpa_equivalent: 2.3, color: '#FF9500', sort_order: 6, is_passing: 1 },
      { min_score: 73, max_score: 76, label: 'C', gpa_equivalent: 2.0, color: '#FF9500', sort_order: 7, is_passing: 1 },
      { min_score: 70, max_score: 72, label: 'C-', gpa_equivalent: 1.7, color: '#FF9500', sort_order: 8, is_passing: 1 },
      { min_score: 67, max_score: 69, label: 'D+', gpa_equivalent: 1.3, color: '#FF2D55', sort_order: 9, is_passing: 1 },
      { min_score: 63, max_score: 66, label: 'D', gpa_equivalent: 1.0, color: '#FF2D55', sort_order: 10, is_passing: 1 },
      { min_score: 60, max_score: 62, label: 'D-', gpa_equivalent: 0.7, color: '#FF2D55', sort_order: 11, is_passing: 1 },
      { min_score: 0, max_score: 59, label: 'F', gpa_equivalent: 0.0, color: '#8B0000', sort_order: 12, is_passing: 0 }
    ]
  },
  {
    system: {
      code: 'COL_0_5',
      name: 'Colombia (0.0 - 5.0)',
      type: 'numeric',
      mode: 'continuous',
      direction: 'ascending',
      country_code: 'CO',
      is_system_seeded: 1
    },
    version: {
      owner_type: 'system',
      min_value: 0,
      max_value: 5.0,
      passing_value: 3.0,
      precision: 2,
      is_active: 1
    },
    scales: [
      { min_score: 4.6, max_score: 5.0, label: 'Excelente', gpa_equivalent: 4.0, color: '#4CAF50', sort_order: 1, is_passing: 1 },
      { min_score: 4.0, max_score: 4.59, label: 'Sobresaliente', gpa_equivalent: 3.5, color: '#8BC34A', sort_order: 2, is_passing: 1 },
      { min_score: 3.0, max_score: 3.99, label: 'Aceptable', gpa_equivalent: 2.5, color: '#FFC107', sort_order: 3, is_passing: 1 },
      { min_score: 0.0, max_score: 2.99, label: 'Insuficiente', gpa_equivalent: 0.0, color: '#F44336', sort_order: 4, is_passing: 0 }
    ]
  },
  {
    system: {
      code: 'ES_0_10',
      name: 'España (0-10)',
      type: 'numeric',
      mode: 'continuous',
      direction: 'ascending',
      country_code: 'ES',
      is_system_seeded: 1
    },
    version: {
      owner_type: 'system',
      min_value: 0,
      max_value: 10.0,
      passing_value: 5.0,
      precision: 2,
      is_active: 1
    },
    scales: [
      { min_score: 9.0, max_score: 10.0, label: 'Sobresaliente', gpa_equivalent: 4.0, color: '#4CAF50', sort_order: 1, is_passing: 1 },
      { min_score: 7.0, max_score: 8.99, label: 'Notable', gpa_equivalent: 3.0, color: '#8BC34A', sort_order: 2, is_passing: 1 },
      { min_score: 5.0, max_score: 6.99, label: 'Bien/Suficiente', gpa_equivalent: 2.0, color: '#FFC107', sort_order: 3, is_passing: 1 },
      { min_score: 0.0, max_score: 4.99, label: 'Suspenso', gpa_equivalent: 0.0, color: '#F44336', sort_order: 4, is_passing: 0 }
    ]
  }
];

const seedGradingSystemsSqlite = async (db) => {
  for (const data of seededSystems) {
    await new Promise((resolve) => {
      // Check if system already exists by code
      db.get('SELECT id FROM grading_systems WHERE code = ?', [data.system.code], (err, row) => {
        if (err) {
          console.error('Error checking system:', err);
          return resolve();
        }
        if (row) {
          return resolve(); // Already seeded
        }

        // Insert system
        db.run(
          `INSERT INTO grading_systems (code, name, type, mode, direction, country_code, is_system_seeded)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [data.system.code, data.system.name, data.system.type, data.system.mode, data.system.direction, data.system.country_code, data.system.is_system_seeded],
          function (err) {
            if (err) {
              console.error('Error inserting system:', err);
              return resolve();
            }
            const systemId = this.lastID;

            // Insert version
            db.run(
              `INSERT INTO grading_versions (grading_system_id, owner_type, min_value, max_value, passing_value, precision, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [systemId, data.version.owner_type, data.version.min_value, data.version.max_value, data.version.passing_value, data.version.precision, data.version.is_active],
              function (err) {
                if (err) {
                  console.error('Error inserting version:', err);
                  return resolve();
                }
                const versionId = this.lastID;

                // Insert scales
                let scalesProcessed = 0;
                for (const scale of data.scales) {
                  db.run(
                    `INSERT INTO grading_scales (grading_version_id, min_score, max_score, label, gpa_equivalent, color, sort_order, is_passing)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [versionId, scale.min_score, scale.max_score, scale.label, scale.gpa_equivalent, scale.color, scale.sort_order, scale.is_passing],
                    (err) => {
                      if (err) console.error('Error inserting scale:', err);
                      scalesProcessed++;
                      if (scalesProcessed === data.scales.length) resolve();
                    }
                  );
                }
                if (data.scales.length === 0) resolve();
              }
            );
          }
        );
      });
    });
  }
  console.log('✅ Base de datos SQLite Seeded con Grading Systems.');
};

const seedGradingSystemsPostgres = async (pool) => {
  for (const data of seededSystems) {
    try {
      // Check if already seeded
      const { rows } = await pool.query(
        'SELECT id FROM grading_systems WHERE code = $1',
        [data.system.code]
      );
      if (rows.length > 0) continue;

      // Insert system
      const sysResult = await pool.query(
        `INSERT INTO grading_systems (code, name, type, mode, direction, country_code, is_system_seeded)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [data.system.code, data.system.name, data.system.type, data.system.mode,
         data.system.direction, data.system.country_code, data.system.is_system_seeded]
      );
      const systemId = sysResult.rows[0].id;

      // Insert version
      const verResult = await pool.query(
        `INSERT INTO grading_versions (grading_system_id, owner_type, min_value, max_value, passing_value, precision, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [systemId, data.version.owner_type, data.version.min_value, data.version.max_value,
         data.version.passing_value, data.version.precision, data.version.is_active]
      );
      const versionId = verResult.rows[0].id;

      // Insert scales
      for (const scale of data.scales) {
        await pool.query(
          `INSERT INTO grading_scales (grading_version_id, min_score, max_score, label, gpa_equivalent, color, sort_order, is_passing)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [versionId, scale.min_score, scale.max_score, scale.label,
           scale.gpa_equivalent, scale.color, scale.sort_order, scale.is_passing]
        );
      }
    } catch (err) {
      console.error(`[Seeder] Error seeding ${data.system.code}:`, err.message);
    }
  }
  console.log('✅ Base de datos PostgreSQL Seeded con Grading Systems.');
};

module.exports = { seedGradingSystemsSqlite, seedGradingSystemsPostgres };
