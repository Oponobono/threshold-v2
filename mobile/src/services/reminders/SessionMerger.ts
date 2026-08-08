// ── Session Merger (Fase 3) ─────────────────────────────────────────────
//
// CONTRATO CONGELADO (Ago 2026):
//   Una "sesión académica lógica" es el conjunto de filas de `schedules`
//   que comparten EXACTAMENTE la identidad:
//       subject_id | day_of_week | start_time | end_time | name
//   - Atributos que SÍ distinguen sesiones legítimas (NO se fusionan si difieren):
//       end_time (duración distinta = sesión distinta),
//       name     (p.ej. "Cálculo - Teoría" vs "Cálculo - Laboratorio").
//   - Atributos que NO distinguen (no forman parte de la identidad):
//       color  (cosmético), status (estado de la fila, no su identidad).
//   - day_of_week se normaliza 7 → 0 (ClassPolicy trata 7 y 0 como domingo).
//   - Filas sin day_of_week o sin start_time son NO clasificables → cada una
//     devuelve una sesión singleton (nada se pierde; ClassPolicy no genera
//     secuencia para ellas de todos modos).
//
//   Invariantes de salida:
//   - El resultado es determinístico e independiente del orden de entrada
//     (tanto el conjunto como el orden y el id de cada sesión).
//   - sourceScheduleIds conserva TODAS las filas absorbidas (para diagnóstico).
//     Nunca debe convertirse en múltiples reminders: la frontera entre fila
//     física e intención lógica termina aquí. El engine consumirá sesiones.
//
//   Regla de la fase: NO modificar NotificationReconciler ni SequenceFactory
//   para solucionar la multiplicación de reminders. La evidencia de Fase 0
//   demostró que ambas piezas convergen correctamente sobre el input que
//   reciben; el problema está en la frontera físico→lógico, que es esta capa.

export interface ScheduleRowInput {
  readonly id: string;
  readonly subject_id?: string | null;
  readonly day_of_week?: number | null;
  readonly start_time?: string | null;
  readonly end_time?: string | null;
  readonly name?: string | null;
  readonly status?: string | null;
}

export interface LogicalSession {
  readonly id: string;
  readonly subjectId: string | null;
  readonly dayOfWeek: number | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly name: string | null;
  readonly classifiable: boolean;
  readonly sourceScheduleIds: readonly string[];
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function normDow(value: number | null | undefined): number | null {
  if (value == null) return null;
  const dow = Math.trunc(Number(value));
  return dow === 7 ? 0 : dow;
}

function isClassifiable(row: ScheduleRowInput): boolean {
  return row.day_of_week != null && norm(row.start_time).length > 0;
}

function identityKey(row: ScheduleRowInput): string | null {
  if (!isClassifiable(row)) return null;
  const parts = [
    norm(row.subject_id),
    String(normDow(row.day_of_week)),
    norm(row.start_time),
    norm(row.end_time),
    norm(row.name),
  ].map((p) => encodeURIComponent(p));
  return parts.join('|');
}

function toSession(key: string, rows: readonly ScheduleRowInput[], classifiable: boolean): LogicalSession {
  const first = rows[0];
  return {
    id: classifiable ? `logical::${key}` : `logical::row::${encodeURIComponent(first.id)}`,
    subjectId: norm(first.subject_id) || null,
    dayOfWeek: normDow(first.day_of_week),
    startTime: norm(first.start_time) || null,
    endTime: norm(first.end_time) || null,
    name: norm(first.name) || null,
    classifiable,
    sourceScheduleIds: rows.map((r) => r.id).sort(),
  };
}

export function mergeScheduleRows(rows: readonly ScheduleRowInput[]): LogicalSession[] {
  const groups = new Map<string, ScheduleRowInput[]>();
  const unclassified: ScheduleRowInput[] = [];

  for (const row of rows) {
    const key = identityKey(row);
    if (key === null) {
      unclassified.push(row);
      continue;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const sessions: LogicalSession[] = [];
  for (const [key, group] of groups.entries()) {
    sessions.push(toSession(key, group, true));
  }
  for (const row of unclassified) {
    sessions.push(toSession(row.id, [row], false));
  }

  sessions.sort((a, b) => {
    const dow = (a.dayOfWeek ?? -1) - (b.dayOfWeek ?? -1);
    if (dow !== 0) return dow;
    const start = (a.startTime ?? '').localeCompare(b.startTime ?? '');
    if (start !== 0) return start;
    const subj = (a.subjectId ?? '').localeCompare(b.subjectId ?? '');
    if (subj !== 0) return subj;
    const end = (a.endTime ?? '').localeCompare(b.endTime ?? '');
    if (end !== 0) return end;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return sessions;
}
