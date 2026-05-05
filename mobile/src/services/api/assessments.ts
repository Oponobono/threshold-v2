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
  if (!userId) return [];
  const response = await fetchWithFallback(`/assessments/user/${userId}`);
  return (await parseJsonSafely(response)) || [];
};

/**
 * Crea una nueva evaluación o tarea
 */
export const createAssessment = async (payload: Assessment) => {
  const response = await fetchWithFallback('/assessments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo crear la evaluación.');
  }
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
