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
