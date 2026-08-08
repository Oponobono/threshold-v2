import {
  parseDatetimeOrNull,
  resolveAssessmentAnchor,
  deriveAssessmentType,
} from '../assessmentTemporal';

describe('parseDatetimeOrNull — solo datetime es anchor válido', () => {
  test('ISO local con T:HH:mm', () => {
    const d = parseDatetimeOrNull('2026-08-20T14:00');
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(14);
  });

  test('ISO local con T:HH:mm:ss', () => {
    const d = parseDatetimeOrNull('2026-08-20T14:00:00');
    expect(d).not.toBeNull();
  });

  test('ISO con espacio (HH:mm)', () => {
    const d = parseDatetimeOrNull('2026-08-20 14:00');
    expect(d).not.toBeNull();
  });

  test('ISO UTC con Z', () => {
    const d = parseDatetimeOrNull('2026-08-20T19:00:00Z');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-08-20T19:00:00.000Z');
  });

  test('date-only (sin hora) → null (nunca medianoche sustituta)', () => {
    expect(parseDatetimeOrNull('2026-08-20')).toBeNull();
  });

  test('string inválido → null', () => {
    expect(parseDatetimeOrNull('no-es-fecha')).toBeNull();
  });

  test('empty / null / undefined → null', () => {
    expect(parseDatetimeOrNull('')).toBeNull();
    expect(parseDatetimeOrNull(null)).toBeNull();
    expect(parseDatetimeOrNull(undefined)).toBeNull();
  });
});

describe('resolveAssessmentAnchor — el dominio decide el anchor, no la policy', () => {
  test('exam con starts_at válido → anchor starts_at', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'exam',
      starts_at: '2026-08-20T14:00',
      ends_at: '2026-08-20T16:00',
      due_at: null,
      date: '2026-08-20',
    });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe('starts_at');
    expect(r!.source).toBe('starts_at');
    expect(r!.anchor.getHours()).toBe(14);
  });

  test('exam con ends_at opcional y due_at null → anchor starts_at', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'exam',
      starts_at: '2026-08-20T08:00',
      due_at: null,
    });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe('starts_at');
  });

  test('exam sin starts_at (aunque tenga due_at) → null (anchor requerido ausente)', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'exam',
      starts_at: null,
      due_at: '2026-08-20T23:59',
    });
    expect(r).toBeNull();
  });

  test('exam con starts_at date-only → null (no se inventa medianoche)', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'exam',
      starts_at: '2026-08-20',
    });
    expect(r).toBeNull();
  });

  test('deadline con due_at válido → anchor due_at', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'deadline',
      due_at: '2026-08-20T23:59',
    });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe('due_at');
    expect(r!.source).toBe('due_at');
  });

  test('deadline sin due_at → null', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'deadline',
      due_at: null,
    });
    expect(r).toBeNull();
  });

  test('deadline con date presente pero sin due_at → null (date nunca es anchor)', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'deadline',
      date: '2026-08-20',
      due_at: null,
    });
    expect(r).toBeNull();
  });

  test('sin assessment_type → null', () => {
    const r = resolveAssessmentAnchor({
      starts_at: '2026-08-20T14:00',
      due_at: '2026-08-20T23:59',
    });
    expect(r).toBeNull();
  });

  test('assessment_type desconocido → null', () => {
    const r = resolveAssessmentAnchor({
      assessment_type: 'quiz',
      starts_at: '2026-08-20T14:00',
    });
    expect(r).toBeNull();
  });

  test('entrada null/undefined → null', () => {
    expect(resolveAssessmentAnchor(null)).toBeNull();
    expect(resolveAssessmentAnchor(undefined)).toBeNull();
  });
});

describe('deriveAssessmentType — backfill determinista de filas legacy', () => {
  test("type='exam' → 'exam'", () => {
    expect(deriveAssessmentType('exam')).toBe('exam');
  });

  test("type='task' → 'deadline'", () => {
    expect(deriveAssessmentType('task')).toBe('deadline');
  });

  test('cualquier otro / null / undefined → null', () => {
    expect(deriveAssessmentType('quiz')).toBeNull();
    expect(deriveAssessmentType('')).toBeNull();
    expect(deriveAssessmentType(null)).toBeNull();
    expect(deriveAssessmentType(undefined)).toBeNull();
  });
});
