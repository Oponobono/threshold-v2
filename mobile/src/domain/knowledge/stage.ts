import type { KnowledgeMaturity } from './types';

const CONSOLIDATED_THRESHOLD_LOW = 10;
const CONSOLIDATED_THRESHOLD_HIGH = 50;

export function computeMaturity(consolidatedPercent: number): KnowledgeMaturity {
  if (consolidatedPercent < CONSOLIDATED_THRESHOLD_LOW) return 'inicio';
  if (consolidatedPercent < CONSOLIDATED_THRESHOLD_HIGH) return 'consolidacion';
  return 'consolidado';
}
