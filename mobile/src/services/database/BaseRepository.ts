import { databaseService } from './DatabaseService';

export class BaseRepository<T extends { id: string }> {
  constructor(protected tableName: string) {}

  protected getDb() {
    return databaseService.getDb();
  }

  protected mapRow(row: any): T {
    if (!row) return row;
    const result: any = {};
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        result[key] = row[key] === null ? undefined : row[key];
      }
    }
    return result as T;
  }

  async getAll(): Promise<T[]> {
    const rows = await this.getDb().getAllAsync(`SELECT * FROM ${this.tableName} ORDER BY created_at DESC`);
    return (rows as T[]).map(row => this.mapRow(row));
  }

  async getById(id: string): Promise<T | null> {
    const row = await this.getDb().getFirstAsync(`SELECT * FROM ${this.tableName} WHERE id = ?`, id);
    return row ? this.mapRow(row) : null;
  }

  async getByField(field: string, value: any): Promise<T[]> {
    const rows = await this.getDb().getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY created_at DESC`, value
    );
    return (rows as T[]).map(row => this.mapRow(row));
  }

  private validColumns: string[] | null = null;

  private async getValidColumns(): Promise<string[]> {
    if (this.validColumns) return this.validColumns;
    try {
      const rows = await this.getDb().getAllAsync(`PRAGMA table_info(${this.tableName})`);
      this.validColumns = (rows as { name: string }[]).map(r => r.name);
    } catch (e) {
      console.warn(`[BaseRepository] Error obteniendo schema para ${this.tableName}:`, e);
      this.validColumns = [];
    }
    return this.validColumns;
  }

  async create(data: Partial<T>): Promise<T> {
    const validCols = await this.getValidColumns();
    const keys = Object.keys(data).filter(k => (k === 'id' && data.id) || (validCols.length > 0 ? validCols.includes(k) : true));
    const values = keys.map(k => data[k as keyof T]);
    const filteredKeys: string[] = [];
    const filteredValues: any[] = [];
    for (let i = 0; i < keys.length; i++) {
      if (values[i] !== undefined) {
        filteredKeys.push(keys[i]);
        filteredValues.push(values[i]);
      }
    }
    if (filteredKeys.length === 0) throw new Error(`Cannot create ${this.tableName} with no valid columns`);
    const cols = filteredKeys.join(', ');
    const placeholders = filteredKeys.map(() => '?').join(', ');
    await this.getDb().runAsync(
      `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders})`, ...filteredValues
    );
    return data as T;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const validCols = await this.getValidColumns();
    const keys = Object.keys(data).filter(k => k !== 'id' && (validCols.length > 0 ? validCols.includes(k) : true));
    
    const filteredKeys: string[] = [];
    const filteredValues: any[] = [];
    for (const k of keys) {
      const val = data[k as keyof T];
      if (val !== undefined) {
        filteredKeys.push(k);
        filteredValues.push(val);
      }
    }
    
    if (filteredKeys.length === 0) return;
    
    const setClause = filteredKeys.map(k => `${k} = ?`).join(', ');
    filteredValues.push(id);
    await this.getDb().runAsync(
      `UPDATE ${this.tableName} SET ${setClause}, updated_at = datetime('now') WHERE id = ?`, ...filteredValues
    );
  }

  async delete(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM ${this.tableName} WHERE id = ?`, id);
  }

  async count(): Promise<number> {
    const row: any = await this.getDb().getFirstAsync(`SELECT COUNT(*) as count FROM ${this.tableName}`);
    return row?.count ?? 0;
  }

  async upsert(data: T): Promise<void> {
    const existing = await this.getById(data.id);
    if (existing) {
      await this.update(data.id, data as Partial<T>);
    } else {
      await this.create(data);
    }
  }
}
