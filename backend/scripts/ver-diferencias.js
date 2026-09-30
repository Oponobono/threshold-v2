// Compara, linea por linea, el texto de un archivo antes y despues de repararlo,
// distinguiendo lo que cambio de verdad de lo que solo se ve distinto en consola.
// Uso: node scripts/ver-diferencias.js <archivo>
const fs = require('fs');
const { execSync } = require('child_process');

const archivo = process.argv[2];
const antes = execSync(`git show HEAD:./${archivo}`, { encoding: 'utf8' }).split(/\r?\n/);
const despues = fs.readFileSync(archivo, 'utf8').split(/\r?\n/);

const esComentario = (s) => /^\s*(\/\/|\*|\/\*)/.test(s);
const resumen = { comentario: 0, codigo: 0, lineas: 0 };
const muestras = [];

for (let i = 0; i < Math.max(antes.length, despues.length); i++) {
  const a = antes[i];
  const b = despues[i];
  if (a === b) continue;
  resumen.lineas++;
  if (a === undefined || b === undefined) { resumen.codigo++; continue; }
  if (esComentario(a) || esComentario(b)) { resumen.comentario++; continue; }
  resumen.codigo++;
  if (muestras.length < 15) muestras.push({ linea: i + 1, a, b });
}

console.log(`${archivo}: ${resumen.lineas} lineas cambian `
  + `(${resumen.comentario} comentario, ${resumen.codigo} codigo)`);
for (const m of muestras) {
  console.log(`  L${m.linea}`);
  console.log(`    - ${m.a.trim().slice(0, 100)}`);
  console.log(`    + ${m.b.trim().slice(0, 100)}`);
}
