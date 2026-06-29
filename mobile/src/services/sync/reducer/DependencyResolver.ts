import type { ReducedOperation } from './OperationReducer';

const ENTITY_RANK: Record<string, number> = {
  course: 1,
  subject: 2,
  'flashcard-deck': 3,
  flashcard: 4,
  assessment: 5,
  schedule: 6,
  'audio-recording': 7,
  audio_recording: 7,
  'audio-transcript': 8,
  audio_transcript: 8,
  'calendar-event': 9,
  calendar_event: 9,
  photo: 10,
  'scanned-document': 11,
  scanned_document: 11,
  'youtube-video': 12,
  youtube_video: 12,
  'youtube-transcript': 13,
  youtube_transcript: 13,
  'card-review': 14,
  card_review: 14,
  'card-snooze': 15,
  card_snooze: 15,
  'grading-period': 16,
  grading_period: 16,
  'grading-system': 17,
  grading_system: 17,
  'lms-account': 18,
  lms_account: 18,
  'threshold-overrides': 19,
  'user-preference': 20,
  user_preference: 20,
  'ai-chat': 21,
  'study-session': 22,
  study_session: 22,
  'group-membership': 23,
  group_membership: 23,
  'assessment-result': 24,
  assessment_result: 24,
  'assessment_files': 25,
  category: 26,
  feedback: 27,
  notification: 28,
};

const OPERATION_RANK: Record<string, number> = {
  DELETE: 0,
  RESTORE: 1,
  CREATE: 2,
  UPDATE: 3,
};

export function resolveDependencies(operations: ReducedOperation[]): ReducedOperation[] {
  return [...operations].sort((a, b) => {
    const rankA = ENTITY_RANK[a.entity_type] ?? 99;
    const rankB = ENTITY_RANK[b.entity_type] ?? 99;
    if (rankA !== rankB) return rankA - rankB;

    const opRankA = OPERATION_RANK[a.operation] ?? 0;
    const opRankB = OPERATION_RANK[b.operation] ?? 0;
    if (opRankA !== opRankB) return opRankA - opRankB;

    return a.entity_id.localeCompare(b.entity_id);
  });
}

export function getEntityRank(entityType: string): number {
  return ENTITY_RANK[entityType] ?? 99;
}
