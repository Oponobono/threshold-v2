import { fetchWithFallback } from './client';

export interface AssessmentFile {
  id: string;
  assessment_id: string;
  file_name: string;
  file_type?: string;
  local_uri?: string;
  cloud_url?: string;
  file_size?: number;
  is_backed_up?: boolean;
  created_at?: string;
}

/**
 * Upload a file to an assessment
 */
export const uploadAssessmentFile = async (
  assessmentId: string,
  file: {
    file_name: string;
    file_type?: string;
    local_uri?: string;
    file_size?: number;
  }
): Promise<AssessmentFile> => {
  const response = await fetchWithFallback(
    `/assessments/${assessmentId}/files`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.status}`);
  }

  return response.json();
};

/**
 * Get all files for an assessment
 */
export const getAssessmentFiles = async (assessmentId: string): Promise<AssessmentFile[]> => {
  const response = await fetchWithFallback(
    `/assessments/${assessmentId}/files`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Failed to get files: ${response.status}`);
  }

  return response.json();
};

/**
 * Delete a file from an assessment
 */
export const deleteAssessmentFile = async (assessmentId: string, fileId: string): Promise<void> => {
  const response = await fetchWithFallback(
    `/assessments/${assessmentId}/files/${fileId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.status}`);
  }
};
