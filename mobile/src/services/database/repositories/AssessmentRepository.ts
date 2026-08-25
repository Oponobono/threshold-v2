import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

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
  starts_at?: string;
  ends_at?: string;
  due_at?: string;
  assessment_type?: string;
  created_at?: string;
  updated_at?: string;
}

export class AssessmentRepository extends SessionBoundRepository<Assessment> {
  constructor(context: SessionBoundContext) {
    super('assessments', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'EXISTS (SELECT 1 FROM subjects WHERE subjects.id = assessments.subject_id AND subjects.user_id = ?)';
  }

  protected async enforceCreateOwnership(data: Partial<Assessment>): Promise<void> {
    if (!data.subject_id) {
      throw new Error('ILLEGAL_CREATE: subject_id is required to create an assessment');
    }
    const db = this.getDb();
    if (!db) return;
    const row = await db.getFirstAsync<{user_id: string}>('SELECT user_id FROM subjects WHERE id = ?', [data.subject_id]);
    if (!row || row.user_id !== this.context.userId) {
      throw new Error('ILLEGAL_CREATE: The provided subject_id does not belong to the current user');
    }
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
    const existing = await this.getByIdIncludingDeleted(data.id);
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

// export const assessmentRepository = new AssessmentRepository();
