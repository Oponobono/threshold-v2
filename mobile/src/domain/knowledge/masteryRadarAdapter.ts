import type { KnowledgeSnapshot, SubjectKnowledge } from './types';
import type { MasteryRadarData, MasteryRadarItem } from '../../services/api/analytics';

function getMasteryColor(percentage: number): string {
  if (percentage >= 80) return '#10B981';
  if (percentage >= 60) return '#3B82F6';
  if (percentage >= 40) return '#F97316';
  if (percentage >= 20) return '#EF4444';
  return '#7C3AED';
}

/**
 * INVARIANT M1: Mastery = FSRS-derived current knowledge state.
 * INVARIANT M2: Historical review performance (card_logs) must not
 *   redefine the authoritative knowledge state.
 *
 * SubjectKnowledge.retrievability is in [0, 100] (percentage),
 * computed by query.ts as: round(mean(calculateRetrievability()) * 10000) / 100.
 * The round() below strips sub-integer decimals for display.
 *
 * Global average is an unweighted mean of per-subject retrievabilities.
 * This represents "average expected recall across subjects," NOT
 * "probability of recalling a random card from Threshold" (which
 * would require weighting by card count).
 */
export function snapshotToRadarData(
  snapshot: KnowledgeSnapshot,
  subjectId: string | 'all',
): MasteryRadarData {
  const subjects = subjectId === 'all'
    ? snapshot.subjects.filter(s => s.totalCards > 0)
    : snapshot.subjects.filter(s => s.totalCards > 0 && s.subjectId === subjectId);

  if (subjects.length === 0) {
    return {
      radar: [],
      averageMastery: 0,
      strongestArea: null,
      weakestArea: null,
      recommendation: 'Aún no hay suficientes datos de dominio. Crea y practica flashcards para generar analytics.',
    };
  }

  const radar: MasteryRadarItem[] = subjects.map(s => ({
    name: s.subjectName || 'General',
    value: Math.round(s.retrievability),
    color: getMasteryColor(Math.round(s.retrievability)),
  }));

  const avg = Math.round(radar.reduce((sum, r) => sum + r.value, 0) / radar.length);
  const strongest = radar.reduce((a, b) => a.value > b.value ? a : b);
  const weakest = radar.reduce((a, b) => a.value < b.value ? a : b);

  const recommendation = weakest.value < 50
    ? `Enfócate en ${weakest.name} (${weakest.value}% dominio)`
    : `Estás bien equilibrado. Refuerza ${weakest.name} para mejorar`;

  return {
    radar,
    averageMastery: avg,
    strongestArea: { name: strongest.name, value: strongest.value },
    weakestArea: { name: weakest.name, value: weakest.value },
    recommendation,
  };
}
