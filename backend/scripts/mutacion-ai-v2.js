/**
 * Mutation check del contrato de v2.
 *
 *   node scripts/mutacion-ai-v2.js
 *
 * Lo que protege
 * --------------
 * Las tres cosas que un handler de v2 puede hacer mal sin que se note en una
 * prueba del camino bueno:
 *
 *  1. Validar el cuerpo dos veces o no validarlo. Si `validarChat` deja de
 *     devolver ok:false, los cuerpos basura llegan al proveedor: 401/429 de más
 *     gastados y, peor, contenido de usuario enviado sin comprobar.
 *  2. Emitir un codigo que no existe en AI_ERRORS. sendAiError lo acepta como
 *     string: el cliente recibe 500 con un codigo inventado y no puede decidir
 *     si reintenta. Esto no lo detecta ningun test que mire un camino bueno.
 *  3. Montar el router sin cuota. Un router v2 sin aiLimiter es un endpoint de
 *     pago sin limite, y se ve igual desde fuera si todo lo demas va bien.
 *
 * El punto 3 es el mismo motivo por el que el mutador de rate-limit existe:
 * una proteccion ausente es indistinguible de una proteccion que funciona.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const BASE = path.join(__dirname, '..');
const ARCHIVOS = {
  schema: path.join(BASE, 'services', 'ai', 'contracts', 'aiV2Schema.js'),
  router: path.join(BASE, 'routes', 'aiV2.js'),
  errores: path.join(BASE, 'services', 'ai', 'contracts', 'aiErrors.js'),
};
const TESTS = path.join(BASE, 'tests', 'aiV2.test.js');

const originales = {};
for (const [clave, archivo] of Object.entries(ARCHIVOS)) originales[clave] = fs.readFileSync(archivo, 'utf8');

const MUTACIONES = [
  {
    nombre: 'la validacion acepta cualquier cuerpo',
    archivo: 'schema',
    buscar: "if (!Array.isArray(messages)) {",
    replace: "if (false) {",
  },
  {
    nombre: 'la validacion deja pasar un array de mensajes vacio',
    archivo: 'schema',
    buscar: "if (messages.length === 0) {",
    replace: "if (false) {",
  },
  {
    nombre: 'la validacion deja pasar un cuerpo sin mensaje de usuario',
    archivo: 'schema',
    buscar: "if (!salida.some((m) => m.role === 'user')) {",
    replace: "if (false) {",
  },
  {
    nombre: 'la validacion acepta un role cualquiera',
    archivo: 'schema',
    buscar: "if (!rolesValidos.has(m.role)) {",
    replace: "if (false) {",
  },
  {
    nombre: 'la validacion acepta contenido que no es texto',
    archivo: 'schema',
    buscar: "if (typeof m.content !== 'string') {",
    replace: "if (false) {",
  },
  {
    nombre: 'la validacion deja pasar un contexto gigante',
    archivo: 'schema',
    buscar: "if (context.length > LIMITE_CHARS_CONTEXTO) {",
    replace: "if (false) {",
  },
  {
    nombre: 'el router de v2 se monta sin cuota por usuario',
    archivo: 'router',
    buscar: 'router.use(aiLimiter);',
    replace: '// router.use(aiLimiter);',
  },
  {
    // Quita el passthrough de codigos publicos: un limitador que dice
    // RATE_LIMITED volveria a disfrazarse de error interno y el 429 saldría
    // como 500.
    nombre: 'sendAiError pierde el passthrough de codigos publicos',
    archivo: 'errores',
    buscar: 'if (Object.prototype.hasOwnProperty.call(AI_ERRORS, codigo)) {',
    replace: 'if (false) {',
  },
  {
    // Convierte un codigo desconocido en 500 silencioso en vez de traducirlo.
    // Un handler que pase un string inventado debe ver un INTERNAL_ERROR con el
    // codigo del contrato, no el string tal cual.
    nombre: 'un codigo desconocido se filtra tal cual al cliente',
    archivo: 'errores',
    buscar: "if (Object.prototype.hasOwnProperty.call(AI_ERRORS, codigo)) {",
    replace: "if (true) {",
  },
  {
    // ESTA ES LA MUTACION IMPORTANTE. Si el schema deja de rechazar el control
    // de modelo, el movil puede elegir el modelo y los parametros de
    // generacion. El ranking del registry deja de ser la unica fuente de
    // decision y el contrato "el movil pide capacidad, nunca un modelo" se
    // rompe sin que ninguna prueba de camino bueno se entere: todo sigue
    // dando 200.
    nombre: 'el cliente puede elegir modelo (el movil pide capacidad, no modelo)',
    archivo: 'schema',
    buscar: 'const intruso = buscarControlDeModelo(body);',
    replace: 'const intruso = null;',
  },
  {
    nombre: 'el cliente puede mandar temperature',
    archivo: 'schema',
    buscar: "if (body[clave] !== undefined) return clave;",
    replace: "if (false) return clave;",
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

function restaurar() {
  for (const [clave, archivo] of Object.entries(ARCHIVOS)) fs.writeFileSync(archivo, originales[clave], 'utf8');
}

let sobrevividas = 0;
try {
  if (correrTests() !== 0) {
    console.error('ABORTO: la suite ya falla sin mutar. Arregla eso primero.');
    restaurar();
    process.exit(1);
  }
  console.log('Base sin mutar: 0 fallos.\n');

  for (const m of MUTACIONES) {
    const archivo = ARCHIVOS[m.archivo];
    const original = originales[m.archivo];
    const desde = original.indexOf(m.buscar);

    if (desde === -1) {
      console.log(`  ? ${m.nombre} :: el patron ya no existe (mutacion obsoleta)`);
      sobrevividas += 1;
      continue;
    }

    fs.writeFileSync(
      archivo,
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

    fs.writeFileSync(archivo, original, 'utf8');
  }
} finally {
  restaurar();
}

console.log(
  sobrevividas === 0
    ? `\nOK: las ${MUTACIONES.length} mutaciones fueron detectadas.`
    : `\nFALLO: ${sobrevividas} mutacion(es) sobrevivieron.`
);
process.exit(sobrevividas === 0 ? 0 : 1);