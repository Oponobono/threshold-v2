export interface GridMediaItem {
  id: string;
  name: string;
  type: 'recording' | 'video';
  date: string;
  created_at?: string;
  subject_name?: string;
  subject_color?: string;
  uri?: string;
  thumbnail_url?: string;
  video_id?: string;
  duration?: number;
  missingFile?: boolean;
  isStreaming?: boolean;
  isPlaying?: boolean;
}

export interface SubjectSection {
  subjectName: string;
  subjectColor?: string;
  items: GridMediaItem[];
}
