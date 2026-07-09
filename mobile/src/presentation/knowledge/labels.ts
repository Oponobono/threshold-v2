import type { MemoryLevel } from '../../domain/knowledge/types';

type Translator = (key: string, options?: Record<string, any>) => string;

export function getMemoryLevelLabel(level: MemoryLevel, t: Translator): string {
  return t(`knowledge.state.${level}`);
}

export function getKnowledgeDescription(score: number, t: Translator): string {
  if (score >= 85) return t('knowledge.description.excellent');
  if (score >= 70) return t('knowledge.description.good');
  if (score >= 50) return t('knowledge.description.medium');
  return t('knowledge.description.low');
}

export function getRiskLabel(atRisk: number, score: number, t: Translator): string {
  if (score >= 85 && atRisk <= 20) return t('knowledge.risk.excellent');
  if (atRisk <= 0) return t('knowledge.risk.stable');
  if (score < 50) return t('knowledge.risk.critical');
  return t('knowledge.risk.warning', { atRisk });
}

export function getLastReviewLabel(daysSinceLastReview: number, t: Translator): string {
  if (daysSinceLastReview >= 999) return t('knowledge.lastReview.never');
  if (daysSinceLastReview === 0) return t('knowledge.lastReview.today');
  if (daysSinceLastReview === 1) return t('knowledge.lastReview.yesterday');
  return t('knowledge.lastReview.daysAgo', { days: daysSinceLastReview });
}
