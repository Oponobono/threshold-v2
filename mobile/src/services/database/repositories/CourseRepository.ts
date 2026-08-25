import { databaseService } from '../DatabaseService';
import { Course } from '../../api/types';
import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import { MomentumService } from '../../MomentumService';

export type { Course } from '../../api/types';

export class CourseRepository extends SessionBoundRepository<Course> {
  constructor(context: SessionBoundContext) {
    super('courses', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<Course>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId) {
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    }
    data.user_id = this.context.userId;
  }

  async getAll(): Promise<Course[]> {
    this.requireValidSession();
    return databaseService.getAllTracked<Course>(
      `SELECT * FROM courses WHERE ${this.buildActiveWhereClause()} ORDER BY last_studied_at DESC`,
      this.getOwnershipParams(),
      'CourseRepo.getAll'
    );
  }

  async getById(id: string): Promise<Course | null> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return null;
    return db.getFirstAsync<Course>(
      `SELECT * FROM courses WHERE ${this.buildActiveWhereClause('id = ?')}`, 
      [...this.getOwnershipParams(), id]
    );
  }

  async isFlatCourse(courseId: string): Promise<boolean> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return true;
    const row = await db.getFirstAsync<{ count: number }>(
      // Wait, subjects is indirect? Or direct? subjects has user_id.
      // We should check course ownership first, but since courseId is filtered...
      `SELECT COUNT(*) as count FROM subjects WHERE course_id = ? AND user_id = ?`, 
      [courseId, this.context.userId]
    );
    return (row?.count ?? 0) === 0;
  }

  async incrementClass(courseId: string): Promise<void> {
    this.requireValidSession();
    const db = databaseService.getDb();
    if (!db) return;
    const course = await this.getById(courseId);
    if (!course) return;
    const nextCompleted = Math.min((course.completed_classes ?? 0) + 1, course.total_classes ?? Infinity);
    const newStatus = course.total_classes && nextCompleted >= course.total_classes ? 'completed' : course.status || 'active';
    await db.runAsync(
      `UPDATE courses SET completed_classes = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [nextCompleted, newStatus, courseId, this.context.userId]
    );
    require('../SyncService').syncService.enqueueUpdate('course', courseId, { completed_classes: nextCompleted, status: newStatus });
    if (newStatus === 'completed' && course.status !== 'completed') {
      MomentumService.boostMomentum(courseId).catch(console.warn);
    }
  }

  async decrementClass(courseId: string): Promise<void> {
    const db = databaseService.getDb();
    if (!db) return;
    const course = await this.getById(courseId);
    if (!course) return;
    const prevCompleted = Math.max((course.completed_classes ?? 0) - 1, 0);
    const newStatus = course.status === 'completed' && prevCompleted < (course.total_classes ?? 0) ? 'active' : course.status;
    await db.runAsync(
      `UPDATE courses SET completed_classes = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [prevCompleted, newStatus || 'active', courseId, this.context.userId]
    );
    require('../SyncService').syncService.enqueueUpdate('course', courseId, { completed_classes: prevCompleted, status: newStatus || 'active' });
  }
}

// Remove singleton export to force context instantiation:
// export const courseRepository = new CourseRepository();
