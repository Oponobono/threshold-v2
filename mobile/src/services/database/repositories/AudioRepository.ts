import { BaseRepository } from '../BaseRepository';
import type { AudioRecording } from '../../api/types';

export type { AudioRecording };

export class AudioRepository extends BaseRepository<AudioRecording> {
  constructor() {
    super('audio_recordings');
  }

  async getByUser(userId: string): Promise<AudioRecording[]> {
    return this.getByField('user_id', userId);
  }

  async getBySubject(subjectId: string): Promise<AudioRecording[]> {
    return this.getByField('subject_id', subjectId);
  }
}

export const audioRepository = new AudioRepository();
