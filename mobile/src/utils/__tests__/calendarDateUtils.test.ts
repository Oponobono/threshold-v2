import {
  fmtLocalDate,
  toDateId,
  toWeekday,
  extractTimeHHMM,
  buildMonthActivityIndex,
  getActivitySummaryForDay,
} from '../calendarDateUtils';

describe('calendarDateUtils', () => {
  describe('fmtLocalDate', () => {
    it('formatea correctamente una fecha usando componentes locales', () => {
      const d = new Date(2026, 9, 12); // Mes 9 = Octubre
      expect(fmtLocalDate(d)).toBe('2026-10-12');
    });
  });

  describe('toDateId', () => {
    it('devuelve null para valores nulos o vacíos', () => {
      expect(toDateId(null)).toBeNull();
      expect(toDateId(undefined)).toBeNull();
      expect(toDateId('')).toBeNull();
    });

    it('respeta formato YYYY-MM-DD sin pasar por Date() para evitar desfasaje UTC', () => {
      expect(toDateId('2026-10-12')).toBe('2026-10-12');
      expect(toDateId('2026-01-01')).toBe('2026-01-01');
    });

    it('convierte formato DD-MM-YYYY a YYYY-MM-DD', () => {
      expect(toDateId('12-10-2026')).toBe('2026-10-12');
      expect(toDateId('01-05-2025')).toBe('2025-05-01');
    });

    it('convierte objetos Date a YYYY-MM-DD local', () => {
      const d = new Date(2026, 9, 12, 23, 59, 59);
      expect(toDateId(d)).toBe('2026-10-12');
    });

    it('convierte strings ISO con hora a la fecha LOCAL correspondiente', () => {
      const now = new Date();
      const iso = now.toISOString();
      const expected = fmtLocalDate(now);
      expect(toDateId(iso)).toBe(expected);
    });

    it('descarta strings inválidos devolviendo null', () => {
      expect(toDateId('fecha-invalida')).toBeNull();
    });
  });

  describe('toWeekday', () => {
    it('normaliza 0..6 correctamente', () => {
      expect(toWeekday(0)).toBe(0); // Domingo
      expect(toWeekday(1)).toBe(1); // Lunes
      expect(toWeekday(6)).toBe(6); // Sábado
    });

    it('normaliza 7 como 0 (domingo)', () => {
      expect(toWeekday(7)).toBe(0);
      expect(toWeekday('7')).toBe(0);
    });

    it('acepta strings numéricos', () => {
      expect(toWeekday('1')).toBe(1);
      expect(toWeekday('2')).toBe(2);
    });

    it('devuelve null si es nulo o inválido', () => {
      expect(toWeekday(null)).toBeNull();
      expect(toWeekday(undefined)).toBeNull();
      expect(toWeekday('')).toBeNull();
      expect(toWeekday('abc')).toBeNull();
    });
  });

  describe('extractTimeHHMM', () => {
    it('extrae hora de string HH:MM', () => {
      expect(extractTimeHHMM('14:30')).toBe('14:30');
      expect(extractTimeHHMM('8:05')).toBe('08:05');
    });

    it('extrae hora de string ISO', () => {
      expect(extractTimeHHMM('2026-10-12T14:30:00Z')).toBe('14:30');
    });

    it('extrae hora de Date', () => {
      const d = new Date(2026, 9, 12, 9, 5);
      expect(extractTimeHHMM(d)).toBe('09:05');
    });
  });

  describe('buildMonthActivityIndex & getActivitySummaryForDay', () => {
    it('indexa clases por día de la semana y eventos/tareas por fecha', () => {
      const schedules = [
        { id: 'sch1', day_of_week: 1, start_time: '08:00' }, // Lunes
        { id: 'sch2', day_of_week: 5, start_time: '10:00' }, // Viernes
      ];
      const assessments = [
        { id: 'a1', due_at: '2026-10-12T14:00:00Z' }, // 12 Oct 2026 (Lunes)
      ];
      const calendarEvents = [
        { id: 'e1', startDate: '15-10-2026', endDate: '15-10-2026' }, // 15 Oct 2026 (Jueves)
      ];

      const index = buildMonthActivityIndex(schedules, assessments, calendarEvents);

      // 12 Oct 2026: Lunes (tiene clase y tarea, no evento)
      const day12 = getActivitySummaryForDay(index, 2026, 9, 12);
      expect(day12.hasClasses).toBe(true);
      expect(day12.hasTasks).toBe(true);
      expect(day12.hasEvents).toBe(false);

      // 15 Oct 2026: Jueves (tiene evento, no clase ni tarea)
      const day15 = getActivitySummaryForDay(index, 2026, 9, 15);
      expect(day15.hasClasses).toBe(false);
      expect(day15.hasTasks).toBe(false);
      expect(day15.hasEvents).toBe(true);

      // 18 Oct 2026: Domingo (sin actividad)
      const day18 = getActivitySummaryForDay(index, 2026, 9, 18);
      expect(day18.hasClasses).toBe(false);
      expect(day18.hasTasks).toBe(false);
      expect(day18.hasEvents).toBe(false);
    });
  });
});
