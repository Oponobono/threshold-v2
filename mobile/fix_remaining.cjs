const fs = require('fs');
const files = [
  'src/services/domain/invariants.ts',
  'src/services/import/AcademicImportExecutor.ts',
  'src/services/import/validators/DuplicateValidator.ts',
  'src/services/migration/migrateFlashcardsFromMMKV.ts',
  'src/services/MomentumService.ts',
  'src/services/reminders/ReminderDiagnostics.ts',
  'src/store/useFlashcardsStore.ts'
];

files.forEach(f => {
  try {
    let content = fs.readFileSync(f, 'utf8');
    
    // Remove all existing RepositoryFactory imports to avoid duplicates
    content = content.replace(/import\s*\{\s*RepositoryFactory\s*\}\s*from\s*['"][^'"]+['"];?\r?\n/g, '');
    
    // Find depth and construct import
    const depth = f.split('/').length - 1;
    let prefix = '';
    for (let i = 0; i < depth - 1; i++) prefix += '../';
    
    // Add import after first line (or at top)
    const importStr = `import { RepositoryFactory } from '${prefix}services/database/RepositoryFactory';\n`;
    content = importStr + content;

    fs.writeFileSync(f, content);
    console.log('Fixed ' + f);
  } catch (e) {
    console.log('Error on ' + f + ': ' + e.message);
  }
});
