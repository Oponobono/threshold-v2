/**
 * assessments.ts
 *
 * Servicio CRUD para evaluaciones académicas (notas, tareas, exámenes).
 * Cada evaluación pertenece a una materia y puede tener peso porcentual,
 * calificación obtenida, fecha y tipo ('task' o evaluación tradicional).
 * Los datos son usados por `useSubjectGrades` para calcular el Threshold de aprobación.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { Assessment } from './types';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import { offlineSyncService } from '../offlineSyncService';



/**
 * Obtiene evaluaciones por materia
 */
export const getAssessments = async (subjectId: number) => {
  const response = await fetchWithFallback(`/assessments/${subjectId}`);
  return (await parseJsonSafely(response)) || [];
};

/**
 * Obtiene todas las evaluaciones del usuario
 */
export const getAllAssessments = async (): Promise<any[]> => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');
  const response = await fetchWithFallback(`/assessments/user/${userId}`);
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error al obtener evaluaciones.');
  }
  const data = await parseJsonSafely(response);
  return Array.isArray(data) ? data : [];
};

/**
 * Crea una nueva evaluación o tarea
 * Si falla la red, guarda en cola offline para sincronizar después
 */
export const createAssessment = async (payload: Assessment) => {
  console.log('[API/Assessments] createAssessment -> Sending payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithFallback('/assessments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);

    // Si el servidor devuelve 4xx/5xx con datos válidos, confiar en los datos
    if (!response.ok && !data?.id) {
      console.error('[API/Assessments] createAssessment failed:', data?.error || 'Unknown error', 'Status:', response.status);
      throw new Error(data?.error || 'No se pudo crear la evaluación.');
    }
    cacheService.clearKey(CACHE_KEYS.ASSESSMENTS);
    console.log('[API/Assessments] createAssessment success:', data);
    return data;
  } catch (error: any) {
    const isNetworkError = error.message?.includes('fetch') || error.message?.includes('Network');
    if (isNetworkError) {
      console.warn('[Assessments] Red no disponible, guardando en cola offline:', error);
      await offlineSyncService.addPendingOperation('POST', '/assessments', 'assessment', payload);
      const optimisticAssessment = { id: -Date.now(), ...payload, _isPending: true };
      // Persistir en cache local para visibilidad offline inmediata
      const existing: any[] | null = await cacheService.loadAssessments() as any[] | null;
      if (existing) {
        cacheService.saveAssessments([optimisticAssessment, ...existing]);
      } else {
        cacheService.saveAssessments([optimisticAssessment]);
      }
      return optimisticAssessment;
    }
    throw error; // errores del servidor se relanzan
  }
};

/**
 * Actualiza una evaluación o tarea existente
 * Si falla la red, guarda en cola offline para sincronizar después
 */
export const updateAssessment = async (id: number, payload: Partial<Assessment>) => {
  console.log(`[API/Assessments] updateAssessment (id:${id}) -> Sending payload:`, JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetchWithFallback(`/assessments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok && !data?.success) {
      console.error(`[API/Assessments] updateAssessment (id:${id}) failed:`, data?.error || 'Unknown error', 'Status:', response.status);
      throw new Error(data?.error || 'No se pudo actualizar la evaluación.');
    }
    cacheService.clearKey(CACHE_KEYS.ASSESSMENTS);
    console.log(`[API/Assessments] updateAssessment (id:${id}) success:`, data);
    return data;
  } catch (error: any) {
    const isNetworkError = error.message?.includes('fetch') || error.message?.includes('Network');
    if (isNetworkError) {
      console.warn(`[Assessments] Red no disponible, guardando actualización en cola offline:`, error);
      await offlineSyncService.addPendingOperation('PUT', `/assessments/${id}`, 'assessment', payload);
      return { success: true, message: 'Guardado localmente' };
    }
    throw error;
  }
};

/**
 * Elimina una evaluación o tarea
 */
export const deleteAssessment = async (id: number) => {
  try {
    const response = await fetchWithFallback(`/assessments/${id}`, {
      method: 'DELETE',
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo eliminar la evaluación.');
    }
    cacheService.clearKey(CACHE_KEYS.ASSESSMENTS);
    return data;
  } catch (error) {
    console.warn('[Assessments] Red no disponible, guardando eliminación en cola offline:', error);
    await offlineSyncService.addPendingOperation('DELETE', `/assessments/${id}`, 'assessment');
    return { success: true, _isPending: true };
  }
};

/**
 * Obtiene métricas de proyección para una materia
 * Calcula: PA (promedio actual), EMA (tendencia), NP (proyección final)
 * 
 * @param subjectId - ID de la materia
 * @returns {currentAverage, currentEMA, projectedGrade, delta, evaluatedWeight, remainingWeight}
 */
export const getProjectionAnalytics = async (subjectId: number) => {
  try {
    const url = `/assessments/analytics/subject/${subjectId}/projection`;
    console.log(`[API/Assessments] 🚀 Llamando getProjectionAnalytics con URL:`, url);
    
    const response = await fetchWithFallback(url);
    console.log(`[API/Assessments] 📡 Response status: ${response.status}`, response.statusText);
    
    const data = await parseJsonSafely(response);
    console.log(`[API/Assessments] 📦 Response data:`, JSON.stringify(data).substring(0, 200));
    
    if (!response.ok) {
      console.warn(
        `[API/Assessments] ❌ Error HTTP ${response.status} para subject ${subjectId}:`,
        data?.error || response.statusText || 'Sin detalles de error'
      );
      return null;
    }
    
    if (!data) {
      console.warn(`[API/Assessments] ⚠️ Response vacío para subject ${subjectId}`);
      return null;
    }
    
    console.log(`[API/Assessments] ✅ Proyección para subject ${subjectId}:`, {
      currentAverage: data.currentAverage,
      projectedGrade: data.projectedGrade,
      delta: data.delta,
    });
    return data;
  } catch (error) {
    console.warn(`[API/Assessments] ❌ Exception en getProjectionAnalytics:`, error instanceof Error ? error.message : String(error));
    return null;
  }
};


