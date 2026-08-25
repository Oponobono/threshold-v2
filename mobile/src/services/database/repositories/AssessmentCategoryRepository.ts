import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import type { AssessmentCategory } from '../../api/types';

export type { AssessmentCategory };

export class AssessmentCategoryRepository extends SessionBoundRepository<AssessmentCategory> {
  constructor(context: SessionBoundContext) {
    super('assessment_categories', context);
  }

  // Indirect ownership: category → subject → user_id
  protected buildOwnershipWhereClause(): string {
    return 'EXISTS (SELECT 1 FROM subjects WHERE subjects.id = assessment_categories.subject_id AND subjects.user_id = ?)';
  }

  protected async enforceCreateOwnership(data: Partial<AssessmentCategory>): Promise<void> {
    if (!data.subject_id) throw new Error('ILLEGAL_CREATE: subject_id is required');
    const db = this.getDb();
    if (!db) return;
    const row = await db.getFirstAsync<{user_id: string}>(
      'SELECT user_id FROM subjects WHERE id = ?', [data.subject_id]
    );
    if (!row || row.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: subject_id does not belong to current user');
  }
}

// export const assessmentCategoryRepository = new AssessmentCategoryRepository();
