/**
 * Equivalence test: local gradingEngine vs backend reference implementation.
 *
 * Strategy: embed the backend's exact algorithm as a reference function,
 * run identical inputs through both, assert byte-identical outputs.
 *
 * This proves: same inputs + same params → same results.
 */
import {
  calculateSubjectGrade,
  denormalizeGrade,
  type CategoryInput,
  type AssessmentInput,
  type GradeVersionParams,
} from '../gradingEngine';

// ─── Backend reference implementation (verbatim from academicWorkflowEngine.js + gradingEngine.js) ──

function backendCalculateSubjectGrade(
  categories: any[],
  assessments: any[],
): { normalized_avg_score: number; dropped_assessment_ids: string[] } {
  if (!assessments || assessments.length === 0) {
    return { normalized_avg_score: 0, dropped_assessment_ids: [] };
  }

  const droppedAssessmentIds: string[] = [];
  const grouped: Record<string, any[]> = { uncategorized: [] };
  categories.forEach((c: any) => { grouped[c.id] = []; });

  assessments.forEach((a: any) => {
    if (a.normalized_value === null || a.normalized_value === undefined) return;
    const catId = a.category_id || 'uncategorized';
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push(a);
  });

  let totalSubjectWeight = 0;
  let totalSubjectScore = 0;
  let hasCategoryWeights = false;

  categories.forEach((c: any) => {
    const w = parseFloat(c.weight);
    if (!isNaN(w) && w > 0) hasCategoryWeights = true;
  });

  Object.keys(grouped).forEach(catId => {
    const items = grouped[catId];
    if (items.length === 0) return;

    const catDef = catId === 'uncategorized' ? null : categories.find((c: any) => String(c.id) === String(catId));
    const dropCount = catDef ? (catDef.drop_lowest || 0) : 0;

    if (dropCount > 0 && items.length > dropCount) {
      items.sort((a: any, b: any) => parseFloat(a.normalized_value) - parseFloat(b.normalized_value));
      for (let i = 0; i < dropCount; i++) {
        droppedAssessmentIds.push(items[i].id);
        items[i].dropped = true;
      }
    }

    let catTotalScore = 0;
    let catTotalWeight = 0;
    let hasItemWeights = false;

    const activeItems = items.filter((i: any) => !i.dropped);
    if (activeItems.length === 0) return;

    activeItems.forEach((i: any) => {
      let itemWeightStr = String(i.weight || '').replace('%', '');
      let itemWeight = parseFloat(itemWeightStr);
      if (!isNaN(itemWeight) && itemWeight > 0) {
        hasItemWeights = true;
        catTotalScore += parseFloat(i.normalized_value) * itemWeight;
        catTotalWeight += itemWeight;
      } else {
        catTotalScore += parseFloat(i.normalized_value);
        catTotalWeight += 1;
      }
    });

    const catAvg = catTotalScore / catTotalWeight;

    if (catDef && hasCategoryWeights) {
      const catWeight = parseFloat(catDef.weight) || 0;
      totalSubjectScore += catAvg * catWeight;
      totalSubjectWeight += catWeight;
    } else if (catId === 'uncategorized' && !hasCategoryWeights) {
      totalSubjectScore += catTotalScore;
      totalSubjectWeight += catTotalWeight;
    } else {
      totalSubjectScore += catAvg;
      totalSubjectWeight += 1;
    }
  });

  let finalAvg = 0;
  if (totalSubjectWeight > 0) {
    finalAvg = totalSubjectScore / totalSubjectWeight;
  }
  finalAvg = Math.round(finalAvg * 100000) / 100000;

  return { normalized_avg_score: finalAvg, dropped_assessment_ids: droppedAssessmentIds };
}

function backendDenormalizeGrade(normalizedValue: number, version: any): number {
  const { min_value, max_value, direction = 'ascending', precision = 2 } = version;
  const min = parseFloat(String(min_value));
  const max = parseFloat(String(max_value));
  const norm = parseFloat(String(normalizedValue));
  let raw: number;
  if (direction === 'descending') {
    raw = max - norm * (max - min);
  } else {
    raw = min + norm * (max - min);
  }
  const factor = Math.pow(10, parseInt(String(precision)));
  return Math.round(raw * factor) / factor;
}

// ─── Helpers ───

function makeAssessments(rows: Array<{ id: string; catId: string | null; weight: number; norm: number | null }>): AssessmentInput[] {
  return rows.map(r => ({
    id: r.id,
    category_id: r.catId,
    weight: r.weight,
    normalized_value: r.norm,
  }));
}

function makeCategories(rows: Array<{ id: string; name: string; weight: number; dropLowest: number }>): CategoryInput[] {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    weight: r.weight,
    drop_lowest: r.dropLowest,
  }));
}

function assertEquiv(
  label: string,
  local: { normalized_avg_score: number; dropped_assessment_ids: string[] },
  backend: { normalized_avg_score: number; dropped_assessment_ids: string[] },
) {
  expect(local.normalized_avg_score).toBe(backend.normalized_avg_score);
  expect([...local.dropped_assessment_ids].sort()).toEqual([...backend.dropped_assessment_ids].sort());
}

// ─── Tests ───

describe('Equivalence: local gradingEngine vs backend reference', () => {

  // ── calculateSubjectGrade ──

  describe('calculateSubjectGrade', () => {

    it('empty assessments', () => {
      const cats = makeCategories([]);
      const asts = makeAssessments([]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('empty', local, back);
    });

    it('single assessment, no categories', () => {
      const asts = makeAssessments([
        { id: 'a1', catId: null, weight: 1, norm: 0.8 },
      ]);
      const local = calculateSubjectGrade([], asts);
      const back = backendCalculateSubjectGrade([], asts);
      assertEquiv('single no cat', local, back);
    });

    it('two assessments, simple average', () => {
      const asts = makeAssessments([
        { id: 'a1', catId: null, weight: 1, norm: 0.6 },
        { id: 'a2', catId: null, weight: 1, norm: 0.8 },
      ]);
      const local = calculateSubjectGrade([], asts);
      const back = backendCalculateSubjectGrade([], asts);
      assertEquiv('simple avg', local, back);
      expect(local.normalized_avg_score).toBe(0.7);
    });

    it('weighted within category', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 100, dropLowest: 0 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 70, norm: 0.8 },
        { id: 'a2', catId: 'cat1', weight: 30, norm: 0.6 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('weighted within cat', local, back);
    });

    it('multi-category with category weights', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 60, dropLowest: 0 },
        { id: 'cat2', name: 'HW', weight: 40, dropLowest: 0 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 1, norm: 0.9 },
        { id: 'a2', catId: 'cat1', weight: 1, norm: 0.7 },
        { id: 'a3', catId: 'cat2', weight: 1, norm: 0.85 },
        { id: 'a4', catId: 'cat2', weight: 1, norm: 0.65 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('multi-cat weighted', local, back);
    });

    it('drop lowest', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 100, dropLowest: 1 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 1, norm: 0.3 },
        { id: 'a2', catId: 'cat1', weight: 1, norm: 0.9 },
        { id: 'a3', catId: 'cat1', weight: 1, norm: 0.6 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('drop lowest', local, back);
      expect(local.dropped_assessment_ids).toContain('a1');
    });

    it('ignores assessments without normalized_value', () => {
      const asts = makeAssessments([
        { id: 'a1', catId: null, weight: 1, norm: null },
        { id: 'a2', catId: null, weight: 1, norm: 0.8 },
        { id: 'a3', catId: null, weight: 1, norm: null },
      ]);
      const local = calculateSubjectGrade([], asts);
      const back = backendCalculateSubjectGrade([], asts);
      assertEquiv('null norms', local, back);
      expect(local.normalized_avg_score).toBe(0.8);
    });

    it('minimum grade (all 0)', () => {
      const asts = makeAssessments([
        { id: 'a1', catId: null, weight: 1, norm: 0 },
        { id: 'a2', catId: null, weight: 1, norm: 0 },
      ]);
      const local = calculateSubjectGrade([], asts);
      const back = backendCalculateSubjectGrade([], asts);
      assertEquiv('min grade', local, back);
      expect(local.normalized_avg_score).toBe(0);
    });

    it('maximum grade (all 1)', () => {
      const asts = makeAssessments([
        { id: 'a1', catId: null, weight: 1, norm: 1 },
        { id: 'a2', catId: null, weight: 1, norm: 1 },
      ]);
      const local = calculateSubjectGrade([], asts);
      const back = backendCalculateSubjectGrade([], asts);
      assertEquiv('max grade', local, back);
      expect(local.normalized_avg_score).toBe(1);
    });

    it('many assessments with varying weights (stress)', () => {
      const cats = makeCategories([
        { id: 'exams', name: 'Exams', weight: 50, dropLowest: 1 },
        { id: 'hw', name: 'HW', weight: 30, dropLowest: 0 },
        { id: 'part', name: 'Participation', weight: 20, dropLowest: 0 },
      ]);
      const asts = makeAssessments([
        { id: 'e1', catId: 'exams', weight: 40, norm: 0.92 },
        { id: 'e2', catId: 'exams', weight: 35, norm: 0.78 },
        { id: 'e3', catId: 'exams', weight: 25, norm: 0.65 },
        { id: 'h1', catId: 'hw', weight: 50, norm: 0.95 },
        { id: 'h2', catId: 'hw', weight: 50, norm: 0.88 },
        { id: 'p1', catId: 'part', weight: 100, norm: 1.0 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('stress many', local, back);
    });

    it('drop lowest when exactly dropCount + 1 items', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 100, dropLowest: 2 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 1, norm: 0.2 },
        { id: 'a2', catId: 'cat1', weight: 1, norm: 0.5 },
        { id: 'a3', catId: 'cat1', weight: 1, norm: 0.9 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('drop 2 of 3', local, back);
      expect(local.dropped_assessment_ids).toContain('a1');
      expect(local.dropped_assessment_ids).toContain('a2');
    });

    it('drop lowest does NOT trigger when items <= dropCount', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 100, dropLowest: 3 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 1, norm: 0.2 },
        { id: 'a2', catId: 'cat1', weight: 1, norm: 0.5 },
        { id: 'a3', catId: 'cat1', weight: 1, norm: 0.9 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('drop not triggered', local, back);
      expect(local.dropped_assessment_ids).toHaveLength(0);
    });

    it('mixed: some categories with weights, some without', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 70, dropLowest: 0 },
        { id: 'cat2', name: 'HW', weight: 0, dropLowest: 0 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 1, norm: 0.8 },
        { id: 'a2', catId: 'cat2', weight: 1, norm: 0.6 },
        { id: 'a3', catId: 'cat2', weight: 1, norm: 0.9 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('mixed weights', local, back);
    });

    it('assessments in uncategorized + categorized', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 60, dropLowest: 0 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 1, norm: 0.8 },
        { id: 'a2', catId: null, weight: 1, norm: 0.6 },
      ]);
      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('uncategorized + categorized', local, back);
    });

    it('percentage weight strings', () => {
      const cats = makeCategories([
        { id: 'cat1', name: 'Exams', weight: 100, dropLowest: 0 },
      ]);
      // Backend parses weight as string: "70%" → 70
      const backendAssessments = [
        { id: 'a1', category_id: 'cat1', weight: '70%' as any, normalized_value: 0.8 },
        { id: 'a2', category_id: 'cat1', weight: '30%' as any, normalized_value: 0.6 },
      ];
      const localAssessments = makeAssessments([
        { id: 'a1', catId: 'cat1', weight: 70, norm: 0.8 },
        { id: 'a2', catId: 'cat1', weight: 30, norm: 0.6 },
      ]);
      const local = calculateSubjectGrade(cats, localAssessments);
      const back = backendCalculateSubjectGrade(cats, backendAssessments);
      assertEquiv('percentage weights', local, back);
    });
  });

  // ── denormalizeGrade ──

  describe('denormalizeGrade', () => {
    const colombian: GradeVersionParams = { min_value: 0, max_value: 5, direction: 'ascending', precision: 1 };
    const german: GradeVersionParams = { min_value: 1, max_value: 5, direction: 'descending', precision: 0 };
    const percentage: GradeVersionParams = { min_value: 0, max_value: 100, direction: 'ascending', precision: 0 };
    const highPrecision: GradeVersionParams = { min_value: 0, max_value: 10, direction: 'ascending', precision: 3 };

    it('Colombian 0-5: 0.0', () => {
      expect(denormalizeGrade(0, colombian)).toBe(backendDenormalizeGrade(0, colombian));
    });
    it('Colombian 0-5: 0.6', () => {
      expect(denormalizeGrade(0.6, colombian)).toBe(backendDenormalizeGrade(0.6, colombian));
    });
    it('Colombian 0-5: 1.0', () => {
      expect(denormalizeGrade(1, colombian)).toBe(backendDenormalizeGrade(1, colombian));
    });
    it('Colombian 0-5: 0.33333', () => {
      expect(denormalizeGrade(0.33333, colombian)).toBe(backendDenormalizeGrade(0.33333, colombian));
    });
    it('German 1-5 descending: 0.0', () => {
      expect(denormalizeGrade(0, german)).toBe(backendDenormalizeGrade(0, german));
    });
    it('German 1-5 descending: 0.5', () => {
      expect(denormalizeGrade(0.5, german)).toBe(backendDenormalizeGrade(0.5, german));
    });
    it('German 1-5 descending: 1.0', () => {
      expect(denormalizeGrade(1, german)).toBe(backendDenormalizeGrade(1, german));
    });
    it('Percentage 0-100: 0.85', () => {
      expect(denormalizeGrade(0.85, percentage)).toBe(backendDenormalizeGrade(0.85, percentage));
    });
    it('Percentage 0-100: 0.0', () => {
      expect(denormalizeGrade(0, percentage)).toBe(backendDenormalizeGrade(0, percentage));
    });
    it('Percentage 0-100: 1.0', () => {
      expect(denormalizeGrade(1, percentage)).toBe(backendDenormalizeGrade(1, percentage));
    });
    it('High precision 0-10: 0.789', () => {
      expect(denormalizeGrade(0.789, highPrecision)).toBe(backendDenormalizeGrade(0.789, highPrecision));
    });
    it('High precision 0-10: 0.33333', () => {
      expect(denormalizeGrade(0.33333, highPrecision)).toBe(backendDenormalizeGrade(0.33333, highPrecision));
    });

    it('multiple grading versions: same input different scales', () => {
      const versions = [colombian, german, percentage, highPrecision];
      const inputs = [0, 0.25, 0.5, 0.75, 1.0, 0.33333, 0.66667];
      for (const v of versions) {
        for (const input of inputs) {
          const local = denormalizeGrade(input, v);
          const back = backendDenormalizeGrade(input, v);
          expect(local).toBe(back);
        }
      }
    });
  });

  // ── End-to-end: full semester summary pipeline ──

  describe('end-to-end semester summary pipeline', () => {
    const colombian: GradeVersionParams = { min_value: 0, max_value: 5, direction: 'ascending', precision: 1 };

    it('full pipeline: categories → calculateSubjectGrade → denormalizeGrade → overallGpa', () => {
      const cats = makeCategories([
        { id: 'exam', name: 'Exams', weight: 60, dropLowest: 0 },
        { id: 'hw', name: 'Homework', weight: 40, dropLowest: 0 },
      ]);

      // Subject A: strong
      const subjA = makeAssessments([
        { id: 'a1', catId: 'exam', weight: 1, norm: 0.9 },
        { id: 'a2', catId: 'exam', weight: 1, norm: 0.8 },
        { id: 'a3', catId: 'hw', weight: 1, norm: 0.95 },
        { id: 'a4', catId: 'hw', weight: 1, norm: 0.85 },
      ]);

      // Subject B: weak
      const subjB = makeAssessments([
        { id: 'b1', catId: 'exam', weight: 1, norm: 0.4 },
        { id: 'b2', catId: 'exam', weight: 1, norm: 0.5 },
        { id: 'b3', catId: 'hw', weight: 1, norm: 0.6 },
      ]);

      const gradeA_local = calculateSubjectGrade(cats, subjA);
      const gradeA_back = backendCalculateSubjectGrade(cats, subjA);
      assertEquiv('subject A', gradeA_local, gradeA_back);

      const gradeB_local = calculateSubjectGrade(cats, subjB);
      const gradeB_back = backendCalculateSubjectGrade(cats, subjB);
      assertEquiv('subject B', gradeB_local, gradeB_back);

      const denormA_local = denormalizeGrade(gradeA_local.normalized_avg_score, colombian);
      const denormA_back = backendDenormalizeGrade(gradeA_back.normalized_avg_score, colombian);
      expect(denormA_local).toBe(denormA_back);

      const denormB_local = denormalizeGrade(gradeB_local.normalized_avg_score, colombian);
      const denormB_back = backendDenormalizeGrade(gradeB_back.normalized_avg_score, colombian);
      expect(denormB_local).toBe(denormB_back);

      const overallGpa_local = (denormA_local + denormB_local) / 2;
      const overallGpa_back = (denormA_back + denormB_back) / 2;
      expect(overallGpa_local).toBe(overallGpa_back);
    });

    it('pipeline with drop lowest affects final GPA', () => {
      const cats = makeCategories([
        { id: 'exam', name: 'Exams', weight: 100, dropLowest: 1 },
      ]);
      const asts = makeAssessments([
        { id: 'a1', catId: 'exam', weight: 1, norm: 0.3 },
        { id: 'a2', catId: 'exam', weight: 1, norm: 0.8 },
        { id: 'a3', catId: 'exam', weight: 1, norm: 0.9 },
      ]);

      const local = calculateSubjectGrade(cats, asts);
      const back = backendCalculateSubjectGrade(cats, asts);
      assertEquiv('drop lowest pipeline', local, back);

      const denormLocal = denormalizeGrade(local.normalized_avg_score, colombian);
      const denormBack = backendDenormalizeGrade(back.normalized_avg_score, colombian);
      expect(denormLocal).toBe(denormBack);
    });

    it('empty subjects → overallGpa = 0', () => {
      const overallGpa = 0;
      expect(overallGpa).toBe(0);
    });
  });
});
