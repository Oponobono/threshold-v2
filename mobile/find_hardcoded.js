const fs = require('fs');
const path = require('path');

const dirs = [
  'app',
  'src/components',
  'src/components/dashboard',
];

const spES = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
const byFile = {};

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
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
        !trimmed.includes('console.')
      ) {
        const key = path.join(dir, file);
        if (!byFile[key]) byFile[key] = [];
        byFile[key].push((i+1) + ': ' + trimmed.substring(0, 100));
      }
    });
  }
}

for (const [file, lines] of Object.entries(byFile)) {
  console.log('\n=== ' + file + ' ===');
  lines.forEach(l => console.log('  ' + l));
}
