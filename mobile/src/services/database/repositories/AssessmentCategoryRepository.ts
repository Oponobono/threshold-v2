import { BaseRepository } from '../BaseRepository';
import type { AssessmentCategory } from '../../api/types';

export type { AssessmentCategory };

export class AssessmentCategoryRepository extends BaseRepository<AssessmentCategory> {
  constructor() {
    super('assessment_categories');
  }

  async getBySubject(subjectId: string): Promise<AssessmentCategory[]> {
    return this.getByField('subject_id', subjectId);
  }
}

export const assessmentCategoryRepository = new AssessmentCategoryRepository();
