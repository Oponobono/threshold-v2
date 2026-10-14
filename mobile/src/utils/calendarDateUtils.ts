/**
 * calendarDateUtils.ts
 *
 * Capa de normalización temporal pura para el calendario.
 * Garantiza:
 * 1. Componentes de fecha estrictamente locales (sin desfasaje UTC).
 * 2. Formato canónico 'YYYY-MM-DD' para comparaciones e indexación O(1).
 * 3. Normalización resiliente de días de la semana (0..6, donde 0 es domingo).
 */

/**
 * Convierte un objeto Date a string canónico 'YYYY-MM-DD' usando componentes de hora LOCAL.
 */
export function fmtLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normaliza cualquier entrada temporal (Date, 'YYYY-MM-DD', 'DD-MM-YYYY', ISO con hora)
 * a su identificador de día canónico 'YYYY-MM-DD' en hora LOCAL.
 * Devuelve null si la entrada es inválida o no contiene fecha.
 */
export function toDateId(v: string | Date | null | undefined): string | null {
  if (!v) return null;

  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : fmtLocalDate(v);
  }

  const trimmed = String(v).trim();
  if (!trimmed) return null;

  // Caso 1: 'YYYY-MM-DD' (date-only ISO). No pasar por new Date() para evitar desfasaje UTC medianoche.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Caso 2: 'DD-MM-YYYY' (formato legacy común en Threshold)
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('-');
    return `${y}-${m}-${d}`;
  }

  // Caso 3: ISO con hora o fecha completa (ej. '2026-10-12T14:30:00Z', '2026-10-12 14:30:00')
  const dt = new Date(trimmed);
  return isNaN(dt.getTime()) ? null : fmtLocalDate(dt);
}

/**
 * Normaliza cualquier representación de día de semana a 0..6 (0 = Domingo, 1 = Lunes, ..., 6 = Sábado).
 * Soporta tanto 7 (domingo en convención ISO 1-7) como 0 (domingo en Date.getDay()).
 * Acepta tanto numbers como strings numéricos.
 */
export function toWeekday(n: number | string | null | undefined): number | null {
  if (n === null || n === undefined || n === '') return null;
  const num = Number(n);
  if (isNaN(num)) return null;
  return ((num % 7) + 7) % 7;
}

/**
 * Extrae la hora en formato HH:MM desde un string o Date.
 */
export function extractTimeHHMM(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    const hh = String(v.getHours()).padStart(2, '0');
    const mm = String(v.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const str = String(v).trim();
  const match = str.match(/(?:T|\s)?(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return null;
}

export interface MonthActivityIndex {
  byWeekday: Map<number, number>;
  byDate: Map<string, { tasks: number; events: number }>;
}

/**
 * Construye el índice de actividad en O(N) una sola vez al cambiar los datos.
 * Separa clases recurrentes por día de la semana de eventos y tareas puntuales.
 */
export function buildMonthActivityIndex(
  schedules: any[] = [],
  assessments: any[] = [],
  calendarEvents: any[] = []
): MonthActivityIndex {
  // Agrupar clases recurrentes por materia/identidad única para que los bloques
  // horarios consecutivos de la misma materia cuenten como 1 sola clase (equivalente a la tarjeta en la agenda).
  const byWeekdaySubjects = new Map<number, Set<string>>();
  for (const s of schedules) {
    const w = toWeekday(s.day_of_week);
    const key = s.subject_id || s.subjectId || s.id;
    if (w !== null && key) {
      if (!byWeekdaySubjects.has(w)) {
        byWeekdaySubjects.set(w, new Set());
      }
      byWeekdaySubjects.get(w)!.add(String(key));
    }
  }

  const byWeekday = new Map<number, number>();
  for (const [w, set] of byWeekdaySubjects.entries()) {
    byWeekday.set(w, set.size);
  }

  const byDate = new Map<string, { tasks: number; events: number }>();

  for (const a of assessments) {
    const dateId = toDateId(a.due_at ?? a.starts_at ?? a.date);
    if (dateId) {
      const curr = byDate.get(dateId) ?? { tasks: 0, events: 0 };
      curr.tasks++;
      byDate.set(dateId, curr);
    }
  }

  for (const e of calendarEvents) {
    const startId = toDateId(e.startDate ?? e.start_date);
    if (!startId) continue;
    const endId = toDateId(e.endDate ?? e.end_date) ?? startId;
    if (startId === endId) {
      const curr = byDate.get(startId) ?? { tasks: 0, events: 0 };
      curr.events++;
      byDate.set(startId, curr);
    } else {
      // Evento multi-día: llenar días entre start y end (acotado a 31 días máximo)
      const [sy, sm, sd] = startId.split('-').map(Number);
      const [ey, em, ed] = endId.split('-').map(Number);
      let currD = new Date(sy, sm - 1, sd);
      const endD = new Date(ey, em - 1, ed);
      let count = 0;
      while (currD <= endD && count < 31) {
        const dId = fmtLocalDate(currD);
        const curr = byDate.get(dId) ?? { tasks: 0, events: 0 };
        curr.events++;
        byDate.set(dId, curr);
        currD.setDate(currD.getDate() + 1);
        count++;
      }
    }
  }

  return { byWeekday, byDate };
}

/**
 * Consulta en O(1) si un día específico del año/mes/día tiene clases, tareas o eventos.
 */
export function getActivitySummaryForDay(
  index: MonthActivityIndex,
  year: number,
  month: number,
  day: number
): { hasClasses: boolean; hasTasks: boolean; hasEvents: boolean; totalCount: number } {
  const date = new Date(year, month, day);
  const weekday = date.getDay(); // 0..6
  const targetDateId = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const classCount = index.byWeekday.get(weekday) ?? 0;
  const hasClasses = classCount > 0;
  const dateEntry = index.byDate.get(targetDateId);
  const taskCount = dateEntry?.tasks ?? 0;
  const eventCount = dateEntry?.events ?? 0;
  const hasTasks = taskCount > 0;
  const hasEvents = eventCount > 0;
  const totalCount = classCount + taskCount + eventCount;

  return { hasClasses, hasTasks, hasEvents, totalCount };
}

