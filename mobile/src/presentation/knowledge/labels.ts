import type { KnowledgeMaturity, MemoryLevel } from '../../domain/knowledge/types';

type Translator = (key: string, options?: Record<string, any>) => string;

export function getMemoryLevelLabel(level: MemoryLevel, t: Translator): string {
  return t(`knowledge.state.${level}`);
}

export function getKnowledgeDescription(maturity: KnowledgeMaturity, score: number, t: Translator): string {
  const SCORE_GOOD = 70;
  const SCORE_RECOVERING = 50;

  switch (maturity) {
    case 'inicio':
      return t('knowledge.maturity.starting');
    case 'consolidacion':
      return t('knowledge.maturity.consolidating');
    case 'consolidado':
      if (score >= SCORE_GOOD) return t('knowledge.maturity.consolidated');
      if (score >= SCORE_RECOVERING) return t('knowledge.maturity.maintenance');
      return t('knowledge.maturity.recovering');
  }
}

export function getRiskLabel(atRisk: number, t: Translator): string {
  if (atRisk <= 0) return t('knowledge.risk.stable');
  return t('knowledge.risk.warning', { atRisk });
}
