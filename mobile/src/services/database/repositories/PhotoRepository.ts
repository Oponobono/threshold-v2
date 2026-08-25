import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import { databaseService } from '../DatabaseService';

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

const PHOTO_METADATA_COLS = 'id, subject_id, local_uri, created_at, es_favorita, tags, cloud_url, is_backed_up, group_id, updated_at, user_id, filename, asset_state, sync_version';

export class PhotoRepository extends SessionBoundRepository<Photo> {
  constructor(context: SessionBoundContext) {
    super('photos', context);
  }

  // Indirect: photos → subjects → user_id
  protected buildOwnershipWhereClause(): string {
    return 'EXISTS (SELECT 1 FROM subjects WHERE subjects.id = photos.subject_id AND subjects.user_id = ?)';
  }

  protected async enforceCreateOwnership(data: Partial<Photo>): Promise<void> {
    if (!data.subject_id) throw new Error('ILLEGAL_CREATE: subject_id is required');
    const db = this.getDb();
    if (!db) return;
    const row = await db.getFirstAsync<{user_id: string}>(
      'SELECT user_id FROM subjects WHERE id = ?', [data.subject_id]
    );
    if (!row || row.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: subject_id does not belong to current user');
  }

  /**
   * Lightweight fetch — excludes `ocr_text`.
   */
  async getMetadata(): Promise<Photo[]> {
    this.requireValidSession();
    const rows = await databaseService.getAllTracked(
      `SELECT ${PHOTO_METADATA_COLS} FROM photos
       WHERE deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM subjects WHERE subjects.id = photos.subject_id AND subjects.user_id = ?)
       ORDER BY created_at DESC`,
      [this.context.userId],
      'PhotoRepo.getMetadata'
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async searchByTagOrOcr(subjectId: string, query: string): Promise<Photo[]> {
    this.requireValidSession();
    const pattern = `%${query}%`;
    const db = this.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT * FROM photos
       WHERE subject_id = ?
         AND EXISTS (SELECT 1 FROM subjects WHERE subjects.id = photos.subject_id AND subjects.user_id = ?)
         AND (tags LIKE ? OR ocr_text LIKE ?)
       ORDER BY created_at DESC`,
      [subjectId, this.context.userId, pattern, pattern]
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }
}

// export const photoRepository = new PhotoRepository();
