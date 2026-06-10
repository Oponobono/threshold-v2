import { databaseService } from './database/DatabaseService';
import { getLocalDecks, getPendingReviews } from './localFlashcardService';
import type { MasteryRadarData, MasteryRadarItem, GlobalGPAAnalytics } from './api/analytics';

interface SubjectAgg {
  subjectName: string;
  totalReviews: number;
  correctReviews: number;
  totalResponseTime: number;
  responseTimeCount: number;
  recentPerformance: boolean[];
}

function calculateMastery(stats: {
  correctReviews: number;
  totalReviews: number;
  avgResponseTimeMs: number;
  recentPerformance: boolean[];
}): number {
  const { correctReviews, totalReviews, avgResponseTimeMs, recentPerformance } = stats;
  const successRate = totalReviews > 0 ? correctReviews / totalReviews : 0;
  const recentCorrect = recentPerformance.filter(r => r).length;
  const consistencyScore = recentPerformance.length > 0 ? recentCorrect / recentPerformance.length : 0;
  const optimalTimeMs = 8000;
  const speedScore = Math.min(1, optimalTimeMs / Math.max(optimalTimeMs, avgResponseTimeMs));
  return Math.round((successRate * 0.4 + consistencyScore * 0.3 + speedScore * 0.3) * 100);
}

function getMasteryColor(percentage: number): string {
  if (percentage >= 80) return '#10B981';
  if (percentage >= 60) return '#3B82F6';
  if (percentage >= 40) return '#F97316';
  if (percentage >= 20) return '#EF4444';
  return '#7C3AED';
}

export async function getLocalMasteryData(userId: string, subjectId: string | 'all'): Promise<MasteryRadarData> {
  const db = databaseService.getDb();

  // 1. Obtener subjects
  const subjects = await db.getAllAsync(
    'SELECT id, name, COALESCE(name, subject_name, \'General\') AS display_name FROM subjects WHERE user_id = ? ORDER BY created_at DESC',
    userId
  ) as any[];

  const filteredSubjects = subjectId === 'all'
    ? subjects
    : subjects.filter(s => String(s.id) === subjectId);

  if (filteredSubjects.length === 0) {
    return {
      radar: [],
      averageMastery: 0,
      strongestArea: null,
      weakestArea: null,
      recommendation: 'Aún no hay suficientes datos de dominio. Crea y practica flashcards para generar analytics.',
    };
  }

  // 2. Obtener decks de SQLite + MMKV, mapear deck_id → subject_id
  const deckQuery = subjectId === 'all'
    ? 'SELECT id, subject_id FROM flashcard_decks WHERE user_id = ?'
    : 'SELECT id, subject_id FROM flashcard_decks WHERE user_id = ? AND subject_id = ?';
  const deckParams: any[] = subjectId === 'all' ? [userId] : [userId, subjectId];
  const sqliteDecks = await db.getAllAsync(deckQuery, ...deckParams) as any[];

  const localDecks = getLocalDecks();
  const deckToSubject: Record<string, string | null> = {};

  for (const d of sqliteDecks) {
    deckToSubject[d.id] = d.subject_id ?? null;
  }
  for (const d of localDecks) {
    const sid = d.subject_id !== null ? String(d.subject_id) : null;
    if (subjectId === 'all' || sid === subjectId) {
      deckToSubject[String(d.id)] = sid;
    }
  }

  // 3. Inicializar stats por subject
  const stats: Record<string, SubjectAgg> = {};
  for (const s of filteredSubjects) {
    stats[String(s.id)] = {
      subjectName: s.display_name || s.name || 'General',
      totalReviews: 0,
      correctReviews: 0,
      totalResponseTime: 0,
      responseTimeCount: 0,
      recentPerformance: [],
    };
  }

  // 4. Procesar card_logs de SQLite para cartas cloud
  const deckIds = Object.keys(deckToSubject);
  if (deckIds.length > 0) {
    const placeholders = deckIds.map(() => '?').join(',');
    const cards = await db.getAllAsync(
      `SELECT id, deck_id FROM flashcards WHERE deck_id IN (${placeholders})`,
      ...deckIds
    ) as any[];

    for (const card of cards) {
      const sid = deckToSubject[card.deck_id];
      if (!sid || !stats[sid]) continue;

      const logs = await db.getAllAsync(
        'SELECT result, response_time_ms FROM card_logs WHERE card_id = ? ORDER BY created_at DESC',
        card.id
      ) as any[];

      for (const log of logs) {
        stats[sid].totalReviews++;
        if (log.result === 'correct') stats[sid].correctReviews++;
        if (log.response_time_ms) {
          stats[sid].totalResponseTime += log.response_time_ms;
          stats[sid].responseTimeCount++;
        }
        stats[sid].recentPerformance.push(log.result === 'correct');
      }
    }
  }

  // 5. Procesar pending reviews (cartas locales en MMKV)
  const pendingReviews = getPendingReviews();
  if (pendingReviews.length > 0) {
    // Construir mapa cardId → subjectId escaneando mazos locales
    const mmkv = require('react-native-mmkv').createMMKV();
    const cardToSubject: Record<number, string | null> = {};

    for (const localDeck of localDecks) {
      const sid = localDeck.subject_id !== null ? String(localDeck.subject_id) : null;
      if (subjectId !== 'all' && sid !== subjectId) continue;

      const raw = mmkv.getString(`cache:flashcards_by_deck:${localDeck.id}`);
      if (raw) {
        const entry = JSON.parse(raw);
        const cards: any[] = entry.data || entry || [];
        for (const card of cards) {
          if (card.id != null) {
            cardToSubject[Number(card.id)] = sid;
          }
        }
      }
    }

    for (const review of pendingReviews) {
      const sid = cardToSubject[review.cardId] ?? null;
      if (!sid || !stats[sid]) continue;

      stats[sid].totalReviews++;
      if (review.grade >= 3) stats[sid].correctReviews++;
      stats[sid].recentPerformance.push(review.grade >= 3);
    }
  }

  // 6. Calcular mastery por subject
  const categories: MasteryRadarItem[] = [];
  for (const s of filteredSubjects) {
    const sid = String(s.id);
    const agg = stats[sid];
    if (!agg || agg.totalReviews === 0) continue;

    const last10 = agg.recentPerformance.slice(-10);
    const pct = calculateMastery({
      correctReviews: agg.correctReviews,
      totalReviews: agg.totalReviews,
      avgResponseTimeMs: agg.responseTimeCount > 0
        ? Math.round(agg.totalResponseTime / agg.responseTimeCount)
        : 0,
      recentPerformance: last10,
    });
    categories.push({ name: agg.subjectName, value: pct, color: getMasteryColor(pct) });
  }

  if (categories.length === 0) {
    return {
      radar: [],
      averageMastery: 0,
      strongestArea: null,
      weakestArea: null,
      recommendation: 'Aún no hay suficientes datos de dominio. Crea y practica flashcards para generar analytics.',
    };
  }

  // 7. Calcular globales
  const avgMastery = Math.round(categories.reduce((sum, c) => sum + c.value, 0) / categories.length);
  const strongestArea = categories.reduce((a, b) => a.value > b.value ? a : b);
  const weakestArea = categories.reduce((a, b) => a.value < b.value ? a : b);
  const recommendation = weakestArea.value < 50
    ? `Enfócate en ${weakestArea.name} (${weakestArea.value}% dominio)`
    : `Estás bien equilibrado. Refuerza ${weakestArea.name} para mejorar`;

  return {
    radar: categories,
    averageMastery: avgMastery,
    strongestArea: { name: strongestArea.name, value: strongestArea.value },
    weakestArea: { name: weakestArea.name, value: weakestArea.value },
    recommendation,
  };
}

export async function getLocalGlobalGPA(userId: string): Promise<GlobalGPAAnalytics> {
  const db = databaseService.getDb();

  try {
    const assessments = await db.getAllAsync(
      `SELECT a.subject_id, a.grade_value, a.score, a.out_of, a.percentage, a.weight, a.normalized_value
       FROM assessments a
       JOIN subjects s ON a.subject_id = s.id
       WHERE s.user_id = ?
       AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL OR a.normalized_value IS NOT NULL)
       ORDER BY a.date ASC`,
      userId
    ) as any[];

    if (!assessments || assessments.length === 0) {
      return { currentAverage: 0, projectedGrade: 0, delta: 0, evaluatedWeight: 0, remainingWeight: 100, assessmentCount: 0, subjectCount: 0 };
    }

    let totalWeightedGrade = 0;
    let totalWeight = 0;
    const subjects = new Set<string>();

    for (const a of assessments) {
      if (a.subject_id) subjects.add(String(a.subject_id));

      let normalized = 0;
      if (typeof a.normalized_value === 'number') {
        normalized = a.normalized_value;
      } else if (typeof a.grade_value === 'number' && a.grade_value <= 5) {
        normalized = a.grade_value / 5;
      } else if (typeof a.score === 'number' && typeof a.out_of === 'number' && a.out_of > 0) {
        normalized = a.score / a.out_of;
      }

      let weight = 1;
      if (typeof a.percentage === 'number') {
        weight = a.percentage;
      } else if (typeof a.weight === 'number') {
        weight = a.weight;
      } else if (typeof a.weight === 'string') {
        weight = parseFloat(a.weight) || 1;
      }

      const gradeOutOf5 = normalized * 5;
      totalWeightedGrade += gradeOutOf5 * weight;
      totalWeight += weight;
    }

    const currentAverage = totalWeight > 0
      ? parseFloat((totalWeightedGrade / totalWeight).toFixed(2))
      : 0;

    return {
      currentAverage,
      projectedGrade: currentAverage,
      delta: 0,
      evaluatedWeight: Math.round((totalWeight / Math.max(totalWeight, 100)) * 100),
      remainingWeight: Math.max(0, 100 - Math.round((totalWeight / Math.max(totalWeight, 100)) * 100)),
      assessmentCount: assessments.length,
      subjectCount: subjects.size,
    };
  } catch (err) {
    console.warn('[LocalGPA] Error calculating GPA locally:', err);
    return { currentAverage: 0, projectedGrade: 0, delta: 0, evaluatedWeight: 0, remainingWeight: 100, assessmentCount: 0, subjectCount: 0 };
  }
}
