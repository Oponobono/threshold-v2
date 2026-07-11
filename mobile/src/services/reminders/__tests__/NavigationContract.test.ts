import { parseDeeplink, getTargetRoute } from '../NavigationContract';

describe('parseDeeplink', () => {
  it('parses assessment deeplink', () => {
    const result = parseDeeplink('threshold://assessments/abc123');
    expect(result).toEqual({
      deeplink: 'threshold://assessments/abc123',
      entityType: 'assessment',
      entityId: 'abc123',
    });
  });

  it('parses schedule deeplink', () => {
    const result = parseDeeplink('threshold://schedules/sched-456');
    expect(result).toEqual({
      deeplink: 'threshold://schedules/sched-456',
      entityType: 'schedule',
      entityId: 'sched-456',
    });
  });

  it('parses flashcard deck deeplink', () => {
    const result = parseDeeplink('threshold://decks/deck-789');
    expect(result).toEqual({
      deeplink: 'threshold://decks/deck-789',
      entityType: 'flashcard_deck',
      entityId: 'deck-789',
    });
  });

  it('parses grading period deeplink', () => {
    const result = parseDeeplink('threshold://grades/grade-001');
    expect(result).toEqual({
      deeplink: 'threshold://grades/grade-001',
      entityType: 'grading_period',
      entityId: 'grade-001',
    });
  });

  it('parses calendar event deeplink', () => {
    const result = parseDeeplink('threshold://events/evt-999');
    expect(result).toEqual({
      deeplink: 'threshold://events/evt-999',
      entityType: 'calendar_event',
      entityId: 'evt-999',
    });
  });

  it('accepts deeplink without threshold:// prefix', () => {
    const result = parseDeeplink('assessments/abc');
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe('assessment');
    expect(result!.entityId).toBe('abc');
  });

  it('returns null for unknown scheme', () => {
    expect(parseDeeplink('unknown://test/123')).toBeNull();
  });

  it('returns null for malformed deeplink', () => {
    expect(parseDeeplink('threshold://assessments/')).toBeNull();
    expect(parseDeeplink('threshold://unknown/123')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDeeplink('')).toBeNull();
  });

  it('parses deeplink with query params (ignores them)', () => {
    const result = parseDeeplink('threshold://decks/deck-001?source=notification');
    expect(result).toEqual({
      deeplink: 'threshold://decks/deck-001?source=notification',
      entityType: 'flashcard_deck',
      entityId: 'deck-001',
    });
  });
});

describe('getTargetRoute', () => {
  it('maps assessment to /calendar', () => {
    expect(getTargetRoute('assessment')).toBe('/calendar');
  });

  it('maps calendar_event to /calendar', () => {
    expect(getTargetRoute('calendar_event')).toBe('/calendar');
  });

  it('maps schedule to / (dashboard)', () => {
    expect(getTargetRoute('schedule')).toBe('/');
  });

  it('maps grading_period to / (dashboard)', () => {
    expect(getTargetRoute('grading_period')).toBe('/');
  });

  it('maps flashcard_deck to /flashcards', () => {
    expect(getTargetRoute('flashcard_deck')).toBe('/flashcards');
  });
});
