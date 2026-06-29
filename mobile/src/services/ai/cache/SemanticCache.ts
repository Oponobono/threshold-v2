import { databaseService } from '../../database/DatabaseService';

interface CacheEntry {
  id: string;
  query: string;
  response: string;
  model: string;
  created_at: string;
  hit_count: number;
}

class SemanticCache {
  private _initialized = false;

  async initialize(): Promise<void> {
    if (this._initialized) return;
    const db = databaseService.getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS semantic_cache (
        id TEXT PRIMARY KEY,
        query_hash TEXT NOT NULL,
        query TEXT NOT NULL,
        response TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'default',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        hit_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_semantic_cache_hash ON semantic_cache(query_hash)'
    );
    this._initialized = true;
  }

  private _hash(text: string): string {
    let hash = 0;
    const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async get(query: string, model?: string): Promise<string | null> {
    await this.initialize();
    const db = databaseService.getDb();
    const hash = this._hash(query);
    const row: any = await db.getFirstAsync(
      `SELECT * FROM semantic_cache 
       WHERE query_hash = ? AND (? IS NULL OR model = ?)
       ORDER BY hit_count DESC LIMIT 1`,
      [hash, model || null, model || null]
    );

    if (row) {
      await db.runAsync(
        'UPDATE semantic_cache SET hit_count = hit_count + 1 WHERE id = ?',
        [row.id]
      );
      return row.response;
    }
    return null;
  }

  async set(query: string, response: string, model?: string): Promise<void> {
    await this.initialize();
    const db = databaseService.getDb();
    const hash = this._hash(query);
    const existing: any = await db.getFirstAsync(
      'SELECT id FROM semantic_cache WHERE query_hash = ? AND model = ?',
      [hash, model || 'default']
    );

    if (existing) {
      await db.runAsync(
        'UPDATE semantic_cache SET response = ?, hit_count = hit_count + 1 WHERE id = ?',
        [response, existing.id]
      );
    } else {
      const id = `${hash}_${Date.now()}`;
      await db.runAsync(
        'INSERT INTO semantic_cache (id, query_hash, query, response, model) VALUES (?, ?, ?, ?, ?)',
        [id, hash, query, response, model || 'default']
      );
    }
  }

  async getStats(): Promise<{ entries: number; totalHits: number }> {
    await this.initialize();
    const db = databaseService.getDb();
    const row: any = await db.getFirstAsync(
      'SELECT COUNT(*) as count, COALESCE(SUM(hit_count), 0) as hits FROM semantic_cache'
    );
    return {
      entries: row?.count || 0,
      totalHits: row?.hits || 0,
    };
  }

  async clear(): Promise<void> {
    await this.initialize();
    const db = databaseService.getDb();
    await db.runAsync('DELETE FROM semantic_cache');
  }
}

export const semanticCache = new SemanticCache();
