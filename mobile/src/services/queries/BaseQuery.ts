import { databaseService } from '../database/DatabaseService';

export abstract class BaseQuery<T> {
  protected abstract sql(): string;
  protected abstract params(): any[];
  protected abstract mapRow(row: any): T;

  async execute(): Promise<T[]> {
    const db = databaseService.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(this.sql(), ...this.params());
    return (rows as any[]).map(r => this.mapRow(r));
  }

  async executeSingle(): Promise<T | null> {
    const db = databaseService.getDb();
    if (!db) return null;
    const row = await db.getFirstAsync(this.sql(), ...this.params());
    return row ? this.mapRow(row) : null;
  }
}
