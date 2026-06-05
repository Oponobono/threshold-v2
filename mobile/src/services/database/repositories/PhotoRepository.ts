import { BaseRepository } from '../BaseRepository';

export interface Photo {
  id: string;
  subject_id: string;
  local_uri?: string;
  created_at?: string;
  es_favorita?: number;
  ocr_text?: string;
  tags?: string;
  cloud_url?: string;
  is_backed_up?: number;
  group_id?: string;
  updated_at?: string;
}

export class PhotoRepository extends BaseRepository<Photo> {
  constructor() {
    super('photos');
  }

  async getBySubject(subjectId: string): Promise<Photo[]> {
    return this.getByField('subject_id', subjectId);
  }
}

export const photoRepository = new PhotoRepository();
