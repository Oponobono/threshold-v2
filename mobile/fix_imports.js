const fs = require('fs');
const files = [
  'app/(tabs)/index.tsx',
  'src/components/calendar/EventDetailModal.tsx',
  'src/components/subjects/AssessmentsSection.tsx',
  'src/components/subjects/SubjectAIChatModal.tsx',
  'src/hooks/useCachePreload.ts',
  'src/hooks/useDocumentsManager.ts',
  'src/hooks/useGallery.ts',
  'src/hooks/useRecordingsManager.ts',
  'src/hooks/useSubjectDetail.ts',
  'src/hooks/useSubjects.ts',
  'src/services/api/learning/sessions.ts',
  'src/components/dashboard/CreateSubjectModal.tsx',
  'src/components/dashboard/EditSubjectModal.tsx',
  'src/components/flashcards/FlashcardImportModal.tsx',
  'src/components/flashcards/FlashcardStudyScreen.tsx',
  'src/components/flashcards/LinkExamModal.tsx',
  'src/components/subjects/ZyrenIngestionModal.tsx',
  'src/domain/fsrs/FlashcardDomainService.ts'
];

files.forEach(f => {
  try {
    let content = fs.readFileSync(f, 'utf8');
    
    // Remove all existing RepositoryFactory imports to avoid duplicates
    content = content.replace(/import\s*\{\s*RepositoryFactory\s*\}\s*from\s*['"][^'"]+['"];?\r?\n/g, '');
    
    // Find depth and construct import
    const depth = f.split('/').length - 1;
    const isApp = f.startsWith('app');
    let prefix = '';
    if (isApp) {
      prefix = '../../src/';
    } else {
      for (let i = 0; i < depth - 1; i++) prefix += '../';
    }
    
    // Add import after first line (or at top)
    const importStr = import { RepositoryFactory } from 'services/database/RepositoryFactory';\n;
    content = importStr + content;
    
    // Specific fixes
    content = content.replace(/RepositoryFactory\.assessmentFiles\(\)\.getByAssessment\([^,]+,\s*([^)]+)\)/g, 'RepositoryFactory.assessmentFiles().getByField(\'assessment_id\', )');
    content = content.replace(/RepositoryFactory\.assessmentFiles\(\)\.getByAssessment/g, 'RepositoryFactory.assessmentFiles().getByField');
    content = content.replace(/RepositoryFactory\.flashcardDecks\(\)\(\)/g, 'RepositoryFactory.flashcardDecks()');
    content = content.replace(/RepositoryFactory\.flashcards\(\)\(\)/g, 'RepositoryFactory.flashcards()');
    content = content.replace(/RepositoryFactory\.flashcardDecks(?!\(\))/g, 'RepositoryFactory.flashcardDecks()');
    content = content.replace(/RepositoryFactory\.flashcards(?!\(\))/g, 'RepositoryFactory.flashcards()');

    fs.writeFileSync(f, content);
    console.log('Fixed ' + f);
  } catch (e) {
    console.log('Error on ' + f + ': ' + e.message);
  }
});
