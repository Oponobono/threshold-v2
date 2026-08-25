// Repositories migrated to SessionBoundRepository — singletons eliminated.
// All repositories require a SessionBoundContext at construction.
// Use RepositoryFactory to obtain instances tied to the current session.

export { SubjectRepository, type Subject } from './SubjectRepository';
export { AssessmentRepository, type Assessment } from './AssessmentRepository';
export { AssessmentCategoryRepository, type AssessmentCategory } from './AssessmentCategoryRepository';
export { AssessmentFileRepository, type AssessmentFile } from './AssessmentFileRepository';
export { FlashcardDeckRepository, type FlashcardDeck } from './FlashcardDeckRepository';
export { FlashcardRepository, type Flashcard } from './FlashcardRepository';
export { ScheduleRepository, type Schedule } from './ScheduleRepository';
export { PhotoRepository, type Photo } from './PhotoRepository';
export { AudioRepository, type AudioRecording } from './AudioRepository';
export { AudioTranscriptRepository, type AudioTranscript } from './AudioTranscriptRepository';
export { YouTubeRepository, type YouTubeVideo } from './YouTubeRepository';
export { YouTubeTranscriptRepository, type YouTubeTranscript } from './YouTubeTranscriptRepository';
export { DocumentRepository, type ScannedDocument, type DocumentWithSubject } from './DocumentRepository';
export { DocumentAnchorRepository, type DocumentAnchorRow } from './DocumentAnchorRepository';
export { CalendarEventRepository, type CalendarEvent } from './CalendarEventRepository';
export { StudySessionRepository, type StudySession } from './StudySessionRepository';
export { StudyNoteRepository, type StudyNote, type StudyNoteWithSubject } from './StudyNoteRepository';
export { AiChatRepository, type AiChat } from './AiChatRepository';
export { GradingPeriodRepository, type GradingPeriod } from './GradingPeriodRepository';
export { CourseRepository, type Course } from './CourseRepository';

// Non-syncable / infrastructure (retain singletons where appropriate)
export { CardLogRepository, cardLogRepository, type CardLog } from './CardLogRepository';
export { SyncQueueRepository, syncQueueRepository, type SyncQueueItem } from './SyncQueueRepository';
export { UserRepository, type User } from './UserRepository';
export { UserPreferenceRepository, userPreferenceRepository, type UserPreference } from './UserPreferenceRepository';
