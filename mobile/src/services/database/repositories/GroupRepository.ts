import { databaseService } from '../DatabaseService';
import { Group } from '../../api/types';
import { BaseRepository } from '../BaseRepository';
import { syncService } from '../SyncService';

export type { Group } from '../../api/types';

export class GroupRepository extends BaseRepository<Group> {
  constructor() {
    super('groups');
  }

  async getAll(): Promise<Group[]> {
    return databaseService.getAllTracked<Group>(
      'SELECT * FROM groups WHERE deleted_at IS NULL ORDER BY name ASC',
      undefined,
      'GroupRepo.getAll'
    );
  }

  async getById(id: string): Promise<Group | null> {
    const db = databaseService.getDb();
    if (!db) return null;
    return db.getFirstAsync<Group>('SELECT * FROM groups WHERE id = ? AND deleted_at IS NULL', [id]);
  }
}

export const groupRepository = new GroupRepository();
