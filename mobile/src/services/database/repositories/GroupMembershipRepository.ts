import { databaseService } from '../DatabaseService';
import { GroupMembership } from '../../api/types';
import { BaseRepository } from '../BaseRepository';
import { groupRepository } from './GroupRepository';

export type { GroupMembership } from '../../api/types';

export class GroupMembershipRepository extends BaseRepository<GroupMembership> {
  constructor() {
    super('group_memberships');
  }

  async getAll(): Promise<GroupMembership[]> {
    return databaseService.getAllTracked<GroupMembership>(
      'SELECT * FROM group_memberships WHERE deleted_at IS NULL',
      undefined,
      'GroupMembershipRepo.getAll'
    );
  }

  async getById(id: string): Promise<GroupMembership | null> {
    const db = databaseService.getDb();
    if (!db) return null;
    return db.getFirstAsync<GroupMembership>('SELECT * FROM group_memberships WHERE id = ? AND deleted_at IS NULL', [id]);
  }

  /**
   * Elimina una membresía. Si ya no quedan membresías activas para
   * ese user_id + group_pin_id, hace pruning del grupo local.
   */
  async deleteWithPruning(membershipId: string): Promise<void> {
    const db = databaseService.getDb();
    if (!db) return;

    // 1. Obtener los detalles antes de borrar
    const membership = await this.getById(membershipId);
    if (!membership) return;

    // 2. Borrar la membresía
    await this.delete(membershipId);

    // 3. Revisar si quedan membresías
    const remaining = await db.getFirstAsync<{count: number}>(
      'SELECT COUNT(*) as count FROM group_memberships WHERE user_id = ? AND group_pin_id = ? AND deleted_at IS NULL',
      [membership.user_id, membership.group_pin_id]
    );

    if (remaining?.count === 0) {
      // 4. Hacer pruning del grupo asociado
      await db.runAsync('DELETE FROM groups WHERE group_pin_id = ?', [membership.group_pin_id]);
    }
  }
}

export const groupMembershipRepository = new GroupMembershipRepository();
