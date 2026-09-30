// Detecta mojibate que la inversion NO puede reparar.
//
// Uso: node scripts/detectar-residuo.js <archivo...>
//
// Hay dos clases de dano:
//  1. Reversible: los bytes originales siguen ahi, solo estan reinterpretados.
//     "estÃ¡" -> "esta". fix-encoding.js lo resuelve solo.
//  2. Irreversible: al escribir el archivo, un byte de cp1252 sin equivalente
//     (0x81, 0x8D, 0x8F, 0x90, 0x9D) se perdio. "JAMÁS" -> "JAMÃS" y el acento
//     ya no esta en ningun lado: no hay forma de recuperarlo por inversion.
//
// Este script lista los casos de la clase 2 para repararlos a mano.
const fs = require('fs');

// Letras que cp1252 coloca donde deberia haber un caracter acentuado, y que por
// si solas ya delatan texto doblemente codificado. Se excluyen las letras
// acentuadas reales (Ñ, É, Ó...) porque un texto bien escrito las usa igual.
const SOSPECHOSOS = new Set(['\u00c3', '\u00c2', '\u00e2', '\u00c4', '\u00c5', '\u00d0']);

for (const ruta of process.argv.slice(2)) {
  const lineas = fs.readFileSync(ruta, 'utf8').split(/\r?\n/);
  let total = 0;
  for (let i = 0; i < lineas.length; i++) {
    const chars = Array.from(lineas[i]);
    for (let c = 0; c < chars.length; c++) {
      if (!SOSPECHOSOS.has(chars[c])) continue;
      // Irreversible cuando el caracter siguiente es ASCII: el byte de
      // continuacion se perdio. Si fuera reversible, el siguiente seria otro
      // caracter no ASCII y fix-encoding ya lo habria arreglo.
      const siguiente = chars[c + 1];
      if (siguiente === undefined || siguiente.codePointAt(0) < 128) {
        total++;
        const desde = Math.max(0, c - 22);
        const fragmento = chars.slice(desde, c + 22).join('');
        console.log(`${ruta}:${i + 1}: ...${fragmento}...`);
      }
    }
  }
  if (total) console.log(`  -> ${ruta}: ${total} residuo(s) irreversible(s)\n`);
}
