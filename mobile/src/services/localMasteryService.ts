import { databaseService } from './database/DatabaseService';
import { getLocalDecksForCurrentUser, getPendingReviews } from './localFlashcardService';
import type { MasteryRadarData, MasteryRadarItem, GlobalGPAAnalytics, PredictionResponse, PredictionItem } from './api/analytics';

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

  const localDecks = getLocalDecksForCurrentUser(userId);
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

/** Lee tarjetas vencidas desde SQLite + MMKV y calcula predicciones FSRS localmente */
export async function getLocalPredictions(userId: string): Promise<PredictionResponse> {
  const db = databaseService.getDb();
  const now = new Date().toISOString();

  // 1. Cloud cards (SQLite) — mismas condiciones que el backend
  const sqliteDue: any[] = [];
  try {
    const rows = await db.getAllAsync(
      `SELECT
         fc.id, fc.front, fc.deck_id, fc.status, fc.next_review_date,
         COALESCE((SELECT name FROM subjects WHERE id = fd.subject_id), '') as subject_name,
         fd.title as deck_title,
         fd.subject_id
       FROM flashcards fc
       JOIN flashcard_decks fd ON fc.deck_id = fd.id
       WHERE fd.user_id = ?
       AND fc.status IN ('new', 'learning')
       AND fc.next_review_date IS NOT NULL
       AND fc.next_review_date <= ?`,
      userId, now
    ) as any[];
    sqliteDue.push(...(rows || []));
  } catch { /* ignore */ }

  // 2. Local cards (MMKV)
  const localDecks = getLocalDecksForCurrentUser(userId);
  const localDue: any[] = [];
  const mmkv = require('react-native-mmkv').createMMKV();
  for (const deck of localDecks) {
    try {
      const raw = mmkv.getString(`cache:flashcards_by_deck:${deck.id}`);
      if (!raw) continue;
      const entry = JSON.parse(raw);
      const cards: any[] = entry.data || entry || [];
      for (const card of cards) {
        if (card.status === 'review' || card.status === 'mastered') continue;
        const nrd = card.next_review_date;
        if (!nrd) continue;
        if (nrd <= now) {
          localDue.push({
            id: card.id,
            front: card.front || card.content?.front || '',
            deck_id: deck.id,
            status: card.status || 'new',
            next_review_date: nrd,
            deck_title: deck.title,
            subject_id: deck.subject_id ?? 0,
            subject_name: '',
          });
        }
      }
    } catch {}
  }

  const allDue = [...sqliteDue, ...localDue];
  if (allDue.length === 0) return { dueCount: 0, deckCount: 0, cards: [] };

  // 3. Contar mazos únicos con vencidas
  const uniqueDeckIds = new Set(allDue.map(c => String(c.deck_id)));
  const dueDeckCount = uniqueDeckIds.size;

  // 4. Calcular failure rate desde card_logs + pending reviews
  const pendingReviews = getPendingReviews();
  const pendingMap: Record<number, number> = {};
  for (const r of pendingReviews) {
    if (!pendingMap[r.cardId]) pendingMap[r.cardId] = 0;
    pendingMap[r.cardId]++;
    if (r.grade < 3) pendingMap[r.cardId] = -999; // mark as incorrect
  }

  // 5. Obtener failure_rate desde SQLite en batch
  const cardIds = allDue.map(c => c.id).filter(Boolean);
  const failureRateMap: Record<string, number> = {};
  if (cardIds.length > 0) {
    try {
      const placeholders = cardIds.map(() => '?').join(',');
      const logs = await db.getAllAsync(
        `SELECT card_id,
                CAST(COALESCE(SUM(CASE WHEN result = 'incorrect' THEN 1 ELSE 0 END), 0) AS REAL) /
                CAST(COALESCE(COUNT(*), 1) AS REAL) as failure_rate
         FROM card_logs WHERE card_id IN (${placeholders}) GROUP BY card_id`,
        ...cardIds
      ) as any[];
      for (const row of logs) {
        failureRateMap[row.card_id] = row.failure_rate || 0;
      }
    } catch {}
  }

  // 6. Construir predicciones
  const cards: PredictionItem[] = allDue.map(c => {
    const fr = failureRateMap[c.id] ?? (pendingMap[c.id] === -999 ? 1 : 0);
    const mastery = Math.max(0, Math.round((1 - fr) * 100));
    return {
      cardId: Number(c.id),
      question: c.front || '',
      deckId: c.deck_id,
      deckTitle: c.deck_title || '',
      subjectId: c.subject_id || 0,
      mastery,
      urgency: mastery < 50 ? 'HIGH' as const : 'MEDIUM' as const,
      failureRate: Math.round(fr * 100),
    };
  });

  // 7. Ordenar igual que el backend: mastery ASC, next_review_date ASC
  cards.sort((a, b) => a.mastery - b.mastery);

  return {
    dueCount: dueDeckCount,
    deckCount: dueDeckCount,
    cards: cards.slice(0, 20),
  };
}

export async function getLocalDeckStats(deckId: number, userId: number): Promise<any> {
  const db = databaseService.getDb();
  
  const deckRow = await db.getFirstAsync(
    `SELECT d.*, s.name as subject_name 
     FROM flashcard_decks d 
     LEFT JOIN subjects s ON d.subject_id = s.id 
     WHERE d.id = ? AND d.user_id = ?`,
    deckId, userId
  ) as any;
  
  if (!deckRow) throw new Error('Mazo no encontrado localmente');
  
  const cards = await db.getAllAsync(`SELECT * FROM flashcards WHERE deck_id = ?`, deckId) as any[];
  const cardIds = cards.map(c => c.id);
  
  let totalReviews = 0;
  let correctReviews = 0;
  let difficult_cards: any[] = [];
  let mastery_trend: any[] = [];
  
  if (cardIds.length > 0) {
    const placeholders = cardIds.map(() => '?').join(',');
    
    // Total reviews
    const logs = await db.getAllAsync(
      `SELECT result, DATE(created_at) as review_date FROM card_logs WHERE card_id IN (${placeholders}) ORDER BY created_at ASC`,
      ...cardIds
    ) as any[];
    
    const trendMap: Record<string, { total: number; correct: number }> = {};
    
    for (const log of logs) {
      totalReviews++;
      const isCorrect = log.result === 'correct';
      if (isCorrect) correctReviews++;
      
      const date = log.review_date || new Date().toISOString().split('T')[0];
      if (!trendMap[date]) trendMap[date] = { total: 0, correct: 0 };
      trendMap[date].total++;
      if (isCorrect) trendMap[date].correct++;
    }
    
    mastery_trend = Object.keys(trendMap).sort().map(date => ({
      review_date: date,
      total_attempts: trendMap[date].total,
      correct_attempts: trendMap[date].correct,
    }));
    
    // Difficult cards
    const errorStats = await db.getAllAsync(
      `SELECT card_id, 
              COUNT(*) as total_attempts, 
              SUM(CASE WHEN result = 'incorrect' THEN 1 ELSE 0 END) as error_count 
       FROM card_logs 
       WHERE card_id IN (${placeholders}) 
       GROUP BY card_id 
       HAVING error_count > 0
       ORDER BY error_count DESC LIMIT 5`,
      ...cardIds
    ) as any[];
    
    difficult_cards = errorStats.map(stat => {
      const card = cards.find(c => String(c.id) === String(stat.card_id));
      return {
        id: stat.card_id,
        front: card?.front || 'Desconocida',
        total_attempts: stat.total_attempts,
        error_count: stat.error_count,
        failure_rate: Math.round((stat.error_count / stat.total_attempts) * 100),
        fsrs_stability: 0,
        fsrs_difficulty: 0,
      };
    });
  }

  const now = new Date().toISOString();
  
  return {
    deck_id: deckId,
    title: deckRow.title,
    description: deckRow.description || '',
    subject_name: deckRow.subject_name || 'General',
    mastery_percentage: totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0,
    total_cards: cards.length,
    mastered_cards: cards.filter(c => c.status === 'mastered').length,
    learning_cards: cards.filter(c => c.status === 'learning' || c.status === 'review').length,
    new_cards: cards.filter(c => c.status === 'new').length,
    due_cards: cards.filter(c => c.next_review_date && c.next_review_date <= now && c.status !== 'mastered').length,
    total_reviews: totalReviews,
    difficult_cards,
    mastery_trend,
  };
}

export async function getLocalProgressTrends(userId: number, days: number = 30): Promise<any> {
  const db = databaseService.getDb();
  
  // daily_mastery
  const dailyLogs = await db.getAllAsync(
    `SELECT DATE(created_at) as date, 
            COUNT(*) as total_attempts, 
            SUM(CASE WHEN result = 'correct' THEN 1 ELSE 0 END) as correct_attempts
     FROM card_logs 
     WHERE user_id = ? AND created_at >= date('now', '-${days} days')
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    userId
  ) as any[];
  
  const daily_mastery = dailyLogs.map(row => ({
    date: row.date,
    total_attempts: row.total_attempts,
    correct_attempts: row.correct_attempts,
    daily_accuracy: row.total_attempts > 0 ? Math.round((row.correct_attempts / row.total_attempts) * 100) : 0,
  }));
  
  // Subject progress
  const masteryData = await getLocalMasteryData(String(userId), 'all');
  const subject_progress = masteryData.radar.map(item => ({
    subject_name: item.name,
    mastery_percentage: item.value,
    total_reviews: 0, // Simplified for offline
    correct_reviews: 0,
  }));
  
  return {
    user_id: userId,
    period_days: days,
    daily_mastery,
    cards_timeline: daily_mastery.map(d => ({ date: d.date, cards_reviewed: d.total_attempts, cards_mastered: 0 })),
    subject_progress,
  };
}

export async function getLocalSemesterSummary(userId: number): Promise<any> {
  const db = databaseService.getDb();
  
  const subjects = await db.getAllAsync(`SELECT * FROM subjects WHERE user_id = ?`, userId) as any[];
  const gpaData = await getLocalGlobalGPA(String(userId));
  
  const criticalSubjects: any[] = [];
  let approvedCount = 0;
  let atRiskCount = 0;
  
  for (const sub of subjects) {
    const subGpa = sub.avg_score || sub.gpa_equivalent || 0;
    const target = sub.target_grade || 3.0; // Assume 3.0 passing if not set
    
    if (subGpa >= target) approvedCount++;
    else if (subGpa > 0) atRiskCount++;
    
    if (subGpa > 0 && subGpa < target) {
      criticalSubjects.push({
        id: sub.id,
        name: sub.name,
        avgScore: parseFloat(subGpa.toFixed(2)),
        delta: parseFloat((subGpa - target).toFixed(2)),
        color: sub.color || '#3B82F6',
        targetGrade: target,
        icon: sub.icon || 'book',
      });
    }
  }
  
  criticalSubjects.sort((a, b) => a.delta - b.delta); // most negative first
  
  // Recent activity
  const recentLogs = await db.getAllAsync(
    `SELECT a.id, a.name, a.subject_id, s.name as subjectName, s.color as subjectColor, a.created_at as date
     FROM assessments a
     JOIN subjects s ON a.subject_id = s.id
     WHERE s.user_id = ?
     ORDER BY a.created_at DESC LIMIT 5`,
    userId
  ) as any[];
  
  const recentActivity = recentLogs.map(r => ({
    id: r.id,
    name: r.name,
    subjectId: r.subject_id,
    subjectName: r.subjectName,
    subjectColor: r.subjectColor,
    date: r.date,
  }));
  
  return {
    overallGpa: gpaData.currentAverage,
    totalCredits: subjects.reduce((sum, s) => sum + (s.credits || 0), 0),
    subjectCount: subjects.length,
    approvedCount,
    atRiskCount,
    criticalSubjects: criticalSubjects.slice(0, 3),
    recentActivity,
  };
}
