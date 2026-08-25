import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

export interface YouTubeTranscript {
  id: string;
  video_id: string;
  user_id?: string;
  transcript_uri?: string;
  transcript_text?: string;
  summary_uri?: string;
  summary_text?: string;
  cloud_url?: string;
  is_backed_up?: number | boolean;
  created_at?: string;
  sync_version?: number;
  version_number?: number;
  last_modified_by?: string;
  deleted_at?: string;
}

export class YouTubeTranscriptRepository extends SessionBoundRepository<YouTubeTranscript> {
  constructor(context: SessionBoundContext) {
    super('youtube_transcripts', context);
  }

  // Indirect: youtube_transcript → youtube_video → user_id
  protected buildOwnershipWhereClause(): string {
    return 'EXISTS (SELECT 1 FROM youtube_videos WHERE youtube_videos.id = youtube_transcripts.video_id AND youtube_videos.user_id = ?)';
  }

  protected async enforceCreateOwnership(data: Partial<YouTubeTranscript>): Promise<void> {
    if (!data.video_id) throw new Error('ILLEGAL_CREATE: video_id is required');
    const db = this.getDb();
    if (!db) return;
    const row = await db.getFirstAsync<{user_id: string}>(
      'SELECT user_id FROM youtube_videos WHERE id = ?', [data.video_id]
    );
    if (!row || row.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: video_id does not belong to current user');
  }

  async getByVideo(videoId: string): Promise<YouTubeTranscript | null> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return null;
    const row = await db.getFirstAsync<YouTubeTranscript>(
      `SELECT yt.* FROM youtube_transcripts yt
       JOIN youtube_videos v ON v.id = yt.video_id
       WHERE yt.video_id = ? AND v.user_id = ? AND yt.deleted_at IS NULL`,
      [videoId, this.context.userId]
    );
    return row ? this.mapRow(row) : null;
  }
}

// export const youTubeTranscriptRepository = new YouTubeTranscriptRepository();
