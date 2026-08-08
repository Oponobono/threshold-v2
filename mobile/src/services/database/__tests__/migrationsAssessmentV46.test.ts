import migrations from '../migrations';

const v46 = migrations.find((m) => m.version === 46);

describe('Migración v46 — Assessment temporal (Reminder Semantics v1.1)', () => {
  test('existe y es el último paso del historial', () => {
    expect(v46).toBeDefined();
    expect(migrations[migrations.length - 1].version).toBe(46);
  });

  test('agrega las 4 columnas temporales exactamente una vez', () => {
    const alters = (v46!.up as string[]).filter((s) => s.startsWith('ALTER TABLE assessments ADD COLUMN'));
    expect(alters).toEqual([
      'ALTER TABLE assessments ADD COLUMN starts_at TEXT',
      'ALTER TABLE assessments ADD COLUMN ends_at TEXT',
      'ALTER TABLE assessments ADD COLUMN due_at TEXT',
      'ALTER TABLE assessments ADD COLUMN assessment_type TEXT',
    ]);
  });

  test('backfill determinista: solo deriva assessment_type, no inventa medianoche', () => {
    const updates = (v46!.up as string[]).filter((s) => s.startsWith('UPDATE assessments'));
    expect(updates).toEqual([
      `UPDATE assessments SET assessment_type = 'exam' WHERE type = 'exam' AND assessment_type IS NULL`,
      `UPDATE assessments SET assessment_type = 'deadline' WHERE type = 'task' AND assessment_type IS NULL`,
    ]);
  });

  test('no contiene ningún UPDATE que rellene starts_at/due_at (nada de medianoche)', () => {
    const updates = (v46!.up as string[]).filter((s) => s.startsWith('UPDATE assessments'));
    expect(updates.some((s) => /starts_at|due_at|ends_at/.test(s))).toBe(false);
  });
});
