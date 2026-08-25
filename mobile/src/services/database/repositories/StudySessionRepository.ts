import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import type { StudySession } from '../../api/types';

export type { StudySession };

export class StudySessionRepository extends SessionBoundRepository<StudySession> {
  constructor(context: SessionBoundContext) {
    super('study_sessions', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<StudySession>): void {
    if ((data as any).user_id !== undefined && (data as any).user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    (data as any).user_id = this.context.userId;
  }
}

// export const studySessionRepository = new StudySessionRepository();
