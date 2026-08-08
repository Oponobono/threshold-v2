export type DiffStatus = 'aligned' | 'drifted' | 'missing' | 'orphan';

export interface RawScheduleDiag {
  readonly id: string;
  readonly day_of_week: number | null;
  readonly start_time: string | null;
  readonly end_time: string | null;
  readonly subject_id?: string;
}

export interface RawAssessmentDiag {
  readonly id: string;
  readonly name: string;
  readonly date: string | null;
  readonly due_date?: string | null;
  readonly is_completed?: number | null;
}

export interface RawEventDiag {
  readonly id: string;
  readonly title: string;
  readonly start_date: string | null;
  readonly end_date?: string | null;
  readonly all_day?: number;
}

export interface RawDeckDiag {
  readonly id: string;
  readonly title: string;
  readonly card_count?: number;
}

export interface ExpectedPlanItem {
  readonly id: string;
  readonly scheduledAt: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly intent: string;
  readonly priority: string;
  readonly title: string;
}

export interface OsScheduledItem {
  readonly identifier: string;
  readonly title: string;
  readonly body: string;
  readonly triggerDate: string | null;
}

export interface DiffItem {
  readonly id: string;
  readonly status: DiffStatus;
  readonly expectedAt: string | null;
  readonly actualAt: string | null;
  readonly deltaMs: number | null;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly title?: string;
}

export interface ExactAlarmCapability {
  readonly platform: string;
  readonly sdk: number | null;
  readonly manufacturer: string | null;
  readonly modelName: string | null;
  readonly scheduleExactAlarmGranted: boolean | null;
  readonly useExactAlarmGranted: boolean | null;
  readonly nativeCanScheduleExactAlarms: boolean | null;
  readonly canScheduleExactAlarms: boolean | null;
  readonly batteryOptimizationIgnored: boolean | null;
  readonly dozeWhitelisted: boolean | null;
}

export interface ReminderDiagnosticsData {
  readonly collectedAt: string;
  readonly timezone: {
    readonly name: string;
    readonly offsetMinutes: number;
  };
  readonly engineAlive: boolean;
  readonly exactAlarm: ExactAlarmCapability;
  readonly raw: {
    readonly schedules: readonly RawScheduleDiag[];
    readonly assessments: readonly RawAssessmentDiag[];
    readonly calendar_events: readonly RawEventDiag[];
    readonly flashcard_decks: readonly RawDeckDiag[];
  };
  readonly plan: readonly ExpectedPlanItem[];
  readonly osScheduled: readonly OsScheduledItem[];
  readonly diff: readonly DiffItem[];
}

export function computeCanScheduleExactAlarms(
  sdk: number | null,
  scheduleExactAlarmGranted: boolean | null,
  useExactAlarmGranted: boolean | null,
): boolean | null {
  if (sdk === null) return null;
  if (sdk < 31) return true;
  if (scheduleExactAlarmGranted === true || useExactAlarmGranted === true) return true;
  if (scheduleExactAlarmGranted === false && useExactAlarmGranted === false) return false;
  return null;
}

export function formatExactAlarmCapability(c: ExactAlarmCapability): string {
  const boolVal = (v: boolean | null): string => (v === null ? 'n/d' : v ? 'yes' : 'no');
  const manufacturer = `${c.manufacturer ?? 'n/d'}${c.modelName ? ` ${c.modelName}` : ''}`;
  return [
    'Exact alarm capability:',
    `  AlarmManager.canScheduleExactAlarms() = ${boolVal(c.nativeCanScheduleExactAlarms)} (autoritativo)`,
    `  canScheduleExactAlarms() = ${boolVal(c.canScheduleExactAlarms)}`,
    `  SCHEDULE_EXACT_ALARM     = ${boolVal(c.scheduleExactAlarmGranted)}`,
    `  USE_EXACT_ALARM          = ${boolVal(c.useExactAlarmGranted)}`,
    `  battery optimization     = ${boolVal(c.batteryOptimizationIgnored)} (no expuesto en JS)`,
    `  doze whitelist           = ${boolVal(c.dozeWhitelisted)} (no expuesto en JS)`,
    `  manufacturer             = ${manufacturer}`,
    `  SDK (API level)          = ${c.sdk ?? 'n/d'}`,
  ].join('\n');
}

const ALIGN_TOLERANCE_MS = 5000;

export function computeDiff(
  expected: readonly { id: string; scheduledAt: Date }[],
  actual: readonly { identifier: string; triggerDate: Date | null }[],
): DiffItem[] {
  const actualMap = new Map<string, { identifier: string; triggerDate: Date | null }>();
  for (const item of actual) {
    actualMap.set(item.identifier, item);
  }

  const expectedMap = new Map<string, { id: string; scheduledAt: Date }>();
  for (const item of expected) {
    expectedMap.set(item.id, item);
  }

  const diff: DiffItem[] = [];

  for (const item of expected) {
    const osItem = actualMap.get(item.id);
    if (!osItem) {
      diff.push({
        id: item.id,
        status: 'missing',
        expectedAt: item.scheduledAt.toISOString(),
        actualAt: null,
        deltaMs: null,
      });
      continue;
    }
    if (!osItem.triggerDate) {
      diff.push({
        id: item.id,
        status: 'missing',
        expectedAt: item.scheduledAt.toISOString(),
        actualAt: null,
        deltaMs: null,
      });
      continue;
    }
    const deltaMs = osItem.triggerDate.getTime() - item.scheduledAt.getTime();
    diff.push({
      id: item.id,
      status: Math.abs(deltaMs) <= ALIGN_TOLERANCE_MS ? 'aligned' : 'drifted',
      expectedAt: item.scheduledAt.toISOString(),
      actualAt: osItem.triggerDate.toISOString(),
      deltaMs,
    });
  }

  for (const item of actual) {
    if (!expectedMap.has(item.identifier)) {
      diff.push({
        id: item.identifier,
        status: 'orphan',
        expectedAt: null,
        actualAt: item.triggerDate ? item.triggerDate.toISOString() : null,
        deltaMs: null,
      });
    }
  }

  return diff;
}

export function formatDeltaMs(deltaMs: number | null): string {
  if (deltaMs === null) return '—';
  const seconds = Math.round(deltaMs / 1000);
  const sign = seconds > 0 ? '+' : '';
  return `${sign}${seconds}s`;
}

function toLocalTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDiffReport(diff: readonly DiffItem[]): string {
  if (diff.length === 0) return 'Diff: vacío (sin reminders esperados ni agendados)';

  const lines = diff.map((item) => {
    const marker =
      item.status === 'aligned' ? '[OK]' :
      item.status === 'drifted' ? '[DRIFT]' :
      item.status === 'missing' ? '[MISS]' :
      '[ORPHAN]';
    const expected = toLocalTime(item.expectedAt);
    const actual = toLocalTime(item.actualAt);
    const delta = item.status === 'aligned' || item.status === 'drifted' ? formatDeltaMs(item.deltaMs) : '';
    return `${marker} ${item.id} | esperado=${expected} | OS=${actual}${delta ? ` | Δ=${delta}` : ''}`;
  });

  return lines.join('\n');
}

export function logicalScheduleKey(s: RawScheduleDiag): string | null {
  if (s.day_of_week == null || s.start_time == null) return null;
  return `${s.subject_id ?? ''}|${s.day_of_week}|${s.start_time}`;
}

export interface ScheduleGroupDiag {
  readonly key: string;
  readonly subject_id: string | null;
  readonly day_of_week: number | null;
  readonly start_time: string | null;
  readonly rowCount: number;
}

export interface ScheduleAudit {
  readonly physicalRows: number;
  readonly logicalSchedules: number;
  readonly duplicateRows: number;
  readonly unclassifiableRows: number;
  readonly groups: readonly ScheduleGroupDiag[];
}

export function auditSchedules(schedules: readonly RawScheduleDiag[]): ScheduleAudit {
  const groups = new Map<string, { subject_id: string | null; day_of_week: number | null; start_time: string | null; ids: string[] }>();
  let unclassifiableRows = 0;
  for (const s of schedules) {
    const key = logicalScheduleKey(s);
    if (!key) {
      unclassifiableRows++;
      continue;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(s.id);
    } else {
      groups.set(key, {
        subject_id: s.subject_id ?? null,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        ids: [s.id],
      });
    }
  }
  const physicalRows = schedules.length;
  const logicalSchedules = groups.size;
  const duplicateRows = physicalRows - unclassifiableRows - logicalSchedules;
  return {
    physicalRows,
    logicalSchedules,
    duplicateRows,
    unclassifiableRows,
    groups: Array.from(groups.entries()).map(([key, g]) => ({
      key,
      subject_id: g.subject_id,
      day_of_week: g.day_of_week,
      start_time: g.start_time,
      rowCount: g.ids.length,
    })),
  };
}

export interface LayerTrace {
  readonly expectedIntents: number;
  readonly scheduleDesired: number;
  readonly scheduleOs: number;
  readonly desiredIntents: number;
  readonly osScheduled: number;
  readonly dataMultiplier: number;
  readonly offsetsPerScheduleRow: number;
  readonly missing: number;
  readonly orphan: number;
  readonly drifted: number;
  readonly aligned: number;
  readonly reconcilerConverged: boolean;
  readonly status: 'clean' | 'duplicates' | 'drift';
}

export function buildLayerTrace(input: {
  audit: ScheduleAudit;
  plan: readonly ExpectedPlanItem[];
  osScheduled: readonly OsScheduledItem[];
  diff: readonly DiffItem[];
}): LayerTrace {
  const { audit, plan, osScheduled, diff } = input;
  const scheduleDesired = plan.filter((p) => p.entityType === 'schedule').length;
  const scheduleOs = osScheduled.filter((n) => n.identifier.startsWith('schedule::')).length;
  const missing = diff.filter((d) => d.status === 'missing').length;
  const orphan = diff.filter((d) => d.status === 'orphan').length;
  const drifted = diff.filter((d) => d.status === 'drifted').length;
  const aligned = diff.filter((d) => d.status === 'aligned').length;
  const reconcilerConverged = missing === 0 && orphan === 0;
  const dataMultiplier = audit.logicalSchedules > 0 ? audit.physicalRows / audit.logicalSchedules : 0;
  const offsetsPerScheduleRow = audit.physicalRows > 0 ? scheduleDesired / audit.physicalRows : 0;
  const status: LayerTrace['status'] = !reconcilerConverged ? 'drift' : audit.duplicateRows > 0 ? 'duplicates' : 'clean';
  return {
    expectedIntents: audit.logicalSchedules,
    scheduleDesired,
    scheduleOs,
    desiredIntents: plan.length,
    osScheduled: osScheduled.length,
    dataMultiplier,
    offsetsPerScheduleRow,
    missing,
    orphan,
    drifted,
    aligned,
    reconcilerConverged,
    status,
  };
}

export function formatSchedulesAudit(audit: ScheduleAudit): string {
  const L = (k: string, v: string) => `  ${k.padEnd(20)}${v}`;
  const lines = [
    'Schedules Audit',
    '────────────────────',
    L('Physical rows', String(audit.physicalRows)),
    L('Logical schedules', String(audit.logicalSchedules)),
    L('Duplicate rows', String(audit.duplicateRows)),
    L('Unclassifiable rows', String(audit.unclassifiableRows)),
  ];
  const dupGroups = audit.groups.filter((g) => g.rowCount > 1);
  if (dupGroups.length > 0) {
    lines.push('', `Duplicated logical keys (${dupGroups.length}):`);
    for (const g of dupGroups) {
      lines.push(`  dow=${g.day_of_week} start=${g.start_time} subject=${g.subject_id ?? '-'} x${g.rowCount}`);
    }
  }
  return lines.join('\n');
}

export function formatLayerTrace(t: LayerTrace): string {
  const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
  const L = (k: string, v: string) => `  ${k.padEnd(38)}${v}`;
  return [
    'Layer trace',
    '────────────────────',
    L('Expected intents (logicos, tras dedup)', String(t.expectedIntents)),
    L('Schedule desired (engine)', String(t.scheduleDesired)),
    L('Schedule OS', String(t.scheduleOs)),
    L('Total desired (engine)', String(t.desiredIntents)),
    L('Total OS scheduled', String(t.osScheduled)),
    `  Multipliers: data x${num(t.dataMultiplier)} | offsets x${num(t.offsetsPerScheduleRow)} por fila`,
    `  Diff: aligned=${t.aligned} drifted=${t.drifted} missing=${t.missing} orphan=${t.orphan}`,
    L('Reconciler convergence', t.reconcilerConverged ? 'PASS' : 'FAIL'),
    L('Status', t.status.toUpperCase()),
  ].join('\n');
}

export function formatReminderDiagnostics(d: ReminderDiagnosticsData): string {
  const header = [
    `Collected: ${new Date(d.collectedAt).toISOString()}`,
    `Timezone:  ${d.timezone.name} (offset ${d.timezone.offsetMinutes} min)`,
    `Engine:    ${d.engineAlive ? 'alive' : 'destroyed'}`,
    '',
    formatExactAlarmCapability(d.exactAlarm),
    '',
    `Raw rows — schedules=${d.raw.schedules.length} assessments=${d.raw.assessments.length} events=${d.raw.calendar_events.length} decks=${d.raw.flashcard_decks.length}`,
  ];

  const schedules = d.raw.schedules.map((s) =>
    `  SCHED ${s.id} day=${s.day_of_week} ${s.start_time ?? '?'}→${s.end_time ?? '?'} subject=${s.subject_id ?? '-'}`,
  );

  const assessments = d.raw.assessments.map((a) =>
    `  ASMT  ${a.id} date=${a.date ?? '?'} done=${a.is_completed ?? '?'} | ${a.name}`,
  );

  const events = d.raw.calendar_events.map((e) =>
    `  EVT   ${e.id} start=${e.start_date ?? '?'} | ${e.title}`,
  );

  const decks = d.raw.flashcard_decks.map((fk) =>
    `  DECK  ${fk.id} cards=${fk.card_count ?? '?'} | ${fk.title}`,
  );

  const plan = d.plan.map((p) =>
    `  PLAN ${toLocalTime(p.scheduledAt)} ${p.entityType}::${p.entityId} [${p.intent}/${p.priority}] | ${p.title}`,
  );

  const os = d.osScheduled.map((n) =>
    `  OS   ${toLocalTime(n.triggerDate)} ${n.identifier} | ${n.title}`,
  );

  const audit = auditSchedules(d.raw.schedules);
  const trace = buildLayerTrace({ audit, plan: d.plan, osScheduled: d.osScheduled, diff: d.diff });

  const diffBlock = `Diff (${d.diff.length}):\n${formatDiffReport(d.diff)}`;

  return [
    ...header,
    '',
    formatSchedulesAudit(audit),
    '',
    'Raw schedules:',
    ...(schedules.length ? schedules : ['  (ninguno)']),
    '',
    'Raw assessments:',
    ...(assessments.length ? assessments : ['  (ninguno)']),
    '',
    'Raw calendar events:',
    ...(events.length ? events : ['  (ninguno)']),
    '',
    'Raw decks:',
    ...(decks.length ? decks : ['  (ninguno)']),
    '',
    `Plan esperado (${d.plan.length}):`,
    ...(plan.length ? plan : ['  (ninguno)']),
    '',
    `Agendado en SO (${d.osScheduled.length}):`,
    ...(os.length ? os : ['  (ninguno)']),
    '',
    diffBlock,
    '',
    formatLayerTrace(trace),
  ].join('\n');
}
