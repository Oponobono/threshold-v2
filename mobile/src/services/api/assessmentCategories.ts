import { fetchWithFallback, parseJsonSafely } from './client';
import { assessmentCategoryRepository, syncService } from '../database';
import type { AssessmentCategory } from './types';

export type { AssessmentCategory };

export const getCategoriesBySubject = async (subjectId: string): Promise<AssessmentCategory[]> => {
  // 1. Leer localmente primero
  const localData = await assessmentCategoryRepository.getBySubject(subjectId);

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/subjects/${subjectId}/categories`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) await assessmentCategoryRepository.upsert(c);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const createCategory = async (subjectId: string, data: Partial<AssessmentCategory>): Promise<AssessmentCategory> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();
  const category: any = { id, subject_id: subjectId, ...data };
  await assessmentCategoryRepository.create(category);

  try {
    const response = await fetchWithFallback(`/subjects/${subjectId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, id }),
    });
    if (!response.ok) throw new Error('Error creating category');
    const result = await parseJsonSafely(response);
    await assessmentCategoryRepository.upsert(result);
    return result;
  } catch {
    await syncService.enqueueCreate('category', id, { ...data, id });
    return category;
  }
};

export const updateCategory = async (id: string, data: Partial<AssessmentCategory>): Promise<void> => {
  await assessmentCategoryRepository.update(id, data);

  try {
    const response = await fetchWithFallback(`/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error updating category');
  } catch {
    await syncService.enqueueUpdate('category', id, data);
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  await assessmentCategoryRepository.delete(id);

  try {
    const response = await fetchWithFallback(`/categories/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Error deleting category');
  } catch {
    await syncService.enqueueDelete('category', id);
  }
};
