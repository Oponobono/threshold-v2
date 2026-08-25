import { BaseRepository } from '../BaseRepository';
import type { GradeVersionParams } from '../../../domain/grading/gradingEngine';

export interface LocalGradingConfig {
  id: string;
  grading_system_id: number | null;
  grading_version_id: number | null;
  min_value: number;
  max_value: number;
  direction: 'ascending' | 'descending';
  precision: number;
  passing_value: number;
  code: string | null;
  name: string | null;
  updated_at: string;
}

const DEFAULT_CONFIG: LocalGradingConfig = {
  id: 'active',
  grading_system_id: null,
  grading_version_id: null,
  min_value: 0,
  max_value: 5,
  direction: 'ascending',
  precision: 2,
  passing_value: 3.0,
  code: null,
  name: null,
  updated_at: '',
};

export class LocalGradingConfigRepository extends BaseRepository<LocalGradingConfig> {
  constructor() {
    super('local_grading_config');
  }

  async getActive(): Promise<LocalGradingConfig> {
    const db = this.getDb();
    const row = await db.getFirstAsync(
      `SELECT * FROM ${this.tableName} WHERE id = 'active'`
    ) as LocalGradingConfig | null;
    return row || DEFAULT_CONFIG;
  }

  async getGradeVersionParams(): Promise<GradeVersionParams> {
    const config = await this.getActive();
    return {
      min_value: config.min_value,
      max_value: config.max_value,
      direction: config.direction,
      precision: config.precision,
    };
  }

  async saveActive(config: Omit<LocalGradingConfig, 'id' | 'updated_at'>): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO ${this.tableName}
       (id, grading_system_id, grading_version_id, min_value, max_value, direction, precision, passing_value, code, name, updated_at)
       VALUES ('active', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      config.grading_system_id,
      config.grading_version_id,
      config.min_value,
      config.max_value,
      config.direction,
      config.precision,
      config.passing_value,
      config.code,
      config.name,
    );
  }
}
