import { BaseRepository } from '../BaseRepository';

export interface Assessment {
  id: string;
  subject_id: string;
  name: string;
  type?: string;
  date?: string;
  weight?: number;
  out_of?: number;
  score?: number;
  percentage?: number;
  grade_value?: number;
  normalized_value?: number;
  is_completed?: number;
  display_label?: string;
  display_color?: string;
  gpa_equivalent?: number;
  category_id?: string;
  due_date?: string;
  grading_date?: string;
  created_at?: string;
  updated_at?: string;
}

export class AssessmentRepository extends BaseRepository<Assessment> {
  constructor() {
    super('assessments');
  }

  async getBySubject(subjectId: string): Promise<Assessment[]> {
    return this.getByField('subject_id', subjectId);
  }

  async getByCategory(categoryId: string): Promise<Assessment[]> {
    return this.getByField('category_id', categoryId);
  }

  /**
   * Sobrescribe upsert para no perder grade_value existente cuando el servidor
   * devuelve null (ej. por type mismatch en JOIN con assessment_results).
   */
  async upsert(data: Assessment): Promise<void> {
    const existing = await this.getById(data.id);
    if (existing) {
      // Preservar grade_value, normalized_value, score existentes si el servidor los devuelve null
      const merged = { ...data } as any;
      if (data.grade_value == null && existing.grade_value != null) {
        merged.grade_value = existing.grade_value;
      }
      if (data.normalized_value == null && existing.normalized_value != null) {
        merged.normalized_value = existing.normalized_value;
      }
      if ((data.score == null || data.out_of == null) && existing.score != null && existing.out_of != null) {
        merged.score = existing.score;
        merged.out_of = existing.out_of;
      }
      await this.update(data.id, merged as any);
    } else {
      await this.create(data);
    }
  }
}

export const assessmentRepository = new AssessmentRepository();
