const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

function processFile(f) {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    // Remove old singleton imports
    content = content.replace(/import\s*\{[^}]*(Repository|repository)[^}]*\}\s*from\s*['"][^'"]*database(\/repositories\/[A-Za-z0-9_]+)?['"];?\r?\n/g, '');
    
    // Replace old repository usages with RepositoryFactory
    content = content.replace(/([a-zA-Z0-9]+Repository)\.([a-zA-Z0-9]+)\(/g, (match, p1, p2) => {
        // Map common old names to Factory methods
        const map = {
            'subjectRepository': 'subjects',
            'courseRepository': 'courses',
            'assessmentRepository': 'assessments',
            'assessmentCategoryRepository': 'assessmentCategories',
            'assessmentFileRepository': 'assessmentFiles',
            'flashcardDeckRepository': 'flashcardDecks',
            'flashcardRepository': 'flashcards',
            'audioRepository': 'audio',
            'audioTranscriptRepository': 'audioTranscripts',
            'photoRepository': 'photos',
            'documentRepository': 'documents',
            'scheduleRepository': 'schedules',
            'calendarEventRepository': 'calendarEvents',
            'studyNoteRepository': 'studyNotes',
            'youTubeRepository': 'youtube',
            'youtubeTranscriptRepository': 'youtubeTranscripts'
        };
        const method = map[p1] || p1.replace('Repository', 's');
        return `RepositoryFactory.${method}().${p2}(`;
    });

    // Fix requireActive
    content = content.replace(/\.requireActive\(/g, '.getById(');
    
    // Add RepositoryFactory if it's used but not imported
    if (content.includes('RepositoryFactory.') && !content.includes('import { RepositoryFactory }')) {
        const depth = (f.match(/[\\/]/g) || []).length - 2; // relative to src
        let prefix = depth > 0 ? '../'.repeat(depth) : './';
        if (f.includes('database')) {
             if (f.includes('repositories')) prefix = '../';
             else prefix = './';
        }
        content = `import { RepositoryFactory } from '${prefix}database/RepositoryFactory';\n` + content;
        content = content.replace(/from '\.\/database/, "from '../database"); // rough fix
    }
    
    // Specific param fixes
    content = content.replace(/\(vid\) =>/g, "(vid: any) =>");
    content = content.replace(/\(lf\) =>/g, "(lf: any) =>");
    content = content.replace(/\(n\) =>/g, "(n: any) =>");

    if (content !== original) {
        fs.writeFileSync(f, content);
        console.log('Fixed ' + f);
    }
}

processDir('src');
