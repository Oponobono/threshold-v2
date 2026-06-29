import { EntitySynchronizer } from '../EntitySynchronizer';

export class CourseSynchronizer implements EntitySynchronizer {
  readonly entityType = 'courses';

  async saveAll(items: any[]): Promise<number> {
    const { courseRepository } = await import('../../database/repositories/CourseRepository');
    let count = 0;
    for (const item of items) {
      await courseRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { courseRepository } = await import('../../database/repositories/CourseRepository');
    await courseRepository.delete(id);
  }
}
