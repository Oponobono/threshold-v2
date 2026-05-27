const fs = require('fs');
const path = require('path');

function getAllFiles(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        results = results.concat(getAllFiles(fp));
      } else if (e.isFile() && (e.name.endsWith('.tsx') || e.name.endsWith('.ts'))) {
        results.push(fp);
      }
    }
  } catch (_) {}
  return results;
}

const dirs = [
  'app',
  'src',
];

const spES = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
const byFile = {};

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = getAllFiles(dir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (
        spES.test(trimmed) &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('console.') &&
        !trimmed.startsWith('throw') &&
        !trimmed.includes("t('") &&
        !trimmed.includes('t("') &&
        !trimmed.includes('console.') &&
        !trimmed.includes('import ') &&
        !trimmed.includes('require(')
      ) {
        if (!byFile[file]) byFile[file] = [];
        byFile[file].push((i+1) + ': ' + trimmed.substring(0, 120));
      }
    });
  }
}

for (const [file, lines] of Object.entries(byFile)) {
  console.log('\n=== ' + file + ' ===');
  lines.forEach(l => console.log('  ' + l));
}
