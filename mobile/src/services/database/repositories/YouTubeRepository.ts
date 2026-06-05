import { BaseRepository } from '../BaseRepository';
import type { YouTubeVideo } from '../../api/types';

export type { YouTubeVideo };

export class YouTubeRepository extends BaseRepository<YouTubeVideo> {
  constructor() {
    super('youtube_videos');
  }

  async getByUser(userId: string): Promise<YouTubeVideo[]> {
    return this.getByField('user_id', userId);
  }

  async getBySubject(subjectId: string): Promise<YouTubeVideo[]> {
    return this.getByField('subject_id', subjectId);
  }
}

export const youTubeRepository = new YouTubeRepository();
