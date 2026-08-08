import {
  computeDiff,
  formatReminderDiagnostics,
  formatDeltaMs,
  formatDiffReport,
  computeCanScheduleExactAlarms,
  formatExactAlarmCapability,
  auditSchedules,
  buildLayerTrace,
  formatSchedulesAudit,
  formatLayerTrace,
} from '../ReminderDiagnosticsCore';

describe('computeDiff', () => {
  const base = new Date('2026-08-07T09:00:00.000Z');

  it('marca aligned cuando el trigger del SO coincide con el plan', () => {
    const expected = [{ id: 'a', scheduledAt: base }];
    const actual = [{ identifier: 'a', triggerDate: new Date(base.getTime()) }];
    const diff = computeDiff(expected, actual);
    expect(diff).toHaveLength(1);
    expect(diff[0].status).toBe('aligned');
    expect(diff[0].deltaMs).toBe(0);
  });

  it('marca drifted cuando el trigger del SO se desvía del plan', () => {
    const expected = [{ id: 'a', scheduledAt: base }];
    const actual = [{ identifier: 'a', triggerDate: new Date(base.getTime() + 5 * 60000) }];
    const diff = computeDiff(expected, actual);
    expect(diff[0].status).toBe('drifted');
    expect(diff[0].deltaMs).toBe(300000);
  });

  it('marca missing cuando el plan no está agendado en el SO', () => {
    const expected = [
      { id: 'a', scheduledAt: base },
      { id: 'b', scheduledAt: base },
    ];
    const actual = [{ identifier: 'a', triggerDate: base }];
    const diff = computeDiff(expected, actual);
    const missing = diff.filter((d) => d.status === 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].id).toBe('b');
    expect(missing[0].actualAt).toBeNull();
  });

  it('marca missing cuando el trigger del SO es null', () => {
    const expected = [{ id: 'a', scheduledAt: base }];
    const actual = [{ identifier: 'a', triggerDate: null }];
    const diff = computeDiff(expected, actual);
    expect(diff[0].status).toBe('missing');
  });

  it('marca orphan cuando el SO tiene notificaciones fuera del plan', () => {
    const expected = [{ id: 'a', scheduledAt: base }];
    const actual = [
      { identifier: 'a', triggerDate: base },
      { identifier: 'zombie', triggerDate: new Date(base.getTime() + 60000) },
    ];
    const diff = computeDiff(expected, actual);
    const orphan = diff.filter((d) => d.status === 'orphan');
    expect(orphan).toHaveLength(1);
    expect(orphan[0].id).toBe('zombie');
  });
});

describe('formatDeltaMs', () => {
  it('formatea segundos con signo', () => {
    expect(formatDeltaMs(300000)).toBe('+300s');
    expect(formatDeltaMs(-60000)).toBe('-60s');
    expect(formatDeltaMs(null)).toBe('—');
  });
});

describe('formatDiffReport', () => {
  it('produce marcadores por estado', () => {
    const base = new Date('2026-08-07T09:00:00.000Z');
    const report = formatDiffReport([
      { id: 'ok1', status: 'aligned', expectedAt: base.toISOString(), actualAt: base.toISOString(), deltaMs: 0 },
      { id: 'dr1', status: 'drifted', expectedAt: base.toISOString(), actualAt: new Date(base.getTime() + 60000).toISOString(), deltaMs: 60000 },
      { id: 'ms1', status: 'missing', expectedAt: base.toISOString(), actualAt: null, deltaMs: null },
      { id: 'or1', status: 'orphan', expectedAt: null, actualAt: base.toISOString(), deltaMs: null },
    ]);
    expect(report).toContain('[OK] ok1');
    expect(report).toContain('[DRIFT] dr1');
    expect(report).toContain('[MISS] ms1');
    expect(report).toContain('[ORPHAN] or1');
    expect(report).toContain('Δ=+60s');
  });

  it('devuelve mensaje para diff vacío', () => {
    expect(formatDiffReport([])).toContain('vacío');
  });
});

describe('formatReminderDiagnostics', () => {
  it('imprime timezone, filas crudas, plan, SO y diff', () => {
    const base = new Date('2026-08-07T06:00:00.000Z');
    const report = formatReminderDiagnostics({
      collectedAt: '2026-08-07T10:00:00.000Z',
      timezone: { name: 'America/Argentina/Buenos_Aires', offsetMinutes: 180 },
      engineAlive: true,
      exactAlarm: {
        platform: 'android',
        sdk: 34,
        manufacturer: 'xiaomi',
        modelName: 'M2102J20SG',
        scheduleExactAlarmGranted: false,
        useExactAlarmGranted: false,
        nativeCanScheduleExactAlarms: false,
        canScheduleExactAlarms: false,
        batteryOptimizationIgnored: null,
        dozeWhitelisted: null,
      },
      raw: {
        schedules: [{ id: 'sch1', day_of_week: 4, start_time: '06:00', end_time: '07:00', subject_id: 'sub1' }],
        assessments: [{ id: 'as1', name: 'Parcial', date: '10-08-2026', is_completed: 0 }],
        calendar_events: [],
        flashcard_decks: [{ id: 'dk1', title: 'Bio', card_count: 12 }],
      },
      plan: [{ id: 'sch1::0', scheduledAt: base.toISOString(), entityType: 'schedule', entityId: 'sch1', intent: 'attend_class', priority: 'high', title: 'Clase' }],
      osScheduled: [{ identifier: 'sch1::0', title: 'Clase', body: '', triggerDate: base.toISOString() }],
      diff: [{ id: 'sch1::0', status: 'aligned', expectedAt: base.toISOString(), actualAt: base.toISOString(), deltaMs: 0 }],
    });

    expect(report).toContain('America/Argentina/Buenos_Aires');
    expect(report).toContain('offset 180 min');
    expect(report).toContain('Exact alarm capability:');
    expect(report).toContain('canScheduleExactAlarms() = no');
    expect(report).toContain('SCHEDULE_EXACT_ALARM     = no');
    expect(report).toContain('manufacturer             = xiaomi M2102J20SG');
    expect(report).toContain('SDK (API level)          = 34');
    expect(report).toContain('SCHED sch1 day=4 06:00→07:00');
    expect(report).toContain('ASMT  as1 date=10-08-2026 done=0');
    expect(report).toContain('DECK  dk1 cards=12');
    expect(report).toContain('PLAN');
    expect(report).toContain('OS   ');
    expect(report).toContain('[OK]');
  });
});

describe('computeCanScheduleExactAlarms', () => {
  it('Android < 12 (sdk < 31) siempre puede agendar exacto', () => {
    expect(computeCanScheduleExactAlarms(30, false, false)).toBe(true);
    expect(computeCanScheduleExactAlarms(29, null, null)).toBe(true);
  });

  it('Android 12+ con SCHEDULE_EXACT_ALARM granted → true', () => {
    expect(computeCanScheduleExactAlarms(34, true, false)).toBe(true);
    expect(computeCanScheduleExactAlarms(31, true, null)).toBe(true);
  });

  it('Android 12+ con USE_EXACT_ALARM granted → true', () => {
    expect(computeCanScheduleExactAlarms(34, false, true)).toBe(true);
  });

  it('Android 12+ sin ninguno de los dos → false', () => {
    expect(computeCanScheduleExactAlarms(34, false, false)).toBe(false);
    expect(computeCanScheduleExactAlarms(33, false, false)).toBe(false);
  });

  it('sdk desconocido → null', () => {
    expect(computeCanScheduleExactAlarms(null, false, false)).toBeNull();
  });
});

describe('formatExactAlarmCapability', () => {
  it('formatea permisos y datos de dispositivo', () => {
    const report = formatExactAlarmCapability({
      platform: 'android',
      sdk: 34,
      manufacturer: 'xiaomi',
      modelName: null,
      scheduleExactAlarmGranted: false,
      useExactAlarmGranted: null,
      nativeCanScheduleExactAlarms: false,
      canScheduleExactAlarms: false,
      batteryOptimizationIgnored: null,
      dozeWhitelisted: null,
    });
    expect(report).toContain('AlarmManager.canScheduleExactAlarms() = no (autoritativo)');
    expect(report).toContain('canScheduleExactAlarms() = no');
    expect(report).toContain('SCHEDULE_EXACT_ALARM     = no');
    expect(report).toContain('USE_EXACT_ALARM          = n/d');
    expect(report).toContain('battery optimization     = n/d');
    expect(report).toContain('manufacturer             = xiaomi');
    expect(report).toContain('SDK (API level)          = 34');
  });

  it('marca yes cuando el permiso está concedido', () => {
    const report = formatExactAlarmCapability({
      platform: 'android',
      sdk: 34,
      manufacturer: 'google',
      modelName: 'Pixel 8',
      scheduleExactAlarmGranted: true,
      useExactAlarmGranted: false,
      nativeCanScheduleExactAlarms: true,
      canScheduleExactAlarms: true,
      batteryOptimizationIgnored: null,
      dozeWhitelisted: null,
    });
    expect(report).toContain('AlarmManager.canScheduleExactAlarms() = yes (autoritativo)');
    expect(report).toContain('canScheduleExactAlarms() = yes');
    expect(report).toContain('manufacturer             = google Pixel 8');
  });

  it('nativo null (módulo no disponible) → canScheduleExactAlarms usa el fallback de permisos', () => {
    const report = formatExactAlarmCapability({
      platform: 'android',
      sdk: 34,
      manufacturer: null,
      modelName: null,
      scheduleExactAlarmGranted: true,
      useExactAlarmGranted: null,
      nativeCanScheduleExactAlarms: null,
      canScheduleExactAlarms: true,
      batteryOptimizationIgnored: null,
      dozeWhitelisted: null,
    });
    expect(report).toContain('AlarmManager.canScheduleExactAlarms() = n/d (autoritativo)');
    expect(report).toContain('canScheduleExactAlarms() = yes');
  });
});


describe('auditSchedules', () => {
  it('agrupa por clase logica (subject+day+start) y cuenta duplicados', () => {
    const rows = [
      { id: 's1', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
      { id: 's2', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
      { id: 's3', day_of_week: 2, start_time: '10:00', end_time: '11:00', subject_id: 'sub1' },
      { id: 's4', day_of_week: 2, start_time: '10:00', end_time: '11:00', subject_id: 'sub2' },
    ];
    const audit = auditSchedules(rows);
    expect(audit.physicalRows).toBe(4);
    expect(audit.logicalSchedules).toBe(3);
    expect(audit.duplicateRows).toBe(1);
    expect(audit.unclassifiableRows).toBe(0);
    const dup = audit.groups.find((g) => g.rowCount > 1);
    expect(dup?.key).toBe('sub1|1|08:00');
  });

  it('marca filas sin start_time como no clasificables', () => {
    const audit = auditSchedules([
      { id: 's1', day_of_week: 1, start_time: null, end_time: null },
      { id: 's2', day_of_week: null, start_time: '08:00', end_time: null },
    ]);
    expect(audit.unclassifiableRows).toBe(2);
    expect(audit.logicalSchedules).toBe(0);
    expect(audit.duplicateRows).toBe(0);
  });
});

describe('buildLayerTrace', () => {
  it('status=duplicates cuando hay filas duplicadas y el diff converge', () => {
    const audit = auditSchedules([
      { id: 's1', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
      { id: 's2', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
    ]);
    const trace = buildLayerTrace({
      audit,
      plan: [
        { id: 'schedule::s1::0', scheduledAt: '2026-08-10T08:00:00.000Z', entityType: 'schedule', entityId: 's1', intent: 'attend_class', priority: 'high', title: 'Clase' },
        { id: 'schedule::s2::0', scheduledAt: '2026-08-10T08:00:00.000Z', entityType: 'schedule', entityId: 's2', intent: 'attend_class', priority: 'high', title: 'Clase' },
      ],
      osScheduled: [
        { identifier: 'schedule::s1::0', title: '', body: '', triggerDate: '2026-08-10T08:00:00.000Z' },
        { identifier: 'schedule::s2::0', title: '', body: '', triggerDate: '2026-08-10T08:00:00.000Z' },
      ],
      diff: [
        { id: 'schedule::s1::0', status: 'aligned', expectedAt: '2026-08-10T08:00:00.000Z', actualAt: '2026-08-10T08:00:00.000Z', deltaMs: 0 },
        { id: 'schedule::s2::0', status: 'aligned', expectedAt: '2026-08-10T08:00:00.000Z', actualAt: '2026-08-10T08:00:00.000Z', deltaMs: 0 },
      ],
    });
    expect(trace.expectedIntents).toBe(1);
    expect(trace.scheduleDesired).toBe(2);
    expect(trace.scheduleOs).toBe(2);
    expect(trace.dataMultiplier).toBe(2);
    expect(trace.reconcilerConverged).toBe(true);
    expect(trace.status).toBe('duplicates');
  });

  it('status=clean sin duplicados y con diffs alineados', () => {
    const audit = auditSchedules([
      { id: 's1', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
    ]);
    const trace = buildLayerTrace({
      audit,
      plan: [{ id: 'schedule::s1::0', scheduledAt: '2026-08-10T08:00:00.000Z', entityType: 'schedule', entityId: 's1', intent: 'attend_class', priority: 'high', title: 'Clase' }],
      osScheduled: [{ identifier: 'schedule::s1::0', title: '', body: '', triggerDate: '2026-08-10T08:00:00.000Z' }],
      diff: [{ id: 'schedule::s1::0', status: 'aligned', expectedAt: '2026-08-10T08:00:00.000Z', actualAt: '2026-08-10T08:00:00.000Z', deltaMs: 0 }],
    });
    expect(trace.status).toBe('clean');
    expect(trace.dataMultiplier).toBe(1);
  });

  it('status=drift cuando hay missing/orphan en el diff', () => {
    const audit = auditSchedules([
      { id: 's1', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
    ]);
    const trace = buildLayerTrace({
      audit,
      plan: [{ id: 'schedule::s1::0', scheduledAt: '2026-08-10T08:00:00.000Z', entityType: 'schedule', entityId: 's1', intent: 'attend_class', priority: 'high', title: 'Clase' }],
      osScheduled: [],
      diff: [{ id: 'schedule::s1::0', status: 'missing', expectedAt: '2026-08-10T08:00:00.000Z', actualAt: null, deltaMs: null }],
    });
    expect(trace.status).toBe('drift');
    expect(trace.reconcilerConverged).toBe(false);
  });
});

describe('formatSchedulesAudit / formatLayerTrace', () => {
  it('imprime el bloque de auditoria con las filas duplicadas', () => {
    const audit = auditSchedules([
      { id: 's1', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
      { id: 's2', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
    ]);
    const text = formatSchedulesAudit(audit);
    expect(text).toContain('Schedules Audit');
    expect(text).toContain('Physical rows'.padEnd(20) + '2');
    expect(text).toContain('Logical schedules'.padEnd(20) + '1');
    expect(text).toContain('Duplicate rows'.padEnd(20) + '1');
  });

  it('imprime el bloque de layer trace con el multiplicador', () => {
    const audit = auditSchedules([]);
    const trace = buildLayerTrace({ audit, plan: [], osScheduled: [], diff: [] });
    const text = formatLayerTrace(trace);
    expect(text).toContain('Layer trace');
    expect(text).toContain('data x0');
    expect(text).toContain('Status'.padEnd(38) + 'CLEAN');
  });

  it('formatReminderDiagnostics incluye Schedules Audit y Layer trace', () => {
    const report = formatReminderDiagnostics({
      collectedAt: '2026-08-07T10:00:00.000Z',
      timezone: { name: 'America/Bogota', offsetMinutes: -300 },
      engineAlive: true,
      exactAlarm: {
        platform: 'android',
        sdk: 34,
        manufacturer: 'xiaomi',
        modelName: 'M2102J20SG',
        scheduleExactAlarmGranted: false,
        useExactAlarmGranted: false,
        nativeCanScheduleExactAlarms: false,
        canScheduleExactAlarms: false,
        batteryOptimizationIgnored: null,
        dozeWhitelisted: null,
      },
      raw: {
        schedules: [
          { id: 's1', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
          { id: 's2', day_of_week: 1, start_time: '08:00', end_time: '09:00', subject_id: 'sub1' },
        ],
        assessments: [],
        calendar_events: [],
        flashcard_decks: [],
      },
      plan: [{ id: 'schedule::s1::0', scheduledAt: '2026-08-10T08:00:00.000Z', entityType: 'schedule', entityId: 's1', intent: 'attend_class', priority: 'high', title: 'Clase' }],
      osScheduled: [{ identifier: 'schedule::s1::0', title: 'Clase', body: '', triggerDate: '2026-08-10T08:00:00.000Z' }],
      diff: [{ id: 'schedule::s1::0', status: 'aligned', expectedAt: '2026-08-10T08:00:00.000Z', actualAt: '2026-08-10T08:00:00.000Z', deltaMs: 0 }],
    });
    expect(report).toContain('Schedules Audit');
    expect(report).toContain('Duplicate rows'.padEnd(20) + '1');
    expect(report).toContain('Layer trace');
    expect(report).toContain('Status'.padEnd(38) + 'DUPLICATES');
  });
});
