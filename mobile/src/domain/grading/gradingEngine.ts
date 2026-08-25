export interface GradeVersionParams {
  min_value: number;
  max_value: number;
  direction: 'ascending' | 'descending';
  precision: number;
}

export interface CategoryInput {
  id: string;
  name: string;
  weight: number;
  drop_lowest: number;
}

export interface AssessmentInput {
  id: string;
  category_id: string | null;
  weight: number;
  normalized_value: number | null;
}

export function calculateSubjectGrade(
  categories: CategoryInput[],
  assessments: AssessmentInput[],
): { normalized_avg_score: number; dropped_assessment_ids: string[]; category_averages: Record<string, number> } {
  if (assessments.length === 0) {
    return { normalized_avg_score: 0, dropped_assessment_ids: [], category_averages: {} };
  }

  const droppedAssessmentIds: string[] = [];
  const categoryAverages: Record<string, number> = {};

  const grouped: Record<string, AssessmentInput[]> = { uncategorized: [] };
  categories.forEach(c => { grouped[c.id] = []; });

  assessments.forEach(a => {
    if (a.normalized_value === null || a.normalized_value === undefined) return;
    const catId = a.category_id || 'uncategorized';
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push(a);
  });

  let totalSubjectWeight = 0;
  let totalSubjectScore = 0;
  let hasCategoryWeights = false;

  categories.forEach(c => {
    const w = parseFloat(String(c.weight));
    if (!isNaN(w) && w > 0) hasCategoryWeights = true;
  });

  Object.keys(grouped).forEach(catId => {
    const items = grouped[catId];
    if (items.length === 0) return;

    const catDef = catId === 'uncategorized' ? null : categories.find(c => String(c.id) === String(catId));
    const dropCount = catDef ? (catDef.drop_lowest || 0) : 0;

    if (dropCount > 0 && items.length > dropCount) {
      items.sort((a, b) => (a.normalized_value as number) - (b.normalized_value as number));
      for (let i = 0; i < dropCount; i++) {
        droppedAssessmentIds.push(items[i].id);
        (items[i] as any).dropped = true;
      }
    }

    let catTotalScore = 0;
    let catTotalWeight = 0;
    let hasItemWeights = false;

    const activeItems = items.filter(i => !(i as any).dropped);
    if (activeItems.length === 0) return;

    activeItems.forEach(i => {
      const itemWeight = parseFloat(String(i.weight || '').replace('%', ''));
      if (!isNaN(itemWeight) && itemWeight > 0) {
        hasItemWeights = true;
        catTotalScore += (i.normalized_value as number) * itemWeight;
        catTotalWeight += itemWeight;
      } else {
        catTotalScore += (i.normalized_value as number);
        catTotalWeight += 1;
      }
    });

    const catAvg = catTotalScore / catTotalWeight;
    categoryAverages[catId] = catAvg;

    if (catDef && hasCategoryWeights) {
      const catWeight = parseFloat(String(catDef.weight)) || 0;
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

  return {
    normalized_avg_score: finalAvg,
    dropped_assessment_ids: droppedAssessmentIds,
    category_averages: categoryAverages,
  };
}

export function denormalizeGrade(
  normalizedValue: number,
  version: GradeVersionParams,
): number {
  const { min_value, max_value, direction, precision } = version;
  const min = parseFloat(String(min_value));
  const max = parseFloat(String(max_value));
  const norm = parseFloat(String(normalizedValue));

  let raw: number;
  if (direction === 'descending') {
    raw = max - norm * (max - min);
  } else {
    raw = min + norm * (max - min);
  }

  const factor = Math.pow(10, precision);
  return Math.round(raw * factor) / factor;
}
