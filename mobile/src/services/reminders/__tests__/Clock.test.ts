import { SystemClock, FakeClock } from '../Clock';

describe('SystemClock', () => {
  test('now() returns a Date within 1 second of real time', () => {
    const clock = new SystemClock();
    const before = Date.now();
    const result = clock.now().getTime();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before - 100);
    expect(result).toBeLessThanOrEqual(after + 100);
  });
});

describe('FakeClock', () => {
  test('now() returns the anchor date', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor);
    expect(clock.now().getTime()).toBe(anchor.getTime());
  });

  test('now() returns independent copies (no mutation leak)', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor);
    const result = clock.now();
    result.setFullYear(2000);
    expect(clock.now().getTime()).toBe(anchor.getTime());
  });

  test('now() advances when advanceMs is set', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor, { advanceMs: 1000 });
    const first = clock.now().getTime();
    const second = clock.now().getTime();
    expect(second - first).toBe(1000);
    const third = clock.now().getTime();
    expect(third - second).toBe(1000);
  });

  test('advance() moves the clock forward', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor);
    clock.advance(5000);
    expect(clock.now().getTime()).toBe(anchor.getTime() + 5000);
  });

  test('advance() with 0 ms does nothing', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor);
    clock.advance(0);
    expect(clock.now().getTime()).toBe(anchor.getTime());
  });

  test('setNow() overrides the clock', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor);
    const later = new Date('2025-07-01T00:00:00Z');
    clock.setNow(later);
    expect(clock.now().getTime()).toBe(later.getTime());
  });

  test('setNow() with earlier date goes backwards', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor);
    const earlier = new Date('2025-01-01T00:00:00Z');
    clock.setNow(earlier);
    expect(clock.now().getTime()).toBe(earlier.getTime());
  });

  test('default advanceMs is 0', () => {
    const anchor = new Date('2025-06-15T10:00:00Z');
    const clock = new FakeClock(anchor);
    const first = clock.now().getTime();
    const second = clock.now().getTime();
    expect(second - first).toBe(0);
  });
});
