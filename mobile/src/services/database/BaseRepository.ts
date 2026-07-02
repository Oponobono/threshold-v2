import { databaseService } from './DatabaseService';
import { repositoryEventBus } from '../events/RepositoryEventBus';
import { conflictResolver } from '../sync/ConflictResolver';

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

  protected buildActiveWhereClause(extraWhere?: string): string {
    return extraWhere
      ? `deleted_at IS NULL AND ${extraWhere}`
      : 'deleted_at IS NULL';
  }

  async getAll(): Promise<T[]> {
    const rows = await this.getDb().getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE ${this.buildActiveWhereClause()} ORDER BY created_at DESC`
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async getById(id: string): Promise<T | null> {
    const row = await this.getDb().getFirstAsync(
      `SELECT * FROM ${this.tableName} WHERE ${this.buildActiveWhereClause('id = ?')}`, id
    );
    return row ? this.mapRow(row) : null;
  }

  async getByField(field: string, value: any): Promise<T[]> {
    const rows = await this.getDb().getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE ${this.buildActiveWhereClause(`${field} = ?`)} ORDER BY created_at DESC`, value
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async getByIdIncludingDeleted(id: string): Promise<T | null> {
    const row = await this.getDb().getFirstAsync(
      `SELECT * FROM ${this.tableName} WHERE id = ?`, id
    );
    return row ? this.mapRow(row) : null;
  }

  async requireActive(id: string, userId?: string): Promise<T> {
    const entity = await this.getByIdIncludingDeleted(id);
    if (!entity) {
      throw new Error(`${this.tableName} '${id}' does not exist`);
    }
    if ((entity as any).deleted_at) {
      throw new Error(`${this.tableName} '${id}' has been deleted`);
    }
    if (userId !== undefined && (entity as any).user_id !== undefined && String((entity as any).user_id) !== String(userId)) {
      throw new Error(`${this.tableName} '${id}' does not belong to user`);
    }
    return entity;
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
    this._emit('created', data as T);
    return data as T;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const validCols = await this.getValidColumns();
    const keys = Object.keys(data).filter(k => k !== 'id' && (validCols.length > 0 ? validCols.includes(k) : true));

    const hasExplicitVersion = keys.includes('version_number');
    const keysForSet = hasExplicitVersion ? keys.filter(k => k !== 'version_number') : keys;

    const filteredKeys: string[] = [];
    const filteredValues: any[] = [];
    for (const k of keysForSet) {
      const val = (data as any)[k];
      if (val !== undefined) {
        filteredKeys.push(k);
        filteredValues.push(val === undefined ? null : val);
      }
    }

    if (filteredKeys.length === 0 && !hasExplicitVersion) return;

    const setClause = filteredKeys.length > 0
      ? filteredKeys.map(k => `${k} = ?`).join(', ') + ', '
      : '';
    const versionClause = hasExplicitVersion
      ? `version_number = ?`
      : `version_number = COALESCE(version_number, 0) + 1`;
    const allValues = hasExplicitVersion
      ? [...filteredValues, (data as any).version_number, id]
      : [...filteredValues, id];

    await this.getDb().runAsync(
      `UPDATE ${this.tableName} SET ${setClause}updated_at = datetime('now'), ${versionClause} WHERE id = ?`,
      ...allValues
    );
    this._emit('updated', { id, ...data } as T);
  }

  async delete(id: string): Promise<void> {
    await this.getDb().runAsync(
      `UPDATE ${this.tableName} SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      id
    );
    this._emit('deleted', { id } as T);
  }

  async hardDelete(id: string): Promise<void> {
    await this.getDb().runAsync(`DELETE FROM ${this.tableName} WHERE id = ?`, id);
  }

  async count(): Promise<number> {
    const row: any = await this.getDb().getFirstAsync(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${this.buildActiveWhereClause()}`
    );
    return row?.count ?? 0;
  }

  async upsert(data: T): Promise<void> {
    const existing = await this.getByIdIncludingDeleted(data.id);
    if (existing) {
      const localVer = (existing as any).version_number || 0;
      const remoteVer = (data as any).version_number || 0;

      if (remoteVer === 0 && localVer > 0) {
        return;
      }

      if (localVer > remoteVer) {
        return;
      }

      if (localVer === remoteVer) {
        const resolution = conflictResolver.resolve(this.tableName, {
          local: {
            id: data.id,
            version_number: localVer,
            updated_at: (existing as any).updated_at || '',
            last_modified_by: (existing as any).last_modified_by || 'local',
            data: existing,
          },
          remote: {
            id: data.id,
            version_number: remoteVer,
            updated_at: (data as any).updated_at || '',
            last_modified_by: (data as any).last_modified_by || 'remote',
            data,
          },
        });

        if (resolution.winner === 'remote' || resolution.winner === 'merged') {
          await this.update(data.id, { ...resolution.data, version_number: resolution.version_number } as any);
        }
        return;
      }

      await this.update(data.id, { ...data, version_number: remoteVer } as any);
    } else {
      await this.create(data);
    }
  }

  async upsertFromCloud(data: T): Promise<void> {
    const existing = await this.getByIdIncludingDeleted(data.id);
    if (!existing) {
      await this.create(data);
      return;
    }

    const localVer = (existing as any).version_number || 0;
    const remoteVer = (data as any).version_number || 0;

    if (remoteVer <= localVer) return;

    await this.update(data.id, data as any);
  }

  private _emit(eventType: 'created' | 'updated' | 'deleted', data: T): void {
    try {
      const priority = eventType === 'updated' ? 'NORMAL' : 'HIGH';
      repositoryEventBus.emit({
        entityType: this.tableName,
        eventType,
        entityId: data.id,
        entity: data,
        timestamp: Date.now(),
        priority,
      });
    } catch (err) {
      console.warn(`[BaseRepository] Error emitting ${eventType} event for ${this.tableName}:`, err);
    }
  }
}
