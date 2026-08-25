const fs = require('fs');

function replaceFile(f, replaces) {
    if (!fs.existsSync(f)) return;
    let content = fs.readFileSync(f, 'utf8');
    let changed = false;
    for (let r of replaces) {
        let newC = content.replace(r[0], r[1]);
        if (newC !== content) {
            content = newC;
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(f, content);
        console.log("Updated " + f);
    }
}

replaceFile('src/services/domain/__tests__/FlashcardDomainService.test.ts', [
    [/const deckRepo = flashcardDeckRepository as any;/g, "import { RepositoryFactory } from '../../database/RepositoryFactory';\nconst deckRepo = RepositoryFactory.flashcardDecks() as any;"],
    [/const cardRepo = flashcardRepository as any;/g, "const cardRepo = RepositoryFactory.flashcards() as any;"]
]);

replaceFile('src/services/database/__tests__/DocumentAnchorPersistence.test.ts', [
    [/repo = new DocumentAnchorRepository\(\);/g, "repo = new DocumentAnchorRepository({ userId: 'test-user', sessionGeneration: 'gen-1' });"]
]);

replaceFile('src/services/domain/invariants.ts', [
    [/return RepositoryFactory\.courses\(\)\.getById\(id, userId\);/g, "return RepositoryFactory.courses().getById(id);"]
]);
