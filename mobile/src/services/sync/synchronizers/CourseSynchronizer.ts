import { EntitySynchronizer } from '../EntitySynchronizer';
import { courseRepository } from '../../database/repositories/CourseRepository';

export class CourseSynchronizer implements EntitySynchronizer {
  readonly entityType = 'courses';

  async saveAll(items: any[]): Promise<number> {
    await courseRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await courseRepository.delete(id);
  }
}
