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
}

export const assessmentRepository = new AssessmentRepository();
