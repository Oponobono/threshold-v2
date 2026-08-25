import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import type { YouTubeVideo } from '../../api/types';

export type { YouTubeVideo };

export class YouTubeRepository extends SessionBoundRepository<YouTubeVideo> {
  constructor(context: SessionBoundContext) {
    super('youtube_videos', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<YouTubeVideo>): void {
    if ((data as any).user_id !== undefined && (data as any).user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    (data as any).user_id = this.context.userId;
  }
}

// export const youTubeRepository = new YouTubeRepository();
