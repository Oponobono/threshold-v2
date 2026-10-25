/**
 * calendarRules.ts
 *
 * Aritmética de calendario pura para el catálogo de conmemoraciones.
 * Trabaja exclusivamente en UTC, por lo que no depende de la zona horaria del equipo.
 */

/**
 * Indica si un año gregoriano es bisiesto.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Retorna el DateId 'YYYY-MM-DD' del n-ésimo día de la semana indicado dentro de un mes.
 * weekday: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado. month: 1-12.
 */
export function getNthWeekdayOfMonth(
  year: number,
  month: number,
  targetWeekday: number,
  n: number
): string {
  let count = 0;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === targetWeekday) {
      count++;
      if (count === n) {
        const mStr = String(month).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        return `${year}-${mStr}-${dStr}`;
      }
    }
  }

  throw new Error(`No se encontró el ${n}-ésimo día ${targetWeekday} en ${year}-${month}`);
}

/**
 * Retorna el DateId 'YYYY-MM-DD' del último día de la semana indicado dentro de un mes.
 * weekday: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado. month: 1-12.
 */
export function getLastWeekdayOfMonth(
  year: number,
  month: number,
  targetWeekday: number
): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = daysInMonth; day >= 1; day--) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === targetWeekday) {
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }

  throw new Error(`No se encontró el último día ${targetWeekday} en ${year}-${month}`);
}
