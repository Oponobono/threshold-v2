import { BaseRepository } from '../BaseRepository';
import { databaseService } from '../DatabaseService';

export interface ScannedDocument {
  id: string;
  subject_id?: string;
  user_id: string;
  local_uri?: string;
  ocr_text?: string;
  cloud_url?: string;
  is_backed_up?: number;
  name?: string;
  filename?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface DocumentWithSubject extends ScannedDocument {
  subject_name?: string;
  subject_color?: string;
  course_id?: string | null;
  course_name?: string | null;
}

export class DocumentRepository extends BaseRepository<ScannedDocument> {
  constructor() {
    super('scanned_documents');
  }

  async getBySubject(subjectId: string): Promise<ScannedDocument[]> {
    return this.getByField('subject_id', subjectId);
  }

  async getAllWithSubjects(): Promise<DocumentWithSubject[]> {
    return databaseService.getAllTracked<DocumentWithSubject>(
      `SELECT d.*, s.name as subject_name, s.color as subject_color, s.course_id, c.name as course_name
       FROM scanned_documents d
       LEFT JOIN subjects s ON d.subject_id = s.id
       LEFT JOIN courses c ON s.course_id = c.id
       WHERE d.deleted_at IS NULL
       ORDER BY d.created_at DESC`,
      undefined,
      'DocumentRepo.getAllWithSubjects'
    );
  }
}

export const documentRepository = new DocumentRepository();
