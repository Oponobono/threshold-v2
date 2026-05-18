/**
 * types.ts
 *
 * Definiciones de tipos e interfaces compartidas por toda la capa de servicios.
 * Este archivo es la fuente de verdad de las entidades del dominio Threshold:
 * usuarios, materias, evaluaciones, fotos, horarios, mazos y tarjetas flash,
 * grabaciones de audio y videos de YouTube.
 */

/** Perfil académico completo del usuario autenticado */
export type UserProfile = {
  id: number;
  email: string;
  name?: string | null;
  lastname?: string | null;
  username?: string | null;
  grading_scale?: string | null;
  approval_threshold?: number | null;
  major?: string | null;
  university?: string | null;
  semester?: string | null;
  study_goal?: string | null;
  created_at?: string | null;
  last_login?: string | null;
  share_pin?: string | null;
  display_name?: string | null;
  profile_image?: string | null;  // URL de Uploadthing
};

/** Materia académica del usuario (curso o asignatura) */
export type Subject = {
  id: number;
  user_id: number;
  code: string;
  name: string;
  credits?: number | null;
  professor?: string | null;
  color?: string | null;
  icon?: string | null;
  target_grade?: number | null;
  avg_score?: number | null;
  completion_percent?: number | null;
};

/** Evaluación académica: nota, tarea o examen de una materia */
export type Assessment = {
  id?: number;
  subject_id: number;
  name: string;
  type?: string | null;
  date?: string | null;
  weight?: string | null;
  out_of?: number | null;
  score?: number | null;
  percentage?: number | null;
  grade_value?: number | null;
  is_completed?: boolean;
};

/** Foto de la galería vinculada a una materia */
export type Photo = {
  id?: number;
  subject_id: number;
  local_uri: string;
  created_at?: string;
  es_favorita?: number;
  ocr_text?: string | null;
  tags?: string | null;
  cloud_url?: string | null;       // URL de Uploadthing (si está respaldada)
  is_backed_up?: number;           // 0 = solo local, 1 = respaldada en la nube
};

/** Bloque de clase semanal de una materia (día, hora de inicio y fin) */
export type Schedule = {
  id: number;
  subject_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  name?: string;
  color?: string;
};

/** Mazo de tarjetas flash con metadatos de progreso por estado (new/learning/review) */
export interface FlashcardDeck {
  id: number;
  user_id?: number;
  subject_id?: number | null;
  title: string;
  description: string;
  created_at: string;
  card_count?: number;
  review_count?: number;
  learning_count?: number;
  new_count?: number;
  subject_name?: string;
  subject_color?: string;
  subject_icon?: string;
  owner_username?: string;
  owner_name?: string;
}

/** Tarjeta individual de un mazo con su contenido frontal/reverso y estado de repaso */
export interface Flashcard {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  status: string; // 'new', 'learning', 'review'
  created_at: string;
}

// ─── Motor de Evaluación Multiformato ────────────────────────────────────────

export type EvaluationItemType = 'flashcard' | 'multiple_choice' | 'boolean';

export interface FlashcardContent {
  front: string;
  back: string;
}

export interface MultipleChoiceContent {
  question: string;
  options: string[];       // Exactamente 4 opciones
  correctIndex: number;   // Índice 0-based de la opción correcta
}

export interface BooleanContent {
  question: string;
  correctAnswer: boolean;
}

export type EvaluationContent = FlashcardContent | MultipleChoiceContent | BooleanContent;

/** Ítem de evaluación genérico — reemplaza a Flashcard en la sesión de estudio */
export interface EvaluationItem {
  id: number;
  deck_id: number;
  item_type: EvaluationItemType;
  content: EvaluationContent;
  hint: string | null;        // Pista opcional visible antes de responder
  explanation: string | null; // Explicación de la respuesta correcta (post-respuesta)
  status: 'new' | 'learning' | 'review';
  created_at: string;
  // Campos legacy — solo presentes en item_type='flashcard'
  front?: string;
  back?: string;
}

/** Resultado de evaluar un ítem en la sesión de estudio */
export interface EvaluationResult {
  itemId: number;
  itemType: EvaluationItemType;
  passed: boolean;
  responseTimeMs: number;
  selectedAnswer?: number | boolean; // índice (MC) o bool (Boolean)
  selfRating?: 'learning' | 'review'; // solo para flashcard
}

export type StudyMode = 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';


/** Grabación de audio (.m4a) con sus rutas locales de transcripción y resumen */
export interface AudioRecording {
  id?: number;
  user_id: number;
  subject_id?: number | null;
  name?: string | null;
  local_uri: string;
  duration?: number;
  created_at?: string;
  subject_name?: string;
  subject_color?: string;
  subject_icon?: string;
  transcript_uri?: string;
  transcript_text?: string;
  summary_uri?: string;
  cloud_url?: string | null;       // URL de Uploadthing del audio
  is_backed_up?: number;           // 0 = solo local, 1 = respaldado
}

/** Video de YouTube enlazado con sus rutas locales de transcripción y resumen */
export interface YouTubeVideo {
  id?: number;
  user_id: number;
  subject_id?: number | null;
  youtube_url: string;
  video_id?: string;
  title?: string | null;
  thumbnail_url?: string | null;
  duration?: number;
  created_at?: string;
  subject_name?: string;
  subject_color?: string;
  subject_icon?: string;
  transcript_uri?: string;
  transcript_text?: string;
  summary_uri?: string;
}
