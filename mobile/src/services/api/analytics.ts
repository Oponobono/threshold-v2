import { fetchWithFallback, parseJsonSafely, activeBaseUrl } from './client';
import * as FileSystem from 'expo-file-system';
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
  cardId: number;
  quality: number;
  nextReviewDate: string;
  newStability: number;
  newDifficulty: number;
  newRepetitions: number;
  retention: number;
  message: string;
}

/**
 * Obtiene las tarjetas de mayor urgencia para revisión predictiva (FSRS)
 */
export const getPredictions = async (userId: string | number): Promise<PredictionResponse> => {
  const response = await fetchWithFallback(`/analytics/predictions/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Error al obtener predicciones');
  const data = await parseJsonSafely(response);
  return data;
};

/**
 * Registra la revisión de una tarjeta y retorna nuevas métricas FSRS
 * @param cardId ID de la tarjeta a revisar
 * @param userId ID del usuario
 * @param result 'correct' o 'incorrect'
 * @param responseTimeMs Tiempo de respuesta en milisegundos
 */
export const recordCardReview = async (
  cardId: number,
  userId: number,
  result: 'correct' | 'incorrect',
  responseTimeMs: number
): Promise<CardReviewResponse> => {
  const response = await fetchWithFallback(`/flashcards/${cardId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, result, responseTimeMs }),
  });
  if (!response.ok) throw new Error('Error al registrar revisión de tarjeta');
  const data = await parseJsonSafely(response);
  return data;
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
  subjects: Array<{
    subject_id: number;
    subject_name: string;
    mastery_percentage: number;
    total_reviews: number;
    correct_reviews: number;
  }>;
  recent_activity: Array<{
    review_date: string;
    total_attempts: number;
    correct_attempts: number;
  }>;
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
  difficult_cards: Array<{
    id: number;
    front: string;
    total_attempts: number;
    error_count: number;
    failure_rate: number;
    fsrs_stability: number;
    fsrs_difficulty: number;
  }>;
  mastery_trend: Array<{
    review_date: string;
    total_attempts: number;
    correct_attempts: number;
  }>;
}

export interface ProgressTrends {
  user_id: number;
  period_days: number;
  daily_mastery: Array<{
    date: string;
    total_attempts: number;
    correct_attempts: number;
    daily_accuracy: number;
  }>;
  cards_timeline: Array<{
    date: string;
    cards_reviewed: number;
    cards_mastered: number;
  }>;
  subject_progress: Array<{
    subject_name: string;
    mastery_percentage: number;
    total_reviews: number;
    correct_reviews: number;
  }>;
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
  const response = await fetchWithFallback(`/analytics/user-stats/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Error al obtener estadísticas del usuario');
  const data = await parseJsonSafely(response);
  return data;
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

  const response = await fetchWithFallback(`/analytics/semester-summary/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Error al obtener resumen del semestre');
  const data = await parseJsonSafely(response);
  return data;
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
 * GET /api/analytics/mastery/:userId/:subjectId
 */
export const getMasteryAnalytics = async (userId: number, subjectId: number | 'all'): Promise<MasteryRadarData> => {
  const response = await fetchWithFallback(`/analytics/mastery/${userId}/${subjectId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Error al obtener analytics de dominio');
  const data = await parseJsonSafely(response);
  return data;
};

/**
 * Obtiene el GPA global agregado para todos los sujetos del usuario
 * Calcula el promedio ponderado de todas las evaluaciones realizadas
 */
export const getGlobalGPAAnalytics = async (): Promise<GlobalGPAAnalytics> => {
  const { getUserId } = await import('./auth');
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');
  
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
    
    return data || {
      currentAverage: 0,
      projectedGrade: 0,
      delta: 0,
      evaluatedWeight: 0,
      remainingWeight: 100,
      assessmentCount: 0,
      subjectCount: 0,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[getGlobalGPAAnalytics] Network error:`, errorMsg);
    throw error;
  }
};
