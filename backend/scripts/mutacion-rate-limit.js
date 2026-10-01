/**
 * Mutation check del montaje del limitador de cuota de IA.
 *
 *   node scripts/mutacion-rate-limit.js
 *
 * Un limitador que nadie monta es codigo que parece proteger y no protege. Es
 * la forma de fallo mas silenciosa que hay en un rate limiter, porque todo lo
 * que se puede observar desde fuera sigue igual: las rutas existen, el auth
 * funciona, los tests de superficie pasan. Solo desaparece la proteccion.
 *
 * Por eso la prueba de wiring tiene que ser de COMPORTAMIENTO (agotar la cuota
 * sobre una ruta real) y no de introspeccion (mirar si hay una capa en el
 * stack). Si fuera introspeccion, bastaria con renombrar el limitador para que
 * la suite dejara de notar que falta.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RUTAS = path.join(__dirname, '..', 'routes', 'ai.js');
const TESTS = path.join(__dirname, '..', 'tests', 'aiRateLimit.test.js');
const original = fs.readFileSync(RUTAS, 'utf8');

const MUTACIONES = [
  {
    nombre: 'routes/ai.js deja de montar el limitador',
    buscar: 'router.use(aiLimiter);',
    replace: '// router.use(aiLimiter);',
  },
  {
    nombre: 'el limitador se monta despues de las rutas',
    buscar: 'router.use(aiLimiter);',
    replace: '',
  },
];

function correrTests() {
  try {
    execFileSync(process.execPath, ['--test', TESTS], { stdio: 'pipe' });
    return 0;
  } catch (e) {
    const salida = `${e.stdout || ''}${e.stderr || ''}`;
    const m = salida.match(/^. fail (\d+)/m);
    return m ? Number(m[1]) : 1;
  }
}

let sobrevividas = 0;
try {
  if (correrTests() !== 0) {
    console.error('ABORTO: la suite ya falla sin mutar. Arregla eso primero.');
    process.exit(1);
  }
  console.log('Base sin mutar: 0 fallos.\n');

  for (const m of MUTACIONES) {
    const desde = original.indexOf(m.buscar);
    if (desde === -1) {
      console.log(`  ? ${m.nombre} :: el patron ya no existe (mutacion obsoleta)`);
      sobrevividas += 1;
      continue;
    }
    fs.writeFileSync(RUTAS, original.slice(0, desde) + m.replace + original.slice(desde + m.buscar.length), 'utf8');
const fallos = correrTests();
    if (fallos === 0) {
      console.log(`  SOBREVIVIO  ${m.nombre}`);
      sobrevividas += 1;
    } else {
      console.log(`  detectada   ${m.nombre}  (${fallos} test(s))`);
    }
  }
} finally {
  fs.writeFileSync(RUTAS, original, 'utf8');
}

console.log(
  sobrevividas === 0
    ? `\nOK: las ${MUTACIONES.length} mutaciones fueron detectadas.`
    : `\nFALLO: ${sobrevividas} mutacion(es) sobrevivieron. La cuota no esta protegida.`
);
process.exit(sobrevividas === 0 ? 0 : 1);