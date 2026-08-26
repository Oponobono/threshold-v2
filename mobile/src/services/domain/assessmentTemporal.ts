export type AssessmentType = 'exam' | 'deadline';

export interface AssessmentTemporalFields {
  assessment_type?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  due_at?: string | null;
  date?: string | null;
}

export interface AssessmentAnchor {
  kind: 'starts_at' | 'due_at';
  anchor: Date;
  source: string;
}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDatetimeOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (!DATETIME_RE.test(v)) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parsea date-only (YYYY-MM-DD) como medianoche LOCAL (no UTC).
 * Strings con hora se delegan a parseDatetimeOrNull.
 * Usado como fallback para assessments legacy que solo tienen `date`.
 */
export function parseDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (DATE_ONLY_RE.test(v)) {
    const [year, month, day] = v.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  return parseDatetimeOrNull(v);
}

export function resolveAssessmentAnchor(entity: AssessmentTemporalFields | null | undefined): AssessmentAnchor | null {
  if (!entity) return null;
  if (entity.assessment_type === 'deadline') {
    const anchor = parseDatetimeOrNull(entity.due_at);
    if (anchor) return { kind: 'due_at', anchor, source: 'due_at' };
    const fallback = parseDateOrNull(entity.date);
    return fallback ? { kind: 'due_at', anchor: fallback, source: 'date' } : null;
  }
  if (entity.assessment_type === 'exam') {
    const anchor = parseDatetimeOrNull(entity.starts_at);
    if (anchor) return { kind: 'starts_at', anchor, source: 'starts_at' };
    const fallback = parseDateOrNull(entity.date);
    return fallback ? { kind: 'due_at', anchor: fallback, source: 'date' } : null;
  }
  return null;
}

export function deriveAssessmentType(legacyType?: string | null): AssessmentType | null {
  if (legacyType === 'exam') return 'exam';
  if (legacyType === 'task') return 'deadline';
  return null;
}
