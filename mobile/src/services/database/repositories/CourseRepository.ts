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
}

export const courseRepository = new CourseRepository();
