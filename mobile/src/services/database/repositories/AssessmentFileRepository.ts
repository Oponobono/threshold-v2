import { BaseRepository } from '../BaseRepository';

export interface AssessmentFile {
  id: string;
  assessment_id: string;
  file_name: string;
  file_type?: string;
  local_uri?: string;
  cloud_url?: string;
  file_size?: number;
  is_backed_up?: number | boolean;
  created_at?: string;
}

class AssessmentFileRepository extends BaseRepository<AssessmentFile> {
  constructor() {
    super('assessment_files');
  }

  async getByAssessment(assessmentId: string): Promise<AssessmentFile[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE assessment_id = ? ORDER BY created_at DESC`;
    return this.executeQuery(query, [assessmentId]);
  }
}

export const assessmentFileRepository = new AssessmentFileRepository();
