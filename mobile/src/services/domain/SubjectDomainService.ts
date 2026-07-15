import { databaseService } from '../database/DatabaseService';
import { repositoryEventBus } from '../events/RepositoryEventBus';

interface ChildEntity {
  table: string;
  entityType: string;
  idField?: string;
  eventType?: string;
  cascade?: { table: string; entityType: string; fkField: string; eventType?: string }[];
}

const SUBJECT_CHILDREN: ChildEntity[] = [
  {
    table: 'assessments',
    entityType: 'assessment',
    eventType: 'assessments',
    cascade: [
      { table: 'assessment_files', entityType: 'assessment_files', fkField: 'assessment_id' },
    ],
  },
  { table: 'assessment_categories', entityType: 'category' },
  { table: 'schedules', entityType: 'schedule', eventType: 'schedules' },
  { table: 'study_sessions', entityType: 'study-session' },
  { table: 'threshold_overrides', entityType: 'threshold-overrides' },
  { table: 'photos', entityType: 'photo' },
  {
    table: 'audio_recordings',
    entityType: 'audio_recording',
    cascade: [
      { table: 'audio_transcripts', entityType: 'audio-transcript', fkField: 'recording_id' },
    ],
  },
  { table: 'scanned_documents', entityType: 'scanned-document' },
  {
    table: 'youtube_videos',
    entityType: 'youtube-video',
    cascade: [
      { table: 'youtube_transcripts', entityType: 'youtube-transcript', fkField: 'video_id' },
    ],
  },
  {
    table: 'flashcard_decks',
    entityType: 'flashcard-deck',
    cascade: [
      { table: 'flashcards', entityType: 'flashcard', fkField: 'deck_id' },
    ],
  },
  { table: 'calendar_events', entityType: 'calendar-event' },
  { table: 'ai_chats', entityType: 'ai-chat' },
];

async function softDeleteTable(
  db: any,
  table: string,
  fkField: string,
  parentId: string,
): Promise<string[]> {
  const rows: any[] = await db.getAllAsync(
    `SELECT id FROM ${table} WHERE ${fkField} = ? AND deleted_at IS NULL`,
    [parentId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE ${table} SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id IN (${placeholders})`,
    ...ids,
  );
  return ids;
}

async function enqueueBulkDeletedEvent(
  entityType: string,
  entityIds: string[],
): Promise<void> {
  if (entityIds.length === 0) return;
  repositoryEventBus.emit({
    entityType,
    eventType: 'deleted',
    entityId: entityIds.join(','),
    entity: { ids: entityIds },
    timestamp: Date.now(),
    priority: 'HIGH',
  });
}

async function compactJournalForEntities(
  txn: any,
  entities: { entityType: string; ids: string[] }[],
): Promise<void> {
  if (entities.length === 0) return;
  for (const group of entities) {
    if (group.ids.length === 0) continue;
    const placeholders = group.ids.map(() => '?').join(',');
    await txn.runAsync(
      `DELETE FROM sync_queue WHERE entity_type = ? AND entity_id IN (${placeholders})`,
      group.entityType,
      ...group.ids,
    );
  }
}

export async function deleteSubject(
  subjectId: string,
  userId: string,
): Promise<void> {
  const db = databaseService.getDb();

  const affected: { entityType: string; eventType?: string; ids: string[] }[] = [];

  await db.execAsync('BEGIN IMMEDIATE');
  try {
    for (const child of SUBJECT_CHILDREN) {
      const fkField = child.idField || 'subject_id';
      const childIds = await softDeleteTable(db, child.table, fkField, subjectId);

      if (childIds.length > 0) {
        affected.push({ entityType: child.entityType, eventType: child.eventType, ids: childIds });

        if (child.cascade) {
          for (const grandchild of child.cascade) {
            const gIds: string[] = [];
            for (const cId of childIds) {
              const ids = await softDeleteTable(
                db,
                grandchild.table,
                grandchild.fkField,
                cId,
              );
              gIds.push(...ids);
            }
            if (gIds.length > 0) {
              affected.push({ entityType: grandchild.entityType, eventType: grandchild.eventType, ids: gIds });
            }
          }
        }
      }
    }

    await compactJournalForEntities(db, affected);

    await db.runAsync(
      `DELETE FROM sync_queue WHERE entity_type = ? AND entity_id = ?`,
      'subject',
      subjectId,
    );

    await db.runAsync(
      `UPDATE subjects SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      subjectId,
      userId,
    );

    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }

  for (const group of affected) {
    enqueueBulkDeletedEvent(group.eventType || group.entityType, group.ids);
  }

  repositoryEventBus.emit({
    entityType: 'subjects',
    eventType: 'deleted',
    entityId: subjectId,
    entity: { id: subjectId, user_id: userId },
    timestamp: Date.now(),
    priority: 'HIGH',
  });

}
