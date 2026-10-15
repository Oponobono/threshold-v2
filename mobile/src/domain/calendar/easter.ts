/**
 * easter.ts
 *
 * Cálculo del Domingo de Pascua de Resurrección mediante el algoritmo
 * eclesiástico de Jean Meeus / Harold Spencer Jones / Butcher.
 * Válido para el calendario gregoriano (1583 en adelante).
 *
 * Utiliza aritmética de calendario en UTC puro para garantizar que no haya
 * desfasajes de zona horaria en ningún entorno o dispositivo.
 */

export interface EasterDate {
  readonly year: number;
  readonly month: number; // 1-12 (3 = Marzo, 4 = Abril)
  readonly day: number;   // 1-31
  readonly dateId: string; // 'YYYY-MM-DD'
}

/**
 * Calcula la fecha del Domingo de Pascua (Resurrección) para el año gregoriano dado.
 */
export function getEasterSunday(year: number): EasterDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  const dateId = `${year}-${monthStr}-${dayStr}`;

  return { year, month, day, dateId };
}

/**
 * Suma o resta días a una fecha (año, mes 1-12, día 1-31) usando Date.UTC
 * y retorna el DateId canónico 'YYYY-MM-DD'.
 */
export function addDaysToDate(year: number, month: number, day: number, daysToAdd: number): string {
  // Nota: en Date.UTC los meses son 0-indexados (0 = Enero, 11 = Diciembre)
  const utcMs = Date.UTC(year, month - 1, day) + daysToAdd * 86400000;
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

/**
 * Retorna el día de la semana en UTC: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado.
 */
export function getUTCDayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Aplica la regla de la Ley Emiliani (Ley 51 de 1983):
 * Si la fecha original cae en Lunes, se mantiene en ese Lunes.
 * Si cae en cualquier otro día (Martes a Domingo), se traslada al LUNES SIGUIENTE.
 */
export function moveToNextMondayIfApplicable(year: number, month: number, day: number): {
  readonly observedDateId: string;
  readonly isMoved: boolean;
} {
  const dayOfWeek = getUTCDayOfWeek(year, month, day); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  if (dayOfWeek === 1) {
    // Ya es lunes: no se traslada
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return {
      observedDateId: `${year}-${monthStr}-${dayStr}`,
      isMoved: false,
    };
  }

  // Días a sumar para alcanzar el siguiente lunes:
  // Domingo (0) -> +1 día
  // Martes (2)  -> +6 días
  // Miércoles (3) -> +5 días
  // Jueves (4)  -> +4 días
  // Viernes (5) -> +3 días
  // Sábado (6)  -> +2 días
  const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const observedDateId = addDaysToDate(year, month, day, daysToAdd);

  return {
    observedDateId,
    isMoved: true,
  };
}
