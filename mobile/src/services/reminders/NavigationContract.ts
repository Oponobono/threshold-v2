export type ReminderEntityType = 'assessment' | 'schedule' | 'flashcard_deck' | 'grading_period' | 'calendar_event';

export interface ReminderNavigationPayload {
  readonly deeplink: string;
  readonly entityType: ReminderEntityType;
  readonly entityId: string;
}

export function parseDeeplink(deeplink: string): ReminderNavigationPayload | null {
  const url = deeplink.startsWith('threshold://') ? deeplink : `threshold://${deeplink}`;
  const parsed = URL_PATTERNS.find(({ pattern }) => pattern.test(url));
  if (!parsed) return null;
  const match = url.match(parsed.pattern);
  if (!match) return null;
  return { deeplink, entityType: parsed.entityType, entityId: match[1] };
}

export function getTargetRoute(entityType: ReminderEntityType): '/calendar' | '/' | '/flashcards' {
  switch (entityType) {
    case 'assessment':
    case 'calendar_event':
      return '/calendar';
    case 'schedule':
    case 'grading_period':
      return '/';
    case 'flashcard_deck':
      return '/flashcards';
  }
}

interface UrlPattern {
  pattern: RegExp;
  entityType: ReminderEntityType;
}

const URL_PATTERNS: UrlPattern[] = [
  { pattern: /^threshold:\/\/assessments\/([^/?#]+)/, entityType: 'assessment' },
  { pattern: /^threshold:\/\/schedules\/([^/?#]+)/, entityType: 'schedule' },
  { pattern: /^threshold:\/\/decks\/([^/?#]+)/, entityType: 'flashcard_deck' },
  { pattern: /^threshold:\/\/grades\/([^/?#]+)/, entityType: 'grading_period' },
  { pattern: /^threshold:\/\/events\/([^/?#]+)/, entityType: 'calendar_event' },
];
