/**
 * Mutation check del traductor de errores de la API de IA.
 *
 *   node scripts/mutacion-ai-errors.js
 *
 * Un mapper de errores es el peor sitio para tener una suite verde y mentirosa.
 * Si NO_MODEL_AVAILABLE responde 200 y el movil cree que todo fue bien, el
 * usuario recibe una respuesta vacia con estado de exito y no hay ningun
 * sintoma hasta que alguien reporta "no me genera nada".
 *
 * Aqui no se prueba el codigo: se rompen las decisiones a proposito y se
 * comprueba que la suite las detecta. Si una mutacion sobrevive, el test que la
 * cubre no existe.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const OBJETIVO = path.join(__dirname, '..', 'services', 'ai', 'contracts', 'aiErrors.js');
const TESTS = path.join(__dirname, '..', 'tests', 'aiErrors.test.js');
// Se normalizan los finales de linea a \n para que los patrones de varias
// lineas no dependan de si el archivo esta guardado con CRLF o LF. Con CRLF, un
// patron escrito con \n no aparece nunca y la mutacion se reporta como
// "obsoleta", que es como paso al intentar mutar el bloque de codigo='INTERNAL_ERROR'.
// Dos copias a proposito: `original` tiene finales de linea normalizados a \n
// para que los patrones de varias lineas no dependan de si el archivo esta
// guardado con CRLF o LF (con CRLF un patron escrito con \n no aparece nunca y la
// mutacion se reporta como obsoleta). `pristino` es la copia intacta y es la que
// se restaura, para no dejar el archivo con los finales de linea cambiados.
const pristino = fs.readFileSync(OBJETIVO, 'utf8');
const original = pristino.replace(/\r\n/g, '\n');

/** Cada mutacion rompe una decision concreta del contrato. */
const MUTACIONES = [
  {
    nombre: 'exhaustion responde 200 OK',
    buscar: "code = 'NO_MODEL_AVAILABLE';",
    replace: "code = 'NO_MODEL_AVAILABLE'; Object.assign(AI_ERRORS.NO_MODEL_AVAILABLE, { status: 200 });",
  },
  {
    nombre: 'NO_MODEL_AVAILABLE pasa a 500',
    buscar: 'NO_MODEL_AVAILABLE: { status: 503,',
    replace: 'NO_MODEL_AVAILABLE: { status: 500,',
  },
  {
    nombre: 'CAPABILITY_UNAVAILABLE pasa a retryable',
    buscar: 'CAPABILITY_UNAVAILABLE: { status: 503, retryable: false }',
    replace: 'CAPABILITY_UNAVAILABLE: { status: 503, retryable: true }',
  },
  {
    nombre: 'NO_MODEL_AVAILABLE deja de ser retryable',
    buscar: 'NO_MODEL_AVAILABLE: { status: 503, retryable: true,',
    replace: 'NO_MODEL_AVAILABLE: { status: 503, retryable: false,',
  },
  {
    nombre: '401 del proveedor se disfraza de sesion expirada',
    buscar: "code = 'INTERNAL_ERROR';\n    logLevel = 'critical';\n    logDetail = `credencial del proveedor rechazada",
    replace: "code = 'UNAUTHENTICATED';\n    logLevel = 'critical';\n    logDetail = `credencial del proveedor rechazada",
    replace: "    code = 'UNAUTHENTICATED';\n    logLevel = 'critical';\n    logDetail = `credencial del proveedor rechazada",
  },
  {
    nombre: '401 sin marcar se atribuye al usuario',
    buscar: "code = 'INTERNAL_ERROR';\n    logLevel = 'critical';\n    logDetail = `401/403 sin marcar",
    replace: "code = 'UNAUTHENTICATED';\n    logLevel = 'critical';\n    logDetail = `401/403 sin marcar",
    replace: "    code = 'UNAUTHENTICATED';\n    logLevel = 'critical';\n    logDetail = `401/403 sin marcar",
  },
  {
    nombre: 'el mensaje del proveedor se filtra al cliente',
    buscar: 'return { status: def.status, body: { error: cuerpo }, logLevel, logDetail };',
    replace: 'cuerpo.detalle = logDetail; return { status: def.status, body: { error: cuerpo }, logLevel, logDetail };',
  },
  {
    nombre: 'se ignora el Retry-After del proveedor',
    buscar: 'retryAfterSec = retryAfterDe(err, RETRY_AFTER_POR_DEFECTO);',
    replace: 'retryAfterSec = RETRY_AFTER_POR_DEFECTO;',
  },
  {
    nombre: 'timeout se traduce como error interno',
    buscar: "code = 'UPSTREAM_TIMEOUT';",
    replace: "code = 'INTERNAL_ERROR';",
  },
  {
    nombre: 'el acceso denegado confirma que el recurso existe',
    buscar: "code = 'NOT_FOUND';\n    logLevel = 'warn';",
    replace: "code = 'ACCESS_DENIED';\n    logLevel = 'warn';",
  },
  {
    nombre: 'un recurso de otro usuario responde 403',
    buscar: 'NOT_FOUND: { status: 404, retryable: false },',
    replace: 'NOT_FOUND: { status: 403, retryable: false },',
  },
  {
    nombre: 'ACCESS_DENIED se traduce a error interno',
    buscar: "} else if (codigo === 'NOT_FOUND' || codigo === 'ACCESS_DENIED') {",
    replace: "} else if (codigo === 'NOT_FOUND') {",
  },
  {
    nombre: 'un codigo publico se reinterpreta como interno',
    buscar: "if (Object.prototype.hasOwnProperty.call(AI_ERRORS, codigo)) {",
    replace: "if (false) {",
  },
  {
    nombre: 'se filtran los intentos fallidos',
    buscar: 'const cuerpo = { code, retryable: def.retryable, requestId: id };',
    replace: 'const cuerpo = { code, retryable: def.retryable, requestId: id, intentos: (err && err.attempts) || undefined };',
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
  const base = correrTests();
  if (base !== 0) {
    console.error(`ABORTO: la suite ya falla sin mutar (${base} fallos). Arregla eso primero.`);
    process.exit(1);
  }
  console.log('Base sin mutar: 0 fallos.\n');

  for (const m of MUTACIONES) {
    const desde = original.indexOf(m.buscar);
    if (desde === -1) {
      console.log(`  ? ${m.nombre} :: el patron ya no existe (mutacion obsoleta, revisar)`);
      sobrevividas += 1;
      continue;
    }
    fs.writeFileSync(
      OBJETIVO,
      original.slice(0, desde) + m.replace + original.slice(desde + m.buscar.length),
      'utf8'
    );
    const fallos = correrTests();
    if (fallos === 0) {
      console.log(`  SOBREVIVIO  ${m.nombre}`);
      sobrevividas += 1;
    } else {
      console.log(`  detectada   ${m.nombre}  (${fallos} test(s))`);
    }
  }
} finally {
  fs.writeFileSync(OBJETIVO, pristino, 'utf8');
}

console.log(
  sobrevividas === 0
    ? `\nOK: las ${MUTACIONES.length} mutaciones fueron detectadas.`
    : `\nFALLO: ${sobrevividas} mutacion(es) sobrevivieron. La suite no cubre esa decision.`
);
process.exit(sobrevividas === 0 ? 0 : 1);