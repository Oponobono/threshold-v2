import { parseReminderDate } from '../../date/parseReminderDate';

describe('parseReminderDate', () => {
  it('YYYY-MM-DD → 2026-07-22 00:00 local (fecha calendario, no UTC)', () => {
    const result = parseReminderDate('2026-07-22');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(6);
    expect(result!.getDate()).toBe(22);
    expect(result!.getHours()).toBe(0);
    expect(result!.getMinutes()).toBe(0);
  });

  it('YYYY-MM-DD inicio de año → 2026-01-01 00:00 local', () => {
    const result = parseReminderDate('2026-01-01');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(1);
    expect(result!.getHours()).toBe(0);
  });

  it('YYYY-MM-DD fin de año → 2026-12-31 00:00 local', () => {
    const result = parseReminderDate('2026-12-31');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(31);
    expect(result!.getHours()).toBe(0);
  });

  it('YYYY-MM-DD sin padding (2026-7-3) → 2026-07-03 00:00 local', () => {
    const result = parseReminderDate('2026-7-3');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(6);
    expect(result!.getDate()).toBe(3);
    expect(result!.getHours()).toBe(0);
  });

  it('ISO fecha completa inválida (2026-13-01) → null', () => {
    expect(parseReminderDate('2026-13-01')).toBeNull();
  });

  it('ISO fecha completa inválida (2026-02-29 no bisiesto) → null', () => {
    expect(parseReminderDate('2026-02-29')).toBeNull();
  });

  it('ISO timestamp completo → fecha válida', () => {
    const result = parseReminderDate('2026-07-10T15:00:00Z');
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe('2026-07-10T15:00:00.000Z');
  });

  it('DD-MM-YYYY → día primero', () => {
    const result = parseReminderDate('09-07-2026');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(6);
    expect(result!.getDate()).toBe(9);
  });

  it('31-12-2026 → 31 de diciembre', () => {
    const result = parseReminderDate('31-12-2026');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(31);
  });

  it('DD/MM/YYYY → día primero también con slash', () => {
    const result = parseReminderDate('09/07/2026');
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(9);
    expect(result!.getMonth()).toBe(6);
  });

  it('día inválido (32-07-2026) → null', () => {
    expect(parseReminderDate('32-07-2026')).toBeNull();
  });

  it('mes inválido (15-13-2026) → null', () => {
    expect(parseReminderDate('15-13-2026')).toBeNull();
  });

  it('fecha imposible (29-02-2026 no bisiesto) → null', () => {
    expect(parseReminderDate('29-02-2026')).toBeNull();
  });

  it('cadena vacía → null', () => {
    expect(parseReminderDate('')).toBeNull();
    expect(parseReminderDate('   ')).toBeNull();
  });

  it('null/undefined → null', () => {
    expect(parseReminderDate(null)).toBeNull();
    expect(parseReminderDate(undefined)).toBeNull();
  });

  it('cadena inválida → null', () => {
    expect(parseReminderDate('no-es-una-fecha')).toBeNull();
  });

  it('nunca lanza con inputs arbitrarios', () => {
    expect(() => parseReminderDate('32-13-2026')).not.toThrow();
    expect(() => parseReminderDate('99-99-9999')).not.toThrow();
    expect(() => parseReminderDate('0000-00-00')).not.toThrow();
  });
});
