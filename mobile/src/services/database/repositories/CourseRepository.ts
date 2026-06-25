import { databaseService } from '../DatabaseService';
import { Course } from '../../api/types';
import { BaseRepository } from '../BaseRepository';

export class CourseRepository extends BaseRepository<Course> {
  constructor() {
    super('courses');
  }

  async getAll(): Promise<Course[]> {
    const db = databaseService.getDb();
    if (!db) return [];
    return db.getAllAsync<Course>('SELECT * FROM courses ORDER BY last_studied_at DESC');
  }

  async getById(id: string): Promise<Course | null> {
    const db = databaseService.getDb();
    if (!db) return null;
    return db.getFirstAsync<Course>('SELECT * FROM courses WHERE id = ?', [id]);
  }

  async isFlatCourse(courseId: string): Promise<boolean> {
    const db = databaseService.getDb();
    if (!db) return true;
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM subjects WHERE course_id = ?', [courseId]
    );
    return (row?.count ?? 0) === 0;
  }

  async incrementClass(courseId: string): Promise<void> {
    const db = databaseService.getDb();
    if (!db) return;
    const course = await this.getById(courseId);
    if (!course) return;
    const nextCompleted = Math.min((course.completed_classes ?? 0) + 1, course.total_classes ?? Infinity);
    const newStatus = course.total_classes && nextCompleted >= course.total_classes ? 'completed' : course.status || 'active';
    await db.runAsync(
      'UPDATE courses SET completed_classes = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [nextCompleted, newStatus, courseId]
    );
    if (newStatus === 'completed' && course.status !== 'completed') {
      const { MomentumService } = await import('../../MomentumService');
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
      'UPDATE courses SET completed_classes = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [prevCompleted, newStatus || 'active', courseId]
    );
  }
}

export const courseRepository = new CourseRepository();
