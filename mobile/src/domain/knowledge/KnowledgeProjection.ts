import { databaseService } from '../../services/database/DatabaseService';
import { getKnowledgeAggregation } from './query';
import { KnowledgeSnapshotBuilder } from './KnowledgeSnapshotBuilder';
import type { KnowledgeSnapshot } from './types';
import type { KnowledgeProvider } from './KnowledgeProvider';

export class KnowledgeProjection implements KnowledgeProvider {
  async buildSnapshot(userId: string): Promise<KnowledgeSnapshot> {
    const db = databaseService.getDb();
    const aggregation = await getKnowledgeAggregation(db, userId);
    return new KnowledgeSnapshotBuilder(aggregation).build();
  }
}
