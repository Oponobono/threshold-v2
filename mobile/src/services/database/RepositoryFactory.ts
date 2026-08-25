/**
 * RepositoryFactory
 *
 * Single access point for all SessionBoundRepository instances.
 * Each call obtains the current SessionBoundContext from SessionIdentity and
 * returns a repository scoped to that session. Callers never instantiate
 * repositories directly — this ensures the context is always fresh.
 *
 * Invariant: if sessionIdentity has no active session, throws NO_ACTIVE_SESSION.
 * Architecture rule: UI and services import from this factory, not from repositories directly.
 *
 * Two tiers:
 *  - Session-bound (domain entities): use ctx() → ownership predicate enforced.
 *  - Infrastructure (non-domain): no ctx() → access is controlled by the caller's context.
 */
import { sessionIdentity } from '../api/auth/SessionIdentity';

import { SubjectRepository } from './repositories/SubjectRepository';
import { AssessmentRepository } from './repositories/AssessmentRepository';
import { AssessmentCategoryRepository } from './repositories/AssessmentCategoryRepository';
import { AssessmentFileRepository } from './repositories/AssessmentFileRepository';
import { FlashcardDeckRepository } from './repositories/FlashcardDeckRepository';
import { FlashcardRepository } from './repositories/FlashcardRepository';
import { ScheduleRepository } from './repositories/ScheduleRepository';
import { PhotoRepository } from './repositories/PhotoRepository';
import { AudioRepository } from './repositories/AudioRepository';
import { AudioTranscriptRepository } from './repositories/AudioTranscriptRepository';
import { YouTubeRepository } from './repositories/YouTubeRepository';
import { YouTubeTranscriptRepository } from './repositories/YouTubeTranscriptRepository';
import { DocumentRepository } from './repositories/DocumentRepository';
import { DocumentAnchorRepository } from './repositories/DocumentAnchorRepository';
import { CalendarEventRepository } from './repositories/CalendarEventRepository';
import { StudySessionRepository } from './repositories/StudySessionRepository';
import { StudyNoteRepository } from './repositories/StudyNoteRepository';
import { AiChatRepository } from './repositories/AiChatRepository';
import { GradingPeriodRepository } from './repositories/GradingPeriodRepository';
import { CourseRepository } from './repositories/CourseRepository';
import { HighlightRepository } from './repositories/HighlightRepository';
import { UserRepository } from './repositories/UserRepository';
// Infrastructure repositories (no session-bound ownership)
import { SyncQueueRepository } from './repositories/SyncQueueRepository';
import { CardLogRepository } from './repositories/CardLogRepository';
import { GroupRepository } from './repositories/GroupRepository';
import { GroupMembershipRepository } from './repositories/GroupMembershipRepository';
import { LmsAccountRepository } from './repositories/LmsAccountRepository';
import { ThresholdOverrideRepository } from './repositories/ThresholdOverrideRepository';
import { LocalGradingConfigRepository } from './repositories/LocalGradingConfigRepository';

function ctx() {
  return sessionIdentity.getBoundContext();
}

export const RepositoryFactory = {
  // ── Session-bound domain entities ────────────────────────────────────────
  subjects: () => new SubjectRepository(ctx()),
  assessments: () => new AssessmentRepository(ctx()),
  assessmentCategories: () => new AssessmentCategoryRepository(ctx()),
  assessmentFiles: () => new AssessmentFileRepository(ctx()),
  flashcardDecks: () => new FlashcardDeckRepository(ctx()),
  flashcards: () => new FlashcardRepository(ctx()),
  schedules: () => new ScheduleRepository(ctx()),
  photos: () => new PhotoRepository(ctx()),
  audio: () => new AudioRepository(ctx()),
  audioTranscripts: () => new AudioTranscriptRepository(ctx()),
  youtube: () => new YouTubeRepository(ctx()),
  youtubeTranscripts: () => new YouTubeTranscriptRepository(ctx()),
  documents: () => new DocumentRepository(ctx()),
  documentAnchors: () => new DocumentAnchorRepository(ctx()),
  calendarEvents: () => new CalendarEventRepository(ctx()),
  studySessions: () => new StudySessionRepository(ctx()),
  studyNotes: () => new StudyNoteRepository(ctx()),
  aiChats: () => new AiChatRepository(ctx()),
  gradingPeriods: () => new GradingPeriodRepository(ctx()),
  courses: () => new CourseRepository(ctx()),
  highlights: () => new HighlightRepository(ctx()),
  // ── Singletons / non-session-bound ───────────────────────────────────────
  users: () => UserRepository.getInstance(),
  // ── Infrastructure (no ownership predicate) ───────────────────────────────
  syncQueues: () => new SyncQueueRepository(),
  cardLogs: () => new CardLogRepository(),
  groups: () => new GroupRepository(),
  groupMemberships: () => new GroupMembershipRepository(),
  lmsAccounts: () => new LmsAccountRepository(),
  thresholdOverrides: () => new ThresholdOverrideRepository(),
  localGradingConfig: () => new LocalGradingConfigRepository(),
};

export type RepositoryFactoryKey = keyof typeof RepositoryFactory;
