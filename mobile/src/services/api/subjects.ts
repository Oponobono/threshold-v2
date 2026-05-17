/**
 * subjects.ts
 *
 * Servicio CRUD para las materias académicas del usuario.
 * Una materia es la entidad central del ecosistema Threshold: agrupa grabaciones,
 * fotos, documentos, flashcards, horarios y evaluaciones.
 * Incluye el endpoint de predicción que sugiere la materia activa según el horario actual.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { Subject } from './types';

/**
 * Obtiene una materia específica
 */
export const getSubjectById = async (subjectId: number | string): Promise<Subject | null> => {
  const response = await fetchWithFallback(`/subject/${subjectId}`);
  if (!response.ok) return null;
  return await parseJsonSafely(response);
};

/**
 * Obtiene las materias del usuario
 */
export const getSubjects = async () => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');
  const response = await fetchWithFallback(`/subjects/${userId}`);
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error al obtener materias.');
  }
  const data = await parseJsonSafely(response);
  return Array.isArray(data) ? data : [];
};

/**
 * Crea una materia para el usuario actual
 */
export const createSubject = async (payload: {
  name: string;
  professor?: string;
  color?: string;
  icon?: string;
  target_grade?: number;
}) => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('No hay sesión activa.');
  }

  const response = await fetchWithFallback('/subjects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: Number(userId),
      ...payload,
    }),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo crear la materia.');
  }

  return data as Subject;
};

/**
 * Consulta el servidor para obtener la materia más probable según los bloques
 * de horario que coincidan con la hora y día actuales del usuario.
 */
export const getPredictedSubject = async (): Promise<Subject | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const response = await fetchWithFallback(`/prediction/${userId}`);
  return await parseJsonSafely(response);
};

/**
 * Elimina una materia
 */
export const deleteSubject = async (subjectId: number | string) => {
  const response = await fetchWithFallback(`/subjects/${subjectId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'No se pudo eliminar la materia.');
  }
  return await parseJsonSafely(response);
};

/**
 * Actualiza una materia existente
 */
export const updateSubject = async (subjectId: number | string, payload: Partial<Subject>) => {
  const response = await fetchWithFallback(`/subjects/${subjectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo actualizar la materia.');
  }

  return data;
};
