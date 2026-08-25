import { databaseService } from './DatabaseService';
import { repositoryEventBus } from '../events/RepositoryEventBus';
import { conflictResolver } from '../sync/ConflictResolver';
import { SessionBoundContext, sessionIdentity } from '../api/auth/SessionIdentity';

export abstract class SessionBoundRepository<T extends { id: string }> {
  constructor(
    protected tableName: string,
    protected context: SessionBoundContext
  ) {}

  protected getDb() {
    return databaseService.getDb();
  }

  protected requireValidSession() {
    if (!sessionIdentity.isValidGeneration(this.context.sessionGeneration)) {
      throw new Error('SESSION_CONTEXT_INVALID: Repository instance belongs to a previous session');
    }
  }

  /**
   * Must return the ownership predicate (e.g., 'user_id = ?' or 'EXISTS (...)').
   * Used in READ, UPDATE, and DELETE queries to scope rows to the current user.
   */
  protected abstract buildOwnershipWhereClause(): string;

  /**
   * Must return the parameters needed for the ownership predicate (usually [this.context.userId]).
   */
  protected getOwnershipParams(): any[] {
    return [this.context.userId];
  }

  /**
   * Must inject the ownership explicitly into the payload for CREATE operations.
   * If the payload tries to specify a different owner, it should throw.
   * Can be async to verify parent ownership for indirect entities.
   */
  protected abstract enforceCreateOwnership(data: Partial<T>): Promise<void> | void;

  protected mapRow(row: any): T {
    if (!row) return row;
    return { ...row } as T;
  }

  protected buildActiveWhereClause(extraWhere?: string): string {
    const ownershipClause = this.buildOwnershipWhereClause();
    const baseWhere = `deleted_at IS NULL AND (${ownershipClause})`;
    return extraWhere ? `${baseWhere} AND (${extraWhere})` : baseWhere;
  }

  async getAll(label?: string): Promise<T[]> {
    this.requireValidSession();
    const rows = await databaseService.getAllTracked(
      `SELECT * FROM ${this.tableName} WHERE ${this.buildActiveWhereClause()} ORDER BY created_at DESC`,
      this.getOwnershipParams(),
      label || `SessionBoundRepo.${this.tableName}.getAll`
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async getById(id: string, label?: string): Promise<T | null> {
    this.requireValidSession();
    const params = [...this.getOwnershipParams(), id];
    const row = await databaseService.getFirstTracked(
      `SELECT * FROM ${this.tableName} WHERE ${this.buildActiveWhereClause('id = ?')}`,
      params,
      label || `SessionBoundRepo.${this.tableName}.getById`
    );
    return row ? this.mapRow(row) : null;
  }

  async getByIds(ids: string[], label?: string): Promise<T[]> {
    if (ids.length === 0) return [];
    this.requireValidSession();
    const placeholders = ids.map(() => '?').join(',');
    const params = [...this.getOwnershipParams(), ...ids];
    const rows = await databaseService.getAllTracked(
      `SELECT * FROM ${this.tableName} WHERE ${this.buildActiveWhereClause(`id IN (${placeholders})`)}`,
      params,
      label || `SessionBoundRepo.${this.tableName}.getByIds`
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async getByField(field: string, value: any, label?: string): Promise<T[]> {
    this.requireValidSession();
    const params = [...this.getOwnershipParams(), value];
    const rows = await databaseService.getAllTracked(
      `SELECT * FROM ${this.tableName} WHERE ${this.buildActiveWhereClause(`${field} = ?`)} ORDER BY created_at DESC`,
      params,
      label || `SessionBoundRepo.${this.tableName}.getByField`
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async count(label?: string): Promise<number> {
    this.requireValidSession();
    const row: any = await databaseService.getFirstTracked(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${this.buildActiveWhereClause()}`,
      this.getOwnershipParams(),
      label || `SessionBoundRepo.${this.tableName}.count`
    );
    return row?.count ?? 0;
  }

  private validColumns: string[] | null = null;
  private async getValidColumns(): Promise<string[]> {
    if (this.validColumns) return this.validColumns;
    try {
      const rows = await databaseService.getAllTracked(`PRAGMA table_info(${this.tableName})`, undefined, `SessionBoundRepo.${this.tableName}.schema`);
      this.validColumns = (rows as any[]).map(r => r.name);
    } catch (e) {
      console.warn(`[SessionBoundRepository] Error obteniendo schema para ${this.tableName}:`, e);
      this.validColumns = [];
    }
    return this.validColumns;
  }

  async create(data: Partial<T>): Promise<T> {
    this.requireValidSession();
    await this.enforceCreateOwnership(data);

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
    this.requireValidSession();
    
    // User ID mapping immutable in UPDATE
    if ((data as any).user_id !== undefined) {
       throw new Error(`ILLEGAL_UPDATE: user_id is immutable. Cannot update user_id on ${this.tableName}`);
    }

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
        filteredValues.push(val);
      }
    }

    if (filteredKeys.length === 0 && !hasExplicitVersion) return;

    const setClause = filteredKeys.length > 0
      ? filteredKeys.map(k => `${k} = ?`).join(', ') + ', '
      : '';
    const versionClause = hasExplicitVersion
      ? `version_number = ?`
      : `version_number = COALESCE(version_number, 0) + 1`;
      
    const setValues = hasExplicitVersion
      ? [...filteredValues, (data as any).version_number]
      : filteredValues;
      
    // query is UPDATE tableName SET fields, version WHERE id = ? AND ownershipPredicate
    const allValues = [...setValues, id, ...this.getOwnershipParams()];
    const ownershipClause = this.buildOwnershipWhereClause();

    await this.getDb().runAsync(
      `UPDATE ${this.tableName} SET ${setClause}updated_at = datetime('now'), ${versionClause} WHERE id = ? AND (${ownershipClause})`,
      ...allValues
    );
    this._emit('updated', { id, ...data } as T);
  }

  async delete(id: string): Promise<void> {
    this.requireValidSession();
    const ownershipClause = this.buildOwnershipWhereClause();
    await this.getDb().runAsync(
      `UPDATE ${this.tableName} SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND (${ownershipClause})`,
      [id, ...this.getOwnershipParams()]
    );
    this._emit('deleted', { id } as T);
  }

  async hardDelete(id: string): Promise<void> {
    this.requireValidSession();
    const ownershipClause = this.buildOwnershipWhereClause();
    await this.getDb().runAsync(
      `DELETE FROM ${this.tableName} WHERE id = ? AND (${ownershipClause})`,
      [id, ...this.getOwnershipParams()]
    );
  }

  async getByIdIncludingDeleted(id: string, label?: string): Promise<T | null> {
    this.requireValidSession();
    const ownershipClause = this.buildOwnershipWhereClause();
    const params = [id, ...this.getOwnershipParams()];
    const row = await databaseService.getFirstTracked(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND (${ownershipClause})`,
      params,
      label || `SessionBoundRepo.${this.tableName}.getByIdIncludingDeleted`
    );
    return row ? this.mapRow(row) : null;
  }

  async upsert(data: T): Promise<void> {
    this.requireValidSession();
    // Enforce ownership for upsert
    await this.enforceCreateOwnership(data);
    const existing = await this.getByIdIncludingDeleted(data.id);
    await this.upsertWithExisting(data, existing);
  }

  async upsertWithExisting(data: T, existing: T | null): Promise<void> {
    this.requireValidSession();
    if (existing) {
      const localVer = (existing as any).version_number || 0;
      const remoteVer = (data as any).version_number || 0;

      if (remoteVer === 0 && localVer > 0) return;
      if (localVer > remoteVer) return;

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
          // ensure user_id doesn't slip through
          const updateData = { ...resolution.data, version_number: resolution.version_number };
          delete (updateData as any).user_id;
          await this.update(data.id, updateData as any);
        }
        return;
      }
      
      const updateData = { ...data, version_number: remoteVer };
      delete (updateData as any).user_id;
      await this.update(data.id, updateData as any);
    } else {
      await this.create(data);
    }
  }

  async upsertMany(items: T[]): Promise<void> {
    this.requireValidSession();
    if (items.length === 0) return;
    
    const chunkSize = 500;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const ids = chunk.map(item => `'${item.id}'`).join(', ');
      
      const ownershipClause = this.buildOwnershipWhereClause();
      const params = this.getOwnershipParams();
      
      const existingRows = await databaseService.getAllTracked(
        `SELECT * FROM ${this.tableName} WHERE id IN (${ids}) AND (${ownershipClause})`,
        params,
        `SessionBoundRepo.${this.tableName}.upsertMany`
      );
      
      const existingMap = new Map((existingRows as any[]).map(r => {
        const mapped = this.mapRow ? this.mapRow(r) : r;
        return [mapped.id, mapped];
      }));
      
      for (const data of chunk) {
        const existing = existingMap.get(data.id) || null;
        await this.upsertWithExisting(data, existing);
      }
    }
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
      console.warn(`[SessionBoundRepository] Error emitting ${eventType} event for ${this.tableName}:`, err);
    }
  }
}
