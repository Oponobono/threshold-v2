import { BaseRepository } from '../BaseRepository';
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

// Columns that are safe to fetch without ocr_text (avoids reading overflow pages)
const PHOTO_METADATA_COLS = 'id, subject_id, local_uri, created_at, es_favorita, tags, cloud_url, is_backed_up, group_id, updated_at, user_id, filename, asset_state, sync_version';

export class PhotoRepository extends BaseRepository<Photo> {
  constructor() {
    super('photos');
  }

  /**
   * Lightweight fetch — excludes `ocr_text`.
   * Use this for preloads, galleries, and any context that does not need OCR content.
   * Avoids reading SQLite overflow pages for large text cells (~400ms → target <20ms).
   */
  async getMetadata(): Promise<Photo[]> {
    const rows = await databaseService.getAllTracked(
      `SELECT ${PHOTO_METADATA_COLS} FROM photos WHERE deleted_at IS NULL ORDER BY created_at DESC`,
      undefined,
      'BaseRepo.photos.getMetadata'
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async getBySubject(subjectId: string): Promise<Photo[]> {
    return this.getByField('subject_id', subjectId);
  }

  /**
   * Busca fotos por tag u OCR text dentro de una materia.
   * Busca en la columna `tags` (JSON/string) y en `ocr_text` (texto extraído).
   * Funciona 100% offline desde SQLite local.
   */
  async searchByTagOrOcr(subjectId: string, query: string): Promise<Photo[]> {
    const pattern = `%${query}%`;
    const rows = await this.getDb().getAllAsync(
      `SELECT * FROM photos
       WHERE subject_id = ?
         AND (tags LIKE ? OR ocr_text LIKE ?)
       ORDER BY created_at DESC`,
      subjectId, pattern, pattern
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }
}

export const photoRepository = new PhotoRepository();

