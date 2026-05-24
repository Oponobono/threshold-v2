// Utilidades para migrar columnas en ambas BDs

const migrateColumnsSqlite = (db, tableName, columns) => {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        console.error(`Error verificando columnas de ${tableName}:`, err.message);
        resolve();
        return;
      }

      const existingColumns = new Set(rows.map((row) => row.name));
      const missingColumns = columns.filter((col) => !existingColumns.has(col.name));

      if (missingColumns.length === 0) {
        resolve();
        return;
      }

      let migrated = 0;
      missingColumns.forEach((column) => {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`, (alterErr) => {
          if (alterErr) {
            console.error(`Error agregando columna ${column.name} en ${tableName}:`, alterErr.message);
          } else {
            console.log(`✓ Columna agregada en ${tableName}: ${column.name}`);
          }
          migrated++;
          if (migrated === missingColumns.length) {
            resolve();
          }
        });
      });
    });
  });
};

const migrateColumnsPostgres = async (pool, tableName, columns) => {
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [tableName]
    );
    const existingColumns = new Set(result.rows.map((r) => r.column_name));
    const missingColumns = columns.filter((col) => !existingColumns.has(col.name));

    if (missingColumns.length === 0) return;

    for (const column of missingColumns) {
      const hasNotNull = /\bNOT\s+NULL\b/i.test(column.type);
      const safeType = hasNotNull
        ? column.type.replace(/\s+NOT\s+NULL\b/i, '')
        : column.type;

      try {
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${safeType}`);
        console.log(`✓ Columna agregada en ${tableName}: ${column.name}${hasNotNull ? ' (sin NOT NULL)' : ''}`);

        // Si originalmente tenía NOT NULL, intentamos aplicar la restricción
        if (hasNotNull) {
          try {
            await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET NOT NULL`);
            console.log(`  → Restricción NOT NULL aplicada en ${tableName}.${column.name}`);
          } catch (setNullErr) {
            console.warn(`  ⚠️ No se pudo aplicar NOT NULL en ${tableName}.${column.name}: ${setNullErr.message}. Se queda como nullable.`);
          }
        }
      } catch (addErr) {
        console.error(`Error agregando columna ${column.name} en ${tableName}:`, addErr.message);
      }
    }
  } catch (err) {
    console.error(`Error migrando columnas en ${tableName}:`, err.message);
  }
};

module.exports = {
  migrateColumnsSqlite,
  migrateColumnsPostgres,
};
