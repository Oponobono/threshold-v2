import { calculateSubjectGrade, denormalizeGrade, type CategoryInput, type AssessmentInput, type GradeVersionParams } from '../gradingEngine';

describe('gradingEngine', () => {
  describe('calculateSubjectGrade', () => {
    it('returns 0 for empty assessments', () => {
      const result = calculateSubjectGrade([], []);
      expect(result.normalized_avg_score).toBe(0);
      expect(result.dropped_assessment_ids).toEqual([]);
    });

    it('simple average with no categories', () => {
      const assessments: AssessmentInput[] = [
        { id: 'a1', category_id: null, weight: 1, normalized_value: 0.6 },
        { id: 'a2', category_id: null, weight: 1, normalized_value: 0.8 },
      ];
      const result = calculateSubjectGrade([], assessments);
      expect(result.normalized_avg_score).toBe(0.7);
    });

    it('weighted average within category', () => {
      const categories: CategoryInput[] = [
        { id: 'cat1', name: 'Exams', weight: 60, drop_lowest: 0 },
      ];
      const assessments: AssessmentInput[] = [
        { id: 'a1', category_id: 'cat1', weight: 70, normalized_value: 0.8 },
        { id: 'a2', category_id: 'cat1', weight: 30, normalized_value: 0.6 },
      ];
      const result = calculateSubjectGrade(categories, assessments);
      // 0.8*70 + 0.6*30 = 56+18 = 74 / 100 = 0.74
      expect(result.normalized_avg_score).toBe(0.74);
    });

    it('drop lowest works', () => {
      const categories: CategoryInput[] = [
        { id: 'cat1', name: 'Exams', weight: 100, drop_lowest: 1 },
      ];
      const assessments: AssessmentInput[] = [
        { id: 'a1', category_id: 'cat1', weight: 1, normalized_value: 0.4 },
        { id: 'a2', category_id: 'cat1', weight: 1, normalized_value: 0.8 },
        { id: 'a3', category_id: 'cat1', weight: 1, normalized_value: 0.6 },
      ];
      const result = calculateSubjectGrade(categories, assessments);
      // drops a1 (0.4), average of 0.8 and 0.6 = 0.7
      expect(result.normalized_avg_score).toBe(0.7);
      expect(result.dropped_assessment_ids).toContain('a1');
    });

    it('multi-category with category weights', () => {
      const categories: CategoryInput[] = [
        { id: 'cat1', name: 'Exams', weight: 60, drop_lowest: 0 },
        { id: 'cat2', name: 'Homework', weight: 40, drop_lowest: 0 },
      ];
      const assessments: AssessmentInput[] = [
        { id: 'a1', category_id: 'cat1', weight: 1, normalized_value: 0.8 },
        { id: 'a2', category_id: 'cat2', weight: 1, normalized_value: 0.6 },
      ];
      const result = calculateSubjectGrade(categories, assessments);
      // cat1 avg = 0.8, cat2 avg = 0.6
      // overall = 0.8*60 + 0.6*40 = 48+24 = 72 / 100 = 0.72
      expect(result.normalized_avg_score).toBe(0.72);
    });

    it('ignores assessments without normalized_value', () => {
      const assessments: AssessmentInput[] = [
        { id: 'a1', category_id: null, weight: 1, normalized_value: null },
        { id: 'a2', category_id: null, weight: 1, normalized_value: 0.8 },
      ];
      const result = calculateSubjectGrade([], assessments);
      expect(result.normalized_avg_score).toBe(0.8);
    });

    it('uncategorized assessments grouped separately', () => {
      const categories: CategoryInput[] = [
        { id: 'cat1', name: 'Exams', weight: 60, drop_lowest: 0 },
      ];
      const assessments: AssessmentInput[] = [
        { id: 'a1', category_id: 'cat1', weight: 1, normalized_value: 0.8 },
        { id: 'a2', category_id: null, weight: 1, normalized_value: 0.6 },
      ];
      const result = calculateSubjectGrade(categories, assessments);
      // cat1 avg = 0.8 * 60 = 48
      // uncategorized avg = 0.6 * 1 = 0.6
      // total = 48.6 / 61 = 0.79672...
      expect(result.normalized_avg_score).toBeCloseTo(0.79672, 4);
    });
  });

  describe('denormalizeGrade', () => {
    const colVersion: GradeVersionParams = {
      min_value: 0, max_value: 5, direction: 'ascending', precision: 1,
    };

    it('0.0 → 0.0 on 0-5 scale', () => {
      expect(denormalizeGrade(0, colVersion)).toBe(0);
    });

    it('1.0 → 5.0 on 0-5 scale', () => {
      expect(denormalizeGrade(1, colVersion)).toBe(5);
    });

    it('0.6 → 3.0 on 0-5 scale', () => {
      expect(denormalizeGrade(0.6, colVersion)).toBe(3);
    });

    it('descending direction (German 1-5)', () => {
      const deVersion: GradeVersionParams = {
        min_value: 1, max_value: 5, direction: 'descending', precision: 0,
      };
      // normalized 0 = worst = 5.0
      expect(denormalizeGrade(0, deVersion)).toBe(5);
      // normalized 1 = best = 1.0
      expect(denormalizeGrade(1, deVersion)).toBe(1);
      // normalized 0.5 = middle
      expect(denormalizeGrade(0.5, deVersion)).toBe(3);
    });

    it('0-100 scale', () => {
      const usVersion: GradeVersionParams = {
        min_value: 0, max_value: 100, direction: 'ascending', precision: 0,
      };
      expect(denormalizeGrade(0.85, usVersion)).toBe(85);
      expect(denormalizeGrade(0, usVersion)).toBe(0);
      expect(denormalizeGrade(1, usVersion)).toBe(100);
    });
  });
});
