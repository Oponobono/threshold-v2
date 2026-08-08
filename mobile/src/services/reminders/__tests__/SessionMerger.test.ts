import { mergeScheduleRows } from '../SessionMerger';

const A = (id: string, over: Partial<Parameters<typeof baseA>[1]> = {}) => ({
  ...baseA(id, over),
});

function baseA(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    subject_id: 'subj-1',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:00',
    name: 'Calculo',
    status: 'active',
    ...over,
  };
}

describe('SessionMerger — contrato congelado (Fase 3)', () => {
  it('A,A,A → [A]: filas idénticas se fusionan en 1 sesión lógica conservando las 3 filas', () => {
    const sessions = mergeScheduleRows([A('a1'), A('a2'), A('a3')]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].classifiable).toBe(true);
    expect(sessions[0].id).toBe('logical::subj-1|1|08%3A00|09%3A00|Calculo');
    expect(sessions[0].subjectId).toBe('subj-1');
    expect(sessions[0].dayOfWeek).toBe(1);
    expect(sessions[0].startTime).toBe('08:00');
    expect(sessions[0].endTime).toBe('09:00');
    expect(sessions[0].name).toBe('Calculo');
    expect(sessions[0].sourceScheduleIds).toEqual(['a1', 'a2', 'a3']);
  });

  it('A,B,A → [A,B]: el resultado no depende del orden de entrada', () => {
    const B = (id: string) => A(id, { day_of_week: 3, start_time: '10:00', end_time: '11:00', name: 'Laboratorio' });
    const input1 = [A('a1'), B('b1'), A('a2')];
    const input2 = [A('a2'), A('a1'), B('b1')];
    const s1 = mergeScheduleRows(input1);
    const s2 = mergeScheduleRows(input2);
    expect(s1).toEqual(s2);
    expect(s1).toHaveLength(2);
    expect(s1.map((s) => s.id)).toEqual(['logical::subj-1|1|08%3A00|09%3A00|Calculo', 'logical::subj-1|3|10%3A00|11%3A00|Laboratorio']);
  });

  it('A,B que parecen similares pero son sesiones distintas (end_time distinto) → [A,B]: no fusiona', () => {
    const B = (id: string) => A(id, { end_time: '11:00' });
    const sessions = mergeScheduleRows([A('a1'), B('b1')]);
    expect(sessions).toHaveLength(2);
    const sourceIds = sessions.map((s) => s.sourceScheduleIds).flat().sort();
    expect(sourceIds).toEqual(['a1', 'b1']);
    expect(sessions.map((s) => s.endTime).sort()).toEqual(['09:00', '11:00']);
  });

  it('A,B que parecen similares pero son sesiones distintas (name distinto) → [A,B]: no fusiona', () => {
    const B = (id: string) => A(id, { name: 'Teoria' });
    const sessions = mergeScheduleRows([A('a1'), B('b1')]);
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.name).sort()).toEqual(['Calculo', 'Teoria']);
  });

  it('misma identidad pero color distinto → [A]: color no distingue sesiones', () => {
    const sessions = mergeScheduleRows([
      A('a1', { color: '#ff0000' }),
      A('a2', { color: '#00ff00' }),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sourceScheduleIds).toEqual(['a1', 'a2']);
  });

  it('misma identidad pero status distinto → [A]: status es estado, no identidad', () => {
    const sessions = mergeScheduleRows([
      A('a1', { status: 'active' }),
      A('a2', { status: 'cancelled' }),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sourceScheduleIds).toEqual(['a1', 'a2']);
  });

  it('day_of_week 7 y 0 son la misma sesión (normalización domingo)', () => {
    const sessions = mergeScheduleRows([
      A('a1', { day_of_week: 7 }),
      A('a2', { day_of_week: 0 }),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].dayOfWeek).toBe(0);
    expect(sessions[0].sourceScheduleIds).toEqual(['a1', 'a2']);
  });

  it('filas no clasificables (sin day_of_week o sin start_time) → sesiones singleton, nada se pierde', () => {
    const sessions = mergeScheduleRows([
      A('a1', { day_of_week: null }),
      A('a2', { start_time: null }),
      A('a3'),
    ]);
    const classifiable = sessions.filter((s) => s.classifiable);
    const singletons = sessions.filter((s) => !s.classifiable);
    expect(classifiable).toHaveLength(1);
    expect(classifiable[0].sourceScheduleIds).toEqual(['a3']);
    expect(singletons).toHaveLength(2);
    for (const s of singletons) {
      expect(s.sourceScheduleIds).toEqual([s.id.slice('logical::row::'.length)]);
    }
  });

  it('determinismo: misma entrada → salida idéntica (deep equal)', () => {
    const B = (id: string) => A(id, { day_of_week: 5, start_time: '14:00' });
    const input = [A('a1'), B('b1'), A('a2'), A('a3', { day_of_week: null })];
    expect(mergeScheduleRows(input)).toEqual(mergeScheduleRows(input));
  });

  it('no pierde filas: la unión de sourceScheduleIds == ids de entrada', () => {
    const B = (id: string) => A(id, { day_of_week: 3, start_time: '10:00' });
    const C = (id: string) => A(id, { subject_id: 'subj-2' });
    const input = [A('a1'), A('a2'), B('b1'), C('c1'), A('u1', { start_time: null })];
    const sessions = mergeScheduleRows(input);
    const absorbed = sessions.flatMap((s) => [...s.sourceScheduleIds]).sort();
    expect(absorbed).toEqual(input.map((r) => r.id).sort());
  });

  it('id determinístico independiente del orden: las sesiones tienen el mismo id con cualquier entrada', () => {
    const B = (id: string) => A(id, { day_of_week: 2, start_time: '09:00' });
    const input1 = [A('a1'), B('b1'), A('a2')];
    const input2 = [B('b1'), A('a1'), A('a2'), A('a3')];
    const ids1 = mergeScheduleRows(input1).map((s) => s.id).sort();
    const ids2 = mergeScheduleRows(input2).map((s) => s.id).sort();
    expect(ids2).toEqual(ids1);
  });

  it('sesiones vacías → sin sesiones', () => {
    expect(mergeScheduleRows([])).toEqual([]);
  });
});

describe('SessionMerger — evidencia (duplicados físicos → 1 intent lógico)', () => {
  it('3 filas duplicadas de la misma clase lógica → exactamente 1 sesión lógica (frontera correcta)', () => {
    const sessions = mergeScheduleRows([A('s-1'), A('s-2'), A('s-3')]);
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    expect(session.sourceScheduleIds).toHaveLength(3);
    // El contrato congelado: la intención es UNA sesión. Los offsets de
    // recordatorio se derivarán de la sesión, no de cada fila física.
    // sourceScheduleIds es diagnóstico y trazabilidad, no multiplicador.
    expect(session.id).toBe('logical::subj-1|1|08%3A00|09%3A00|Calculo');
  });
});
