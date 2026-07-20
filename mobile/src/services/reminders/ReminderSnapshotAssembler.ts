import { ReminderSnapshot } from './types';
import type { ReminderEntitySnapshot } from './types';

const EMPTY_ID = '';

export class ReminderSnapshotAssembler {
  build(entity: any, entityType: string): ReminderSnapshot {
    const entityId = this._id(entity);
    const entityName = entity.title ?? entity.name ?? entity.displayName ?? '';

    const entitySnapshot: ReminderEntitySnapshot = {
      id: entityId,
      type: entityType,
      name: entityName,
    };

    return new ReminderSnapshot({
      entity: entitySnapshot,
      subject: this._buildSubject(entity),
      course: this._buildCourse(entity),
    });
  }

  private _id(entity: any): string {
    if (entity == null) return EMPTY_ID;
    return String(entity.id ?? entity.ID ?? EMPTY_ID);
  }

  private _buildSubject(entity: any): { id: string; name: string } | undefined {
    const subjectId = entity?.subject_id ?? entity?.subject?.id;
    if (!subjectId) return undefined;
    const subjectName = entity?.subject?.name ?? entity?.subject_name ?? '';
    return {
      id: String(subjectId ?? EMPTY_ID),
      name: subjectName,
    };
  }

  private _buildCourse(entity: any): { id: string; name: string } | undefined {
    if (!entity.course) return undefined;
    return {
      id: String(entity.course.id ?? EMPTY_ID),
      name: entity.course.name ?? '',
    };
  }
}
