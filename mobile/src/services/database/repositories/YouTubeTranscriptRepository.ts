import { BaseRepository } from '../BaseRepository';

export interface YouTubeTranscript {
  id: string;
  video_id: string;
  transcript_uri?: string;
  transcript_text?: string;
  summary_uri?: string;
  summary_text?: string;
  cloud_url?: string;
  is_backed_up?: number | boolean;
  created_at?: string;
}

class YouTubeTranscriptRepository extends BaseRepository<YouTubeTranscript> {
  constructor() {
    super('youtube_transcripts');
  }

  async getByVideo(videoId: string): Promise<YouTubeTranscript | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync('SELECT * FROM youtube_transcripts WHERE video_id = ?', [videoId]);
    return row ? this.mapRow(row) : null;
  }
}

export const youTubeTranscriptRepository = new YouTubeTranscriptRepository();
