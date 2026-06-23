import { BaseRepository } from '../BaseRepository';

export interface Subject {
  id: string;
  user_id: string;
  code?: string;
  name: string;
  credits?: number;
  professor?: string;
  color?: string;
  icon?: string;
  target_grade?: number;
  avg_score?: number;
  normalized_avg_score?: number;
  completion_percent?: number;
  display_label?: string;
  display_color?: string;
  gpa_equivalent?: number;
  created_at?: string;
  updated_at?: string;
  course_id?: string | null;
  external_url?: string | null;
  total_lessons?: number;
  completed_lessons?: number;
  next_micro_milestone?: string | null;
}

export class SubjectRepository extends BaseRepository<Subject> {
  constructor() {
    super('subjects');
  }

  async getByUser(userId: string): Promise<Subject[]> {
    return this.getByField('user_id', userId);
  }
}

export const subjectRepository = new SubjectRepository();
