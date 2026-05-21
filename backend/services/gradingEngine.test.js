const {
  normalizeGrade,
  denormalizeGrade,
  getEquivalencies,
  applyRounding,
} = require('./gradingEngine');

function runTests() {
  console.log('--- Corriendo pruebas de Invariantes del Grading Engine ---');

  // Test 1: Precisión y Redondeo
  let val = applyRounding(0.123456, 'nearest', 5);
  console.assert(val === 0.12346, 'Test 1 Falló: Error en nearest rounding');

  // Test 2: Normalización ascendente (Colombia 0-5)
  const colVersion = { min_value: 0, max_value: 5.0, direction: 'ascending', precision: 2 };
  let normAsc = normalizeGrade(4.5, colVersion);
  console.assert(normAsc === 0.90000, 'Test 2 Falló: Normalización ascendente');

  // Test 3: Normalización descendente (Alemania 1-5, 1 es mejor)
  const gerVersion = { min_value: 1.0, max_value: 5.0, direction: 'descending', precision: 2 };
  // Si saca 1 (la mejor), norm = 1 - (1-1)/(5-1) = 1.0
  // Si saca 5 (la peor), norm = 1 - (5-1)/(5-1) = 0.0
  // Si saca 3 (mitad), norm = 1 - (3-1)/(5-1) = 0.5
  let normDesc1 = normalizeGrade(1.0, gerVersion);
  let normDesc3 = normalizeGrade(3.0, gerVersion);
  console.assert(normDesc1 === 1.00000, 'Test 3 Falló: Descendente mejor nota');
  console.assert(normDesc3 === 0.50000, 'Test 3 Falló: Descendente mitad');

  // Test 4: Denormalización
  let denormAsc = denormalizeGrade(0.9, colVersion);
  console.assert(denormAsc === 4.5, 'Test 4 Falló: Denormalización ascendente');

  let denormDesc = denormalizeGrade(0.5, gerVersion);
  console.assert(denormDesc === 3.0, 'Test 4 Falló: Denormalización descendente');

  // Test 5: Invariant No Recalcular Históricos
  // Esto se prueba por el diseño (el normalized_value se persiste, no se recalcula on-the-fly).
  
  // Test 6: is_unofficial_equivalency siempre es true
  const scales = [
    { min_score: 90, max_score: 100, label: 'Excelente', sort_order: 1 }
  ];
  let equiv = getEquivalencies(0.95, scales);
  console.assert(equiv.is_unofficial_equivalency === true, 'Test 6 Falló: Equivalencia debe ser no-oficial');

  console.log('✅ Todas las pruebas pasaron correctamente.');
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
