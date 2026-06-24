import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { Course } from './types';
import { courseRepository, syncService } from '../database';

const getUserIdNumber = async (): Promise<string> => {
  const uid = await getUserId();
  if (!uid) throw new Error('No hay sesión activa.');
  return String(uid);
};

export const createCourse = async (payload: {
  name: string;
  platform?: string;
  certificate_url?: string;
}): Promise<Course> => {
  const userId = await getUserIdNumber();
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();

  const course: Course = {
    id,
    user_id: userId,
    name: payload.name,
    platform: payload.platform,
    certificate_url: payload.certificate_url,
    momentum_score: 1.0,
  };

  await courseRepository.create(course);

  try {
    const response = await fetchWithFallback('/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...course, user_id: userId }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await courseRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor al crear curso');
  } catch {
    await syncService.enqueueCreate('course', id, { ...course, user_id: userId });
    return course;
  }
};

export const updateCourse = async (id: string, payload: Partial<Course>): Promise<void> => {
  const userId = await getUserIdNumber();
  await courseRepository.update(id, payload);

  try {
    const response = await fetchWithFallback(`/courses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, user_id: userId }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error del servidor al actualizar curso');
    }
  } catch {
    await syncService.enqueueUpdate('course', id, { ...payload, user_id: userId });
  }
};

export const deleteCourse = async (id: string): Promise<void> => {
  await courseRepository.delete(id);

  try {
    const response = await fetchWithFallback(`/courses/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Error al eliminar curso');
    }
  } catch {
    await syncService.enqueueDelete('course', id);
  }
};
