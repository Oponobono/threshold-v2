import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import { databaseService } from '../DatabaseService';

const AI_SUMMARY_MAX_LENGTH = 1000;

export interface StudyNoteMedia {
  id: string;
  type: 'image' | 'audio' | 'pdf' | 'video' | 'drawing';
  path: string;
}

export interface StudyNote {
  id: string;
  user_id: string;
  subject_id?: string;
  title?: string;
  content?: string;
  media_paths?: string;
  source?: string;
  origin?: string;
  processing_state?: string;
  ai_summary?: string;
  ai_keywords?: string;
  last_opened_at?: string;
  created_at?: string;
  updated_at?: string;
  sync_version?: number;
  version_number?: number;
  last_modified_by?: string;
  deleted_at?: string;
}

export interface StudyNoteWithSubject extends StudyNote {
  subject_name?: string;
  subject_color?: string;
}

export class StudyNoteRepository extends SessionBoundRepository<StudyNote> {
  constructor(context: SessionBoundContext) {
    super('study_notes', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<StudyNote>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }

  async getAllWithSubjects(): Promise<StudyNoteWithSubject[]> {
    this.requireValidSession();
    return databaseService.getAllTracked<StudyNoteWithSubject>(
      `SELECT n.*, s.name as subject_name, s.color as subject_color
       FROM study_notes n
       LEFT JOIN subjects s ON n.subject_id = s.id
       WHERE n.deleted_at IS NULL AND n.user_id = ?
       ORDER BY n.created_at DESC`,
      [this.context.userId],
      'StudyNoteRepo.getAllWithSubjects'
    );
  }

  async markOpened(noteId: string): Promise<void> {
    this.requireValidSession();
    const db = databaseService.getDb();
    await db.runAsync(
      `UPDATE study_notes SET last_opened_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [noteId, this.context.userId]
    );
  }

  async setProcessingState(noteId: string, state: string): Promise<void> {
    this.requireValidSession();
    const db = databaseService.getDb();
    await db.runAsync(
      `UPDATE study_notes SET processing_state = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [state, noteId, this.context.userId]
    );
  }

  static normalizeKeywords(keywords: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const kw of keywords) {
      const normalized = kw.toLowerCase().trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
    return result;
  }

  static truncateAiSummary(summary: string): string {
    if (summary.length <= AI_SUMMARY_MAX_LENGTH) return summary;
    const truncated = summary.substring(0, AI_SUMMARY_MAX_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > AI_SUMMARY_MAX_LENGTH * 0.8 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }
}

// export const studyNoteRepository = new StudyNoteRepository();
