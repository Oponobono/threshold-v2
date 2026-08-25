import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

export interface AssessmentFile {
  id: string;
  assessment_id: string;
  file_name: string;
  file_type?: string;
  local_uri?: string;
  cloud_url?: string;
  file_size?: number;
  is_backed_up?: number | boolean;
  created_at?: string;
}

export class AssessmentFileRepository extends SessionBoundRepository<AssessmentFile> {
  constructor(context: SessionBoundContext) {
    super('assessment_files', context);
  }

  // Indirect: assessment_file → assessment → subject → user_id
  protected buildOwnershipWhereClause(): string {
    return `EXISTS (
      SELECT 1 FROM assessments a
      JOIN subjects s ON s.id = a.subject_id
      WHERE a.id = assessment_files.assessment_id
        AND s.user_id = ?
    )`;
  }

  protected async enforceCreateOwnership(data: Partial<AssessmentFile>): Promise<void> {
    if (!data.assessment_id) throw new Error('ILLEGAL_CREATE: assessment_id is required');
    const db = this.getDb();
    if (!db) return;
    const row = await db.getFirstAsync<{user_id: string}>(
      `SELECT s.user_id FROM assessments a JOIN subjects s ON s.id = a.subject_id WHERE a.id = ?`,
      [data.assessment_id]
    );
    if (!row || row.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: assessment_id does not belong to current user');
  }
}

// export const assessmentFileRepository = new AssessmentFileRepository();
