import * as SQLite from 'expo-sqlite';
import type { DocumentHighlight, HighlightColor } from '../../domain/document/DocumentHighlight';

const DB_NAME = 'threshold.db';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) db = await SQLite.openDatabaseAsync(DB_NAME);
  return db;
}

export class HighlightRepository {
  async getByDocument(documentId: string): Promise<DocumentHighlight[]> {
    const database = await getDb();
    const rows = await database.getAllAsync<{
      id: string;
      document_id: string;
      page_index: number;
      text: string;
      color: string;
      anchor_offset: number;
      focus_offset: number;
      created_at: string;
    }>(
      'SELECT * FROM document_highlights WHERE document_id = ? ORDER BY page_index, anchor_offset',
      [documentId],
    );

    return rows.map(r => ({
      id: r.id,
      documentId: r.document_id,
      pageIndex: r.page_index,
      text: r.text,
      color: r.color as HighlightColor,
      anchorOffset: r.anchor_offset,
      focusOffset: r.focus_offset,
      createdAt: new Date(r.created_at),
    }));
  }

  async save(highlight: DocumentHighlight): Promise<void> {
    const database = await getDb();
    await database.runAsync(
      `INSERT OR REPLACE INTO document_highlights (id, document_id, page_index, text, color, anchor_offset, focus_offset, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        highlight.id,
        highlight.documentId,
        highlight.pageIndex,
        highlight.text,
        highlight.color,
        highlight.anchorOffset,
        highlight.focusOffset,
        highlight.createdAt.toISOString(),
      ],
    );
  }

  async deleteById(id: string): Promise<void> {
    const database = await getDb();
    await database.runAsync('DELETE FROM document_highlights WHERE id = ?', [id]);
  }

  async deleteByDocument(documentId: string): Promise<void> {
    const database = await getDb();
    await database.runAsync('DELETE FROM document_highlights WHERE document_id = ?', [documentId]);
  }
}
