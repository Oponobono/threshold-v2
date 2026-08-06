import { BaseRepository } from '../BaseRepository';
import type { ArtifactType } from '../../../domain/document/DocumentAnchor';

export interface DocumentAnchorRow {
  id: string;
  user_id: string;
  document_id: string;
  page_index: number;
  block_id: string;
  char_start?: number;
  char_end?: number;
  target_type: ArtifactType;
  target_id: string;
  metadata?: string; // JSON serialized
  sync_version?: number;
  version_number?: number;
  last_modified_by?: string;
  deleted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class DocumentAnchorRepository extends BaseRepository<DocumentAnchorRow> {
  constructor() {
    super('document_anchors');
  }

  async findByDocumentId(documentId: string): Promise<DocumentAnchorRow[]> {
    return this.getByField('document_id', documentId);
  }

  async findByDocumentPage(documentId: string, pageIndex: number): Promise<DocumentAnchorRow[]> {
    const db = this.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync<DocumentAnchorRow>(
      `SELECT * FROM document_anchors
       WHERE document_id = ? AND page_index = ? AND deleted_at IS NULL
       ORDER BY char_start ASC`,
      [documentId, pageIndex],
    );
    return rows.map(r => this.mapRow(r));
  }

  async findByTarget(targetType: ArtifactType, targetId: string): Promise<DocumentAnchorRow[]> {
    const db = this.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync<DocumentAnchorRow>(
      `SELECT * FROM document_anchors
       WHERE target_type = ? AND target_id = ? AND deleted_at IS NULL`,
      [targetType, targetId],
    );
    return rows.map(r => this.mapRow(r));
  }

  async updateTarget(
    anchorId: string,
    targetType: ArtifactType,
    targetId: string,
  ): Promise<void> {
    await this.update(anchorId, {
      target_type: targetType,
      target_id: targetId,
    } as Partial<DocumentAnchorRow>);
  }
}

export const documentAnchorRepository = new DocumentAnchorRepository();
