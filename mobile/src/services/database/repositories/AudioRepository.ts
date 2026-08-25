import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import type { AudioRecording } from '../../api/types';

export type { AudioRecording };

export class AudioRepository extends SessionBoundRepository<AudioRecording> {
  constructor(context: SessionBoundContext) {
    super('audio_recordings', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<AudioRecording>): void {
    if ((data as any).user_id !== undefined && (data as any).user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    (data as any).user_id = this.context.userId;
  }
}

// export const audioRepository = new AudioRepository();
