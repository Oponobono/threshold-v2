import { BaseRepository } from '../BaseRepository';
import type { DocumentHighlight, HighlightColor } from '../../../domain/document/DocumentHighlight';

export interface DocumentHighlightRecord {
  id: string;
  document_id: string;
  page_index: number;
  text: string;
  color: string;
  anchor_offset: number;
  focus_offset: number;
  created_at?: string;
  user_id?: string;
  sync_version?: number;
  version_number?: number;
  last_modified_by?: string;
  deleted_at?: string;
}

export class HighlightRepository extends BaseRepository<DocumentHighlightRecord> {
  constructor() {
    super('document_highlights');
  }

  async getByDocument(documentId: string): Promise<DocumentHighlight[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<DocumentHighlightRecord>(
      'SELECT * FROM document_highlights WHERE document_id = ? AND deleted_at IS NULL ORDER BY page_index, anchor_offset',
      [documentId],
    );
    return rows.map(r => this._toHighlight(r));
  }

  async save(highlight: DocumentHighlight, userId?: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO document_highlights
         (id, document_id, page_index, text, color, anchor_offset, focus_offset, created_at, user_id,
          sync_version, version_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
          COALESCE((SELECT sync_version FROM document_highlights WHERE id = ?), 0),
          COALESCE((SELECT version_number FROM document_highlights WHERE id = ?), 0) + 1)
       ON CONFLICT(id) DO UPDATE SET
         text = excluded.text,
         color = excluded.color,
         anchor_offset = excluded.anchor_offset,
         focus_offset = excluded.focus_offset,
         user_id = COALESCE(excluded.user_id, user_id),
         version_number = COALESCE(version_number, 0) + 1`,
      [
        highlight.id,
        highlight.documentId,
        highlight.pageIndex,
        highlight.text,
        highlight.color,
        highlight.anchorOffset,
        highlight.focusOffset,
        highlight.createdAt.toISOString(),
        userId ?? null,
        highlight.id,
        highlight.id,
      ],
    );
  }

  async deleteById(id: string): Promise<void> {
    await this.delete(id);
  }

  async deleteByDocument(documentId: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `UPDATE document_highlights SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE document_id = ?`,
      [documentId],
    );
  }

  private _toHighlight(r: DocumentHighlightRecord): DocumentHighlight {
    return {
      id: r.id,
      documentId: r.document_id,
      pageIndex: r.page_index,
      text: r.text,
      color: r.color as HighlightColor,
      anchorOffset: r.anchor_offset,
      focusOffset: r.focus_offset,
      createdAt: new Date(r.created_at ?? Date.now()),
    };
  }
}

export const highlightRepository = new HighlightRepository();
