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
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async getById(id: string): Promise<T | null> {
    const row = await this.getDb().getFirstAsync(`SELECT * FROM ${this.tableName} WHERE id = ?`, id);
    return row ? this.mapRow(row) : null;
  }

  async getByField(field: string, value: any): Promise<T[]> {
    const rows = await this.getDb().getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY created_at DESC`, value
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  private validColumns: string[] | null = null;

  private async getValidColumns(): Promise<string[]> {
    if (this.validColumns) return this.validColumns;
    try {
      const rows = await this.getDb().getAllAsync(`PRAGMA table_info(${this.tableName})`);
      this.validColumns = (rows as any[]).map(r => r.name);
    } catch (e) {
      console.warn(`[BaseRepository] Error obteniendo schema para ${this.tableName}:`, e);
      this.validColumns = [];
    }
    return this.validColumns;
  }

  async create(data: Partial<T>): Promise<T> {
    const validCols = await this.getValidColumns();
    const keys = Object.keys(data).filter(k => (k === 'id' && data.id) || (validCols.length > 0 ? validCols.includes(k) : true));
    const values = keys.map(k => (data as any)[k]);
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
      const val = (data as any)[k];
      // Permitir null explícito (ej: course_id = null para desvincular un curso).
      // Solo descartar undefined, que indica campo no proporcionado.
      if (val !== undefined) {
        filteredKeys.push(k);
        // Convertir undefined anidado a null para SQLite
        filteredValues.push(val === undefined ? null : val);
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

  /**
   * Crea o actualiza un registro local. Usado para respuestas de operaciones
   * locales (create/update) que necesitan persistir la confirmación del servidor.
   */
  async upsert(data: T): Promise<void> {
    const existing = await this.getById(data.id);
    if (existing) {
      const parseDateSafe = (dateStr?: string) => {
        if (!dateStr) return 0;
        const formatted = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr) 
          ? dateStr.replace(' ', 'T') + 'Z' 
          : dateStr;
        return new Date(formatted).getTime();
      };

      const localTime = parseDateSafe((existing as any).updated_at);
      const remoteTime = parseDateSafe((data as any).updated_at);

      if (remoteTime === 0 || localTime === 0 || remoteTime >= localTime) {
        await this.update(data.id, data as any);
      }
    } else {
      await this.create(data);
    }
  }

  /**
   * Versión para sync en background desde el cloud: solo crea registros que NO
   * existen localmente. NUNCA sobreescribe datos locales existentes.
   * Esto garantiza que el historial local, los cálculos y las ediciones offline
   * se preserven intactos, como una calculadora.
   */
  async upsertFromCloud(data: T): Promise<void> {
    const existing = await this.getById(data.id);
    if (!existing) {
      await this.create(data);
    }
  }
}
