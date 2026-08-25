import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

export interface AudioTranscript {
  id: string;
  recording_id: string;
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

export class AudioTranscriptRepository extends SessionBoundRepository<AudioTranscript> {
  constructor(context: SessionBoundContext) {
    super('audio_transcripts', context);
  }

  // Indirect: audio_transcript → audio_recording → user_id
  protected buildOwnershipWhereClause(): string {
    return 'EXISTS (SELECT 1 FROM audio_recordings WHERE audio_recordings.id = audio_transcripts.recording_id AND audio_recordings.user_id = ?)';
  }

  protected async enforceCreateOwnership(data: Partial<AudioTranscript>): Promise<void> {
    if (!data.recording_id) throw new Error('ILLEGAL_CREATE: recording_id is required');
    const db = this.getDb();
    if (!db) return;
    const row = await db.getFirstAsync<{user_id: string}>(
      'SELECT user_id FROM audio_recordings WHERE id = ?', [data.recording_id]
    );
    if (!row || row.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: recording_id does not belong to current user');
  }

  async getByRecording(recordingId: string): Promise<AudioTranscript | null> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return null;
    const row = await db.getFirstAsync<AudioTranscript>(
      `SELECT at.* FROM audio_transcripts at 
       JOIN audio_recordings ar ON ar.id = at.recording_id 
       WHERE at.recording_id = ? AND ar.user_id = ? AND at.deleted_at IS NULL`,
      [recordingId, this.context.userId]
    );
    return row ? this.mapRow(row) : null;
  }
}

// export const audioTranscriptRepository = new AudioTranscriptRepository();
