import { BaseRepository } from '../BaseRepository';

export interface ScannedDocument {
  id: string;
  subject_id?: string;
  user_id: string;
  local_uri?: string;
  ocr_text?: string;
  cloud_url?: string;
  is_backed_up?: number;
  created_at?: string;
  updated_at?: string;
}

export class DocumentRepository extends BaseRepository<ScannedDocument> {
  constructor() {
    super('scanned_documents');
  }

  async getBySubject(subjectId: string): Promise<ScannedDocument[]> {
    return this.getByField('subject_id', subjectId);
  }
}

export const documentRepository = new DocumentRepository();
