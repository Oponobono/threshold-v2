import { fetchWithFallback, parseJsonSafely, activeBaseUrl } from './client';
import { storageService } from '../storageService';
import { syncService } from '../database';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface PredictionItem {
  cardId: number;
  question: string;
  deckId?: number;
  deckTitle?: string;
  subjectId: number;
  mastery: number;
  urgency: 'HIGH' | 'MEDIUM';
  failureRate?: number;
}

export interface PredictionResponse {
  dueCount: number;
  deckCount?: number;
  cards: PredictionItem[];
}

export interface CardReviewResponse {
  success: boolean;
  cardId: string;
  quality: number;
  nextReviewDate: string;
  newStability: number;
  newDifficulty: number;
  newRepetitions: number;
  retention: number;
  message: string;
  _isPending?: boolean;
}

/**
 * Obtiene las tarjetas de mayor urgencia para revisión predictiva (FSRS)
 */
export const getPredictions = async (userId: string | number): Promise<PredictionResponse> => {
  try {
    const response = await fetchWithFallback(`/analytics/predictions/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Error al obtener predicciones');
    const data = await parseJsonSafely(response);
    if (data) {
      await storageService.saveLocal('app:cache:predictions', JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.warn('[Analytics] Network error, falling back to cached predictions:', error);
    const cached = await storageService.getLocal('app:cache:predictions');
    if (cached) {
      console.log('[Analytics] ✅ Loaded predictions from cache (offline mode)');
      return JSON.parse(cached) as PredictionResponse;
    }
    throw error;
  }
};

/**
 * Registra la revisión de una tarjeta y retorna nuevas métricas FSRS
 * @param cardId ID de la tarjeta a revisar
 * @param userId ID del usuario
 * @param result 'correct' o 'incorrect'
 * @param responseTimeMs Tiempo de respuesta en milisegundos
 */
export const recordCardReview = async (
  cardId: string,
  userId: string,
  result: 'correct' | 'incorrect',
  responseTimeMs: number
): Promise<CardReviewResponse> => {
  try {
    // Local cards (negative IDs) - save pending review to MMKV instead of API
    const numericId = Number(cardId);
    if (!isNaN(numericId) && numericId < 0) {
      const { queuePendingReview } = await import('../localFlashcardService');
      await queuePendingReview({
        cardId: numericId,
        grade: result === 'correct' ? 4 : 1,
        status: result === 'correct' ? 'review' : 'learning',
        stability: 0,
        difficulty: 0,
      });
      return {
        success: true,
        cardId,
        quality: result === 'correct' ? 4 : 1,
        nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
        newStability: 0,
        newDifficulty: 0,
        newRepetitions: 1,
        retention: 0.9,
        message: 'Revisión guardada localmente como pendiente',
        _isPending: true,
      } as CardReviewResponse & { _isPending?: boolean };
    }

    const response = await fetchWithFallback(`/flashcards/${cardId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, result, responseTimeMs }),
    });
    if (!response.ok) throw new Error('Error al registrar revisión de tarjeta');
    const data = await parseJsonSafely(response);
    return data;
  } catch (error) {
    console.warn(`[Analytics] Offline: encolando recordCardReview para card ${cardId}`, error);
    await syncService.enqueueCreate('card-review', String(cardId), { userId, result, responseTimeMs });
    return {
      success: true,
      cardId,
      quality: 3,
      nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
      newStability: 0,
      newDifficulty: 0,
      newRepetitions: 1,
      retention: 0.9,
      message: 'Revisión guardada localmente, pendiente de sincronización',
      _isPending: true,
    } as CardReviewResponse & { _isPending?: boolean };
  }
};

/**
 * Descarga el informe PDF de dominio del estudiante y lo comparte usando
 * expo-file-system + expo-sharing. Funciona en iOS y Android.
 */
export const downloadReport = async (userId: string | number): Promise<void> => {
  const url = `${activeBaseUrl}/analytics/report/${userId}`;
  
  // Usamos una referencia local para evitar problemas de tipos en ciertas versiones de Expo
  const fs: any = FileSystem;
  const localUri = `${fs.cacheDirectory || ''}informe_dominio_${userId}.pdf`;

  const downloadResult = await fs.downloadAsync(url, localUri, {
    headers: { 'Accept': 'application/pdf' },
  });

  if (downloadResult.status !== 200) {
    throw new Error('Error al descargar el informe del servidor');
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Compartir no está disponible en este dispositivo');

  await Sharing.shareAsync(downloadResult.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Informe de Dominio · Threshold',
    UTI: 'com.adobe.pdf',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Statistics
// ─────────────────────────────────────────────────────────────────────────────

export interface UserStats {
  user_id: number;
  global_mastery: number;
  total_decks: number;
  total_cards: number;
  mastered_cards: number;
  learning_cards: number;
  new_cards: number;
  due_cards: number;
  subjects: {
    subject_id: number;
    subject_name: string;
    mastery_percentage: number;
    total_reviews: number;
    correct_reviews: number;
  }[];
  recent_activity: {
    review_date: string;
    total_attempts: number;
    correct_attempts: number;
  }[];
}

export interface DeckStats {
  deck_id: number;
  title: string;
  description: string;
  subject_name: string;
  mastery_percentage: number;
  total_cards: number;
  mastered_cards: number;
  learning_cards: number;
  new_cards: number;
  due_cards: number;
  total_reviews: number;
  difficult_cards: {
    id: number;
    front: string;
    total_attempts: number;
    error_count: number;
    failure_rate: number;
    fsrs_stability: number;
    fsrs_difficulty: number;
  }[];
  mastery_trend: {
    review_date: string;
    total_attempts: number;
    correct_attempts: number;
  }[];
}

export interface ProgressTrends {
  user_id: number;
  period_days: number;
  daily_mastery: {
    date: string;
    total_attempts: number;
    correct_attempts: number;
    daily_accuracy: number;
  }[];
  cards_timeline: {
    date: string;
    cards_reviewed: number;
    cards_mastered: number;
  }[];
  subject_progress: {
    subject_name: string;
    mastery_percentage: number;
    total_reviews: number;
    correct_reviews: number;
  }[];
}

export interface GlobalGPAAnalytics {
  currentAverage: number;
  projectedGrade: number;
  delta: number;
  evaluatedWeight: number;
  remainingWeight: number;
  assessmentCount: number;
  subjectCount: number;
}

/**
 * Obtiene estadísticas globales del usuario
 */
export const getUserStats = async (userId: number): Promise<UserStats> => {
  const CACHE_KEY = `app_api_cache:USER_STATS_${userId}`;
  try {
    const response = await fetchWithFallback(`/analytics/user-stats/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await parseJsonSafely(response);
    if (data) {
      await storageService.saveLocal(CACHE_KEY, JSON.stringify({ data: JSON.stringify(data), timestamp: Date.now() }));
    }
    return data;
  } catch (error) {
    console.warn('[Analytics] getUserStats falló, usando caché:', error);
    const cached = await storageService.getLocal(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return JSON.parse(parsed.data || parsed);
      } catch {}
    }
    throw error;
  }
};

/**
 * Obtiene estadísticas detalladas de un mazo específico
 */
export const getDeckStats = async (deckId: number, userId: number): Promise<DeckStats> => {
  const response = await fetchWithFallback(`/analytics/deck-stats/${deckId}/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Error al obtener estadísticas del mazo');
  const data = await parseJsonSafely(response);
  return data;
};

/**
 * Obtiene tendencia de progreso temporal del usuario
 * @param userId ID del usuario
 * @param days Número de días a analizar (7-365, default 30)
 */
export const getProgressTrends = async (userId: number, days?: number): Promise<ProgressTrends> => {
  const query = days ? `?days=${days}` : '';
  const response = await fetchWithFallback(`/analytics/progress-trends/${userId}${query}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Error al obtener tendencias de progreso');
  const data = await parseJsonSafely(response);
  return data;
};

export interface CriticalSubjectItem {
  id: number;
  name: string;
  avgScore: number;
  delta: number;
  color: string;
  targetGrade: number;
  icon: string;
}

export interface RecentActivityItem {
  id: number;
  name: string;
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  date: string;
}

export interface SemesterSummary {
  overallGpa: number;
  totalCredits: number;
  subjectCount: number;
  approvedCount: number;
  atRiskCount: number;
  criticalSubjects: CriticalSubjectItem[];
  recentActivity: RecentActivityItem[];
}

/**
 * Obtiene resumen consolidado del semestre para el Hub de materias
 * GET /api/analytics/semester-summary/:userId
 */
export const getSemesterSummary = async (): Promise<SemesterSummary> => {
  const { getUserId } = await import('./auth');
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  try {
    const response = await fetchWithFallback(`/analytics/semester-summary/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Error al obtener resumen del semestre');
    const data = await parseJsonSafely(response);
    if (data) {
      await storageService.saveLocal('app:cache:semester_summary', JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.warn('[Analytics] Network error, falling back to cached semester summary:', error);
    const cached = await storageService.getLocal('app:cache:semester_summary');
    if (cached) {
      console.log('[Analytics] ✅ Loaded semester summary from cache (offline mode)');
      return JSON.parse(cached) as SemesterSummary;
    }
    throw error;
  }
};

export interface MasteryRadarItem {
  name: string;
  value: number;
  color: string;
}

export interface MasteryRadarData {
  radar: MasteryRadarItem[];
  averageMastery: number;
  strongestArea: { name: string; value: number } | null;
  weakestArea: { name: string; value: number } | null;
  recommendation: string;
}

/**
 * Obtiene el análisis de dominio (mastery) para un usuario/materia
 * Offline-first: calcula localmente desde SQLite + MMKV, API como fallback
 */
export const getMasteryAnalytics = async (userId: string, subjectId: string | 'all'): Promise<MasteryRadarData> => {
  const CACHE_KEY = `app:cache:mastery_${userId}_${subjectId}`;

  // 1. Calcular localmente (SQLite card_logs + MMKV pending reviews)
  try {
    const { getLocalMasteryData } = await import('../localMasteryService');
    const localData = await getLocalMasteryData(userId, subjectId);
    if (localData.radar.length > 0) {
      await storageService.saveLocal(CACHE_KEY, JSON.stringify(localData));
      return localData;
    }
  } catch (err) {
    console.warn('[Analytics] Local mastery calculation failed:', err);
  }

  // 2. Fallback a API (para cuando el backend tenga métricas)
  try {
    const response = await fetchWithFallback(`/analytics/mastery/${userId}/${subjectId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Error al obtener analytics de dominio');
    const data = await parseJsonSafely(response);
    if (data && data.radar && data.radar.length > 0) {
      await storageService.saveLocal(CACHE_KEY, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn('[Analytics] Network error, falling back to cached mastery:', error);
  }

  // 3. Último recurso: cache
  const cached = await storageService.getLocal(CACHE_KEY);
  if (cached) {
    console.log('[Analytics] Loaded mastery from cache');
    return JSON.parse(cached) as MasteryRadarData;
  }

  return {
    radar: [],
    averageMastery: 0,
    strongestArea: null,
    weakestArea: null,
    recommendation: 'Aún no hay suficientes datos de dominio. Crea y practica flashcards para generar analytics.',
  };
};

/**
 * Obtiene el GPA global agregado para todos los sujetos del usuario
 * Offline-first: calcula localmente desde SQLite assessments, API como fallback
 */
export const getGlobalGPAAnalytics = async (): Promise<GlobalGPAAnalytics> => {
  const { getUserId } = await import('./auth');
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  // 1. Calcular localmente (SQLite assessments)
  try {
    const { getLocalGlobalGPA } = await import('../localMasteryService');
    const localData = await getLocalGlobalGPA(userId);
    if (localData.assessmentCount > 0) {
      await storageService.saveLocal('app:cache:global_gpa', JSON.stringify(localData));
      return localData;
    }
  } catch (err) {
    console.warn('[Analytics] Local GPA calculation failed:', err);
  }

  // 2. Fallback a API
  try {
    const url = `/analytics/global/gpa/${userId}`;
    const response = await fetchWithFallback(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await parseJsonSafely(response);
    
    if (!response.ok) {
      const errorMsg = data?.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error(`[getGlobalGPAAnalytics] Server error (${response.status}): ${errorMsg}`);
      throw new Error(`Error al obtener GPA global: ${errorMsg}`);
    }
    
    if (data && data.assessmentCount > 0) {
      await storageService.saveLocal('app:cache:global_gpa', JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn(`[getGlobalGPAAnalytics] Network error:`, error instanceof Error ? error.message : String(error));
  }

  // 3. Último recurso: cache
  const cached = await storageService.getLocal('app:cache:global_gpa');
  if (cached) {
    console.log('[Analytics] ✅ Loaded global GPA from cache');
    return JSON.parse(cached) as GlobalGPAAnalytics;
  }

  return {
    currentAverage: 0,
    projectedGrade: 0,
    delta: 0,
    evaluatedWeight: 0,
    remainingWeight: 100,
    assessmentCount: 0,
    subjectCount: 0,
  };
};
