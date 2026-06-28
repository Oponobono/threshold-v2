export type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
  lastname?: string | null;
  username?: string | null;
  active_grading_version_id?: string | null;
  major?: string | null;
  university?: string | null;
  semester?: string | null;
  study_goal?: string | null;
  reference_language?: string | null;
  biometric_token?: string | null;
  created_at?: string | null;
  last_login?: string | null;
  share_pin?: string | null;
  display_name?: string | null;
  profile_image?: string | null;
  approval_threshold?: number | null;
  grading_scale?: string | null;
};

export type Course = {
  id: string;
  user_id: string;
  name: string;
  platform?: string;
  certificate_url?: string;
  main_url?: string;
  deep_link_url?: string;
  instructor?: string;
  total_hours?: number;
  total_classes?: number;
  completed_classes?: number;
  status?: string;
  global_notes?: string;
  tags?: string;
  momentum_score?: number;
  last_studied_at?: string;
  is_backed_up?: number;
  created_at?: string;
  updated_at?: string;
};


export type Subject = {
  id: string;
  user_id: string;
  code?: string;
  name: string;
  credits?: number;
  professor?: string;
  color?: string;
  icon?: string;
  target_grade?: number;
  avg_score?: number;
  normalized_avg_score?: number;
  completion_percent?: number;
  display_label?: string;
  display_color?: string;
  gpa_equivalent?: number;
  course_id?: string | null;
  external_url?: string | null;
  total_lessons?: number;
  completed_lessons?: number;
  next_micro_milestone?: string | null;
};

export type Assessment = {
  id?: string;
  subject_id: string;
  name: string;
  type?: string;
  date?: string;
  weight?: number;
  out_of?: number;
  score?: number;
  percentage?: number;
  grade_value?: number;
  normalized_value?: number;
  is_completed?: number;
  display_label?: string;
  display_color?: string;
  gpa_equivalent?: number;
  category_id?: string;
  due_date?: string;
  grading_date?: string;
};

export type Photo = {
  id: string;
  subject_id: string;
  local_uri: string;
  created_at?: string;
  es_favorita?: number;
  ocr_text?: string;
  tags?: string;
  cloud_url?: string;
  is_backed_up?: number;
  group_id?: string;
};

export type Schedule = {
  id: string;
  user_id: string;
  subject_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  name?: string;
  color?: string;
};

export interface FlashcardDeck {
  id: string;
  user_id?: string;
  subject_id?: string | null;
  title: string;
  description?: string;
  created_at?: string;
  card_count?: number;
  review_count?: number;
  learning_count?: number;
  new_count?: number;
  subject_name?: string;
  subject_color?: string;
  subject_icon?: string;
  owner_username?: string;
  owner_name?: string;
  linked_exam_title?: string;
  linked_exam_date?: string;
  avg_ease_factor?: number;
  total_reviews?: number;
  last_reviewed_at?: string;
}

export type CardDirection = 'forward' | 'backward' | 'bidirectional';

export interface Flashcard {
  id: string;
  deck_id: string;
  front: string;
  back?: string;
  status?: string;
  direction?: CardDirection;
  source_context?: string;
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
  next_review_at?: string;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  created_at?: string;
}

export type EvaluationItemType = 'flashcard' | 'multiple_choice' | 'boolean';

export interface FlashcardContent {
  front: string;
  back: string;
}

export interface MultipleChoiceContent {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface BooleanContent {
  question: string;
  correctAnswer: boolean;
}

export type EvaluationContent = FlashcardContent | MultipleChoiceContent | BooleanContent;

export interface EvaluationItem {
  id: string;
  deck_id: string;
  item_type: EvaluationItemType;
  content: EvaluationContent;
  hint?: string;
  explanation?: string;
  source_context?: string;
  status: 'new' | 'learning' | 'review';
  created_at: string;
  front?: string;
  back?: string;
}

export interface EvaluationResult {
  itemId: string;
  itemType: EvaluationItemType;
  passed: boolean;
  responseTimeMs: number;
  selectedAnswer?: number | boolean;
  selfRating?: 'learning' | 'review';
}

export type StudyMode = 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';

export interface AudioRecording {
  id: string;
  user_id: string;
  subject_id?: string;
  name?: string;
  local_uri?: string;
  duration?: number;
  created_at?: string;
  updated_at?: string;
  subject_name?: string;
  subject_color?: string;
  subject_icon?: string;
  transcript_uri?: string;
  transcript_text?: string;
  summary_uri?: string;
  summary_text?: string;
  cloud_url?: string;
  is_backed_up?: number;
  id_string?: string;
  uri?: string;
}

export interface YouTubeVideo {
  id: string;
  user_id: string;
  subject_id?: string;
  youtube_url?: string;
  video_id?: string;
  title?: string;
  thumbnail_url?: string;
  duration?: number;
  created_at?: string;
  updated_at?: string;
  subject_name?: string;
  subject_color?: string;
  subject_icon?: string;
  transcript_uri?: string;
  transcript_text?: string;
  summary_uri?: string;
  summary_text?: string;
}

export interface AssessmentCategory {
  id: string;
  user_id?: string;
  subject_id?: string;
  name: string;
  weight?: number;
  drop_lowest?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StudySession {
  id: string;
  user_id?: string;
  subject_id?: string;
  deck_id?: string;
  session_type?: 'Pomodoro' | 'Threshold';
  config_value?: number;
  duration_seconds?: number;
  duration_minutes?: number;
  cards_reviewed?: number;
  performance_rating?: number;
  rating?: string;
  start_timestamp?: string;
  created_at?: string;
}

export interface CardLog {
  id: string;
  card_id: string;
  user_id?: string;
  result?: string;
  response_time_ms?: number;
  question_word_count?: number;
  timestamp?: string;
  created_at?: string;
}
