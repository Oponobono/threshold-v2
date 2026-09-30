// Repara el mojibate de los archivos del catalogo de modelos.
//
// Uso: node scripts/fix-encoding.js <archivo...>
//
// Que estaba pasando
// ------------------
// Al escribir archivos desde una consola Windows, los bytes UTF-8 de los
// caracteres no ASCII se interpretaron como cp1252 y se volvieron a guardar
// como UTF-8. El resultado quedo doblemente codificado: donde deberia decir
// "esta" aparece "estÃ¡" (U+00C3 U+00A1), y donde deberia haber una flecha
// aparece "â†’" (U+00E2 U+2020 U+2019).
//
// Los bytes de cp1252 que forman la palabra original siguen ahi, asi que el
// arreglo es simetrico y no hay que adivinar: se toman los bytes, se decodifican
// como UTF-8 y se obtiene el caracter correcto.
//
// Que NO hace, a proposito
// ------------------------
// No transliterar a ASCII. Los archivos mezclan texto corrupto con texto
// correcto: "titulo" con U+00ED estaba bien escrito y debe seguir con su
// acento, y un mensaje al usuario sin tilde se nota. Como los bytes de un
// caracter acentuado correcto NO forman una secuencia UTF-8 valida al
// agruparlos, la inversion los deja intactos por sola.
//
// Idempotente: correrlo dos veces no cambia nada la segunda vez.
const fs = require('fs');

// cp1252 usa 0x80..0x9F para signos tipograficos en lugar de los controles C1
// de Latin-1. Son los que aparecen en el mojibate de las flechas y de las
// lineas de caja: U+2192 son los bytes E2 86 92, que en cp1252 se leen como
// "a" cirflejo, dagger y comilla simple tipografica.
const CP1252_80_9F = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};
const REVERSA_CP1252 = new Map();
for (const [byte, char] of Object.entries(CP1252_80_9F)) {
  REVERSA_CP1252.set(char, Number(byte));
}

/** Byte cp1252 que representa este caracter, o null si no existe. */
function byteDeCp1252(ch) {
  const code = ch.codePointAt(0);
  if (code < 0x80) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  const byte = REVERSA_CP1252.get(code);
  if (byte !== undefined) return byte;
  // 0x81, 0x8D, 0x8F, 0x90 y 0x9D no tienen equivalente en cp1252, pero si se
  // conservaron como controles C1 de Latin-1. El byte sigue ahi y tambien es
  // recuperable: sin esto, "JAMÁS" queda como "JAMÃ<SUB>S" para siempre.
  if (code >= 0x80 && code <= 0x9f) return code;
  return null;
}

/** Cuantos bytes sigue a un byte guia UTF-8, o 0 si no guia una secuencia. */
function bytesDeSecuencia(byte) {
  if (byte >= 0xc2 && byte <= 0xdf) return 1;
  if (byte >= 0xe0 && byte <= 0xef) return 2;
  if (byte >= 0xf0 && byte <= 0xf4) return 3;
  return 0;
}

function deshacer(texto) {
  const salida = [];
  for (let i = 0; i < texto.length; i++) {
    const byte = byteDeCp1252(texto[i]);
    if (byte === null || byte < 0x80) { salida.push(texto[i]); continue; }

    // Se agrupan EXACTAMENTE los bytes que la secuencia necesita, segun lo que
    // dicta su byte guia. Agrupar de mas rompe los runs largos: una fila de
    // lineas de caja es "â”€" repetido, y al cruzar dos de ellas el grupo
    // queda mal formado y el arreglo necesitaria varias pasadas.
    const cuantos = bytesDeSecuencia(byte);
    if (cuantos === 0) { salida.push(texto[i]); continue; }

    const bytes = [byte];
    let j = i + 1;
    while (j < texto.length && bytes.length <= cuantos) {
      const b = byteDeCp1252(texto[j]);
      if (b === null) break;
      bytes.push(b);
      j++;
    }
    if (bytes.length !== cuantos + 1) { salida.push(texto[i]); continue; }

    const decodificado = Buffer.from(bytes).toString('utf8');
    // Solo se acepta si al decodificar se recuperan exactamente esos bytes.
    // Un caracter acentuado bien escrito no guia ninguna secuencia, asi que
    // se conserva con su acento.
    const esValido = decodificado.length > 0
      && !decodificado.includes('�')
      && Buffer.from(decodificado, 'utf8').equals(Buffer.from(bytes));

    if (esValido) {
      salida.push(decodificado);
      i = j - 1;
    } else {
      salida.push(texto[i]);
    }
  }
  return salida.join('');
}

let tocados = 0;
for (const ruta of process.argv.slice(2)) {
  const antes = fs.readFileSync(ruta, 'utf8');
  const despues = deshacer(antes);
  if (antes === despues) continue;
  fs.writeFileSync(ruta, despues, 'utf8');
  console.log('reparado:', ruta);
  tocados++;
}
console.log(tocados === 0 ? 'sin cambios' : tocados + ' archivo(s) reparado(s)');
