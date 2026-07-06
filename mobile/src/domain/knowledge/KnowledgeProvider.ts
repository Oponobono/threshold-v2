import type { KnowledgeSnapshot } from './types';

export interface KnowledgeProvider {
  buildSnapshot(userId: string): Promise<KnowledgeSnapshot>;
}
