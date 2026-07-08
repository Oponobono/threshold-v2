import { EntitySynchronizer } from '../EntitySynchronizer';
import { courseRepository } from '../../database/repositories/CourseRepository';

export class CourseSynchronizer implements EntitySynchronizer {
  readonly entityType = 'courses';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await courseRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await courseRepository.delete(id);
  }
}
