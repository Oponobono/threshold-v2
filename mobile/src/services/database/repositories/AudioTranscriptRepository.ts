import { BaseRepository } from '../BaseRepository';

export interface AudioTranscript {
  id: string;
  recording_id: string;
  transcript_uri?: string;
  transcript_text?: string;
  summary_uri?: string;
  summary_text?: string;
  created_at?: string;
  cloud_url?: string;
  is_backed_up?: number | boolean;
}

class AudioTranscriptRepository extends BaseRepository<AudioTranscript> {
  constructor() {
    super('audio_transcripts');
  }

  async getByRecording(recordingId: string): Promise<AudioTranscript | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync('SELECT * FROM audio_transcripts WHERE recording_id = ?', [recordingId]);
    return row ? this.mapRow(row) : null;
  }
}

export const audioTranscriptRepository = new AudioTranscriptRepository();
