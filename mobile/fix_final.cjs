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

// 1. Missing imports
replaceFile('src/hooks/useDocumentsManager.ts', [
    [/(import.*from.*DocumentRepository.*)/, "$1\nimport { DocumentWithSubject } from '../services/database/repositories/DocumentRepository';"]
]);

replaceFile('src/store/useFlashcardsStore.ts', [
    [/(import.*RepositoryFactory.*)/, "$1\nimport { repositoryEventBus } from '../services/database/RepositoryEventBus';"]
]);

replaceFile('src/services/database/RepositoryFactory.ts', [
    [/get syncQueues\(\) \{\s*return new SyncQueueRepository\([^)]*\);\s*\}/, "static syncQueues(): SyncQueueRepository {\n    return new SyncQueueRepository(RepositoryFactory.context);\n  }"],
    [/get users\(\) \{\s*return new UserRepository\([^)]*\);\s*\}/, "static users(): UserRepository {\n    return new UserRepository(RepositoryFactory.context);\n  }"],
    [/(static\s+syncQueues[^}]+\})/, ""], // if exists, replace properly
    [/(static\s+documents.*?\})/, "$1\n  static syncQueues(): SyncQueueRepository {\n    return new SyncQueueRepository(RepositoryFactory.context);\n  }\n  static users(): UserRepository {\n    return new UserRepository(RepositoryFactory.context);\n  }"]
]);

// Need to fix syncQueues and users imports in RepositoryFactory
let rf = fs.readFileSync('src/services/database/RepositoryFactory.ts', 'utf8');
if (!rf.includes('SyncQueueRepository')) {
    rf = rf.replace(/import \{ UserRepository \} from '\.\/repositories\/UserRepository';/, "import { UserRepository } from './repositories/UserRepository';\nimport { SyncQueueRepository } from './repositories/SyncQueueRepository';");
}
fs.writeFileSync('src/services/database/RepositoryFactory.ts', rf);

// 2. Fix the error 'RepositoryFactory' does not exist on type 'typeof import(".../index")'
// We replace import { RepositoryFactory } from '../../services/database' -> .../database/RepositoryFactory
let edm = 'src/components/calendar/EventDetailModal.tsx';
if (fs.existsSync(edm)) {
    let c = fs.readFileSync(edm, 'utf8');
    c = c.replace(/import \{ (.*)RepositoryFactory(.*) \} from '\.\.\/\.\.\/services\/database';/, "import { $1$2 } from '../../services/database';\nimport { RepositoryFactory } from '../../services/database/RepositoryFactory';");
    fs.writeFileSync(edm, c);
}

// 3. Fix missing methods from old singleton (requireActive vs getById for TS checking). 
// we already did this, but just in case, we will add more mapping in useSubjectDetail etc. 

