const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\analysis';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'TECH_STACK.md');
const footerRegex = /\n*---\n*## 🔗 Enlaces Rápidos en tu Bóveda \(Obsidian\)[\s\S]*$/;

const linkMap = [
  { file: 'DATABASE_DOCUMENTATION', regex: /\b(base de datos|sqlite)\b/i },
  { file: 'API_DOCUMENTATION', regex: /\b(API|endpoints)\b/i },
  { file: 'OFFLINE_ARCHITECTURE', regex: /\b(offline|sin conexión|mmkv)\b/i },
  { file: 'spaced_repetition_logic', regex: /\b(FSRS|SM-2|repetición espaciada)\b/i },
  { file: 'ZYREN_BORN', regex: /\b(Zyren)\b/ },
  { file: 'FLASHCARDS_COMPLETE_DOCUMENTATION', regex: /\b(flashcard[s]?|mazo[s]?)\b/i },
  { file: 'SECURITY', regex: /\b(seguridad)\b/i },
  { file: 'PREDICTIONS_ANALYSIS', regex: /\b(predicci[oó]n|predicciones)\b/i },
  { file: 'LEARNING_ENGINEERING_DOCUMENTATION', regex: /\b(workflow engine|learning engineering)\b/i }
];

files.forEach(filename => {
  let filepath = path.join(dir, filename);
  let content = fs.readFileSync(filepath, 'utf8');
  
  // 1. Remove the global footer
  content = content.replace(footerRegex, '');
  
  // 2. Add organic links
  linkMap.forEach(item => {
    if (filename.includes(item.file)) return;
    
    // Solo reemplazamos la primera coincidencia (regex sin 'g')
    content = content.replace(item.regex, (match, p1, offset, str) => {
        let checkBefore = str.substring(Math.max(0, offset - 15), offset);
        let checkAfter = str.substring(offset, Math.min(str.length, offset + match.length + 15));
        
        // Si ya está dentro de un enlace, no lo tocamos
        if (checkBefore.includes('[[') || checkAfter.includes(']]')) return match;
        
        return `[[${item.file}|${match}]]`;
    });
  });

  fs.writeFileSync(filepath, content, 'utf8');
});

console.log('Enlaces orgánicos generados con éxito!');
