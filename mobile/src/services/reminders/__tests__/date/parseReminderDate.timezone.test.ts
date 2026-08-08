import { parseReminderDate } from '../../date/parseReminderDate';

const ORIGINAL_TZ = process.env.TZ;

describe('parseReminderDate — timezone America/Bogota (UTC-5, sin DST)', () => {
  beforeAll(() => {
    process.env.TZ = 'America/Bogota';
  });

  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('date="2026-07-22" → 2026-07-22 00:00 local, NO 2026-07-21 19:00', () => {
    const result = parseReminderDate('2026-07-22');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(6);
    expect(result!.getDate()).toBe(22);
    expect(result!.getHours()).toBe(0);
    expect(result!.getMinutes()).toBe(0);
    expect(result!.toISOString()).toBe('2026-07-22T05:00:00.000Z');
  });

  it('2026-01-01 → 2026-01-01 00:00 local (05:00Z)', () => {
    const result = parseReminderDate('2026-01-01');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(1);
    expect(result!.getHours()).toBe(0);
    expect(result!.toISOString()).toBe('2026-01-01T05:00:00.000Z');
  });

  it('2026-12-31 → 2026-12-31 00:00 local (05:00Z)', () => {
    const result = parseReminderDate('2026-12-31');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(31);
    expect(result!.getHours()).toBe(0);
    expect(result!.toISOString()).toBe('2026-12-31T05:00:00.000Z');
  });

  it('DD-MM-YYYY produce exactamente el mismo resultado que antes (medianoche local)', () => {
    const result = parseReminderDate('09-07-2026');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(6);
    expect(result!.getDate()).toBe(9);
    expect(result!.getHours()).toBe(0);
    expect(result!.toISOString()).toBe('2026-07-09T05:00:00.000Z');
  });

  it('ISO timestamp con Z se preserva (instante absoluto, inalterado)', () => {
    const result = parseReminderDate('2026-07-10T15:00:00Z');
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe('2026-07-10T15:00:00.000Z');
  });
});
