import { fetchWithFallback } from './client';

export interface AssessmentFile {
  id: number;
  assessment_id: number;
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
  assessmentId: number,
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
    },
    'uploadAssessmentFile'
  );

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.status}`);
  }

  return response.json();
};

/**
 * Get all files for an assessment
 */
export const getAssessmentFiles = async (assessmentId: number): Promise<AssessmentFile[]> => {
  const response = await fetchWithFallback(
    `/assessments/${assessmentId}/files`,
    { method: 'GET' },
    'getAssessmentFiles'
  );

  if (!response.ok) {
    throw new Error(`Failed to get files: ${response.status}`);
  }

  return response.json();
};

/**
 * Delete a file from an assessment
 */
export const deleteAssessmentFile = async (assessmentId: number, fileId: number): Promise<void> => {
  const response = await fetchWithFallback(
    `/assessments/${assessmentId}/files/${fileId}`,
    { method: 'DELETE' },
    'deleteAssessmentFile'
  );

  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.status}`);
  }
};
