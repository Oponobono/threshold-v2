import { fetchWithFallback, parseJsonSafely } from './client';

export interface AssessmentCategory {
  id: number;
  subject_id: number;
  name: string;
  weight?: number;
  drop_lowest?: number;
}

export const getCategoriesBySubject = async (subjectId: string | number): Promise<AssessmentCategory[]> => {
  const response = await fetchWithFallback(`/subjects/${subjectId}/categories`);
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error fetching categories');
  }
  const data = await parseJsonSafely(response);
  return Array.isArray(data) ? data : [];
};

export const createCategory = async (subjectId: string | number, data: Partial<AssessmentCategory>): Promise<AssessmentCategory> => {
  const response = await fetchWithFallback(`/subjects/${subjectId}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error creating category');
  }
  return await parseJsonSafely(response);
};

export const updateCategory = async (id: string | number, data: Partial<AssessmentCategory>): Promise<void> => {
  const response = await fetchWithFallback(`/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error updating category');
  }
};

export const deleteCategory = async (id: string | number): Promise<void> => {
  const response = await fetchWithFallback(`/categories/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error deleting category');
  }
};
