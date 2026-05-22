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
 */
export const createAssessment = async (payload: Assessment) => {
  console.log('[API/Assessments] createAssessment -> Sending payload:', JSON.stringify(payload, null, 2));
  const response = await fetchWithFallback('/assessments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);
  
  // Si obtenemos una respuesta con un ID válido, consideramos que fue exitoso
  // Incluso si el status es 400 (problema de status en el servidor)
  if (data && data.id) {
    console.log('[API/Assessments] createAssessment success (con ID):', data);
    return data;
  }

  if (!response.ok) {
    console.error('[API/Assessments] createAssessment failed:', data?.error || 'Unknown error', 'Status:', response.status);
    throw new Error(data?.error || 'No se pudo crear la evaluación.');
  }
  console.log('[API/Assessments] createAssessment success:', data);
  return data;
};

/**
 * Actualiza una evaluación o tarea existente
 */
export const updateAssessment = async (id: number, payload: Partial<Assessment>) => {
  console.log(`[API/Assessments] updateAssessment (id:${id}) -> Sending payload:`, JSON.stringify(payload, null, 2));
  const response = await fetchWithFallback(`/assessments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);
  
  // Si obtenemos una respuesta con datos válidos, consideramos que fue exitoso
  // incluso si el status es 400 (problema de status en el servidor)
  if (data && (data.message || data.success)) {
    console.log(`[API/Assessments] updateAssessment (id:${id}) success:`, data);
    return data;
  }

  if (!response.ok) {
    console.error(`[API/Assessments] updateAssessment (id:${id}) failed:`, data?.error || 'Unknown error', 'Status:', response.status);
    throw new Error(data?.error || 'No se pudo actualizar la evaluación.');
  }
  console.log(`[API/Assessments] updateAssessment (id:${id}) success:`, data);
  return data;
};

/**
 * Elimina una evaluación o tarea
 */
export const deleteAssessment = async (id: number) => {
  const response = await fetchWithFallback(`/assessments/${id}`, {
    method: 'DELETE',
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo eliminar la evaluación.');
  }

  return data;
};
