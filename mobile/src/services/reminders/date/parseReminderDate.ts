const DAY_FIRST_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const ISO_DATE_ONLY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

function localCalendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parseReminderDate(raw: string | null | undefined): Date | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value === '') return null;

  const dayFirst = DAY_FIRST_DATE.exec(value);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return localCalendarDate(year, month, day);
  }

  const isoDate = ISO_DATE_ONLY.exec(value);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return localCalendarDate(year, month, day);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
