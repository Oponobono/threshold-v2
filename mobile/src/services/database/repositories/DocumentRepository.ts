import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
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

export class DocumentRepository extends SessionBoundRepository<ScannedDocument> {
  constructor(context: SessionBoundContext) {
    super('scanned_documents', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<ScannedDocument>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }

  async getAllWithSubjects(): Promise<DocumentWithSubject[]> {
    this.requireValidSession();
    return databaseService.getAllTracked<DocumentWithSubject>(
      `SELECT d.*, s.name as subject_name, s.color as subject_color, s.course_id, c.name as course_name
       FROM scanned_documents d
       LEFT JOIN subjects s ON d.subject_id = s.id
       LEFT JOIN courses c ON s.course_id = c.id
       WHERE d.deleted_at IS NULL AND d.user_id = ?
       ORDER BY d.created_at DESC`,
      [this.context.userId],
      'DocumentRepo.getAllWithSubjects'
    );
  }
}

// export const documentRepository = new DocumentRepository();
