const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\cris7\\.gemini\\antigravity\\brain\\61808fd8-dce3-4eb3-b7d3-6f52b56f1570\\.system_generated\\logs\\overview.txt', 'utf8').split('\n');

const syncWrites = lines.filter(l => l.includes('write_to_file') && l.includes('CodeContent') && l.includes('offlineSyncService.ts') && !l.includes('task.md') && !l.includes('offlineSyncService.test.ts'));
if (syncWrites.length > 0) {
    const data = JSON.parse(syncWrites[syncWrites.length-1]);
    const tc = data.tool_calls.find(c => c.name === 'write_to_file');
    let content = tc.args.CodeContent;
    if (content.startsWith('\"') && content.endsWith('\"')) {
        try { content = JSON.parse(content); } catch(e) {}
    }
    fs.writeFileSync('mobile/src/services/offlineSyncService.ts', content);
    console.log('Recovered offlineSyncService.ts');
}

const modalWrites = lines.filter(l => l.includes('write_to_file') && l.includes('CodeContent') && l.includes('FlashcardImportModal.tsx') && !l.includes('task.md'));
if (modalWrites.length > 0) {
    const data = JSON.parse(modalWrites[modalWrites.length-1]);
    const tc = data.tool_calls.find(c => c.name === 'write_to_file');
    let content = tc.args.CodeContent;
    if (content.startsWith('\"') && content.endsWith('\"')) {
        try { content = JSON.parse(content); } catch(e) {}
    }
    fs.writeFileSync('mobile/src/components/flashcards/FlashcardImportModal.tsx', content);
    console.log('Recovered FlashcardImportModal.tsx');
}
