import { getUserId } from './api/auth';
import { getSubjects } from './api/subjects';
import { getAllAssessments } from './api/assessments';
import { getAllSchedules } from './api/schedules';
import { getGalleryItems, getPhotosBySubject } from './api/photos';
import { getAudioRecordings } from './api/audio';
import { getYouTubeVideos } from './api/youtube';
import { getFlashcardDecks, getFlashcards, getFlashcardsPrioritized, getCardsNotSnoozed, getFlashcardDecksWithMetrics } from './api/flashcards';
import { getCalendarEvents } from './api/calendar';
import { getScannedDocumentsBySubject } from './api/documents';
import { fetchGradingSystems } from './api/grading';
import { getCurrentUserProfile } from './api/auth';
import { getPredictions } from './api/analytics';
import { getCategoriesBySubject } from './api/assessmentCategories';

export interface PreloadProgress {
  phase: 'profile' | 'subjects' | 'assessments' | 'schedules' | 'gallery' | 'audio' | 'youtube' | 'decks' | 'calendar' | 'grading' | 'predictions' | 'per_subject' | 'per_deck' | 'done';
  label: string;
  current: number;
  total: number;
}

type OnProgress = (progress: PreloadProgress) => void;

const noop = () => {};

export async function preloadAllUserData(onProgress: OnProgress = noop): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    if (!userId) return { success: false, error: 'No hay sesión activa' };

    // ── Level 1: Profile ──────────────────────────────────────────────
    onProgress({ phase: 'profile', label: 'Perfil de usuario', current: 0, total: 11 });
    await getCurrentUserProfile().catch(() => null);

    // ── Level 1: Subjects ──────────────────────────────────────────────
    onProgress({ phase: 'subjects', label: 'Materias', current: 1, total: 11 });
    const subjects = await getSubjects().catch(() => []);

    // ── Level 1: Assessments ───────────────────────────────────────────
    onProgress({ phase: 'assessments', label: 'Evaluaciones', current: 2, total: 11 });
    await getAllAssessments().catch(() => []);

    // ── Level 1: Schedules ─────────────────────────────────────────────
    onProgress({ phase: 'schedules', label: 'Horarios', current: 3, total: 11 });
    await getAllSchedules().catch(() => []);

    // ── Level 1: Gallery ───────────────────────────────────────────────
    onProgress({ phase: 'gallery', label: 'Galería', current: 4, total: 11 });
    await getGalleryItems().catch(() => []);

    // ── Level 1: Audio ─────────────────────────────────────────────────
    onProgress({ phase: 'audio', label: 'Grabaciones', current: 5, total: 11 });
    await getAudioRecordings().catch(() => []);

    // ── Level 1: YouTube ───────────────────────────────────────────────
    onProgress({ phase: 'youtube', label: 'Videos', current: 6, total: 11 });
    await getYouTubeVideos().catch(() => []);

    // ── Level 1: Flashcard Decks ───────────────────────────────────────
    onProgress({ phase: 'decks', label: 'Mazos', current: 7, total: 11 });
    await Promise.all([
      getFlashcardDecks().catch(() => []),
      getFlashcardDecksWithMetrics().catch(() => []),
    ]);

    // ── Level 1: Calendar Events ───────────────────────────────────────
    onProgress({ phase: 'calendar', label: 'Eventos', current: 8, total: 11 });
    await getCalendarEvents().catch(() => []);

    // ── Level 1: Grading Systems ───────────────────────────────────────
    onProgress({ phase: 'grading', label: 'Sistemas de calificación', current: 9, total: 11 });
    await fetchGradingSystems().catch(() => []);

    // ── Level 1: Predictions ───────────────────────────────────────────
    onProgress({ phase: 'predictions', label: 'Predicciones', current: 10, total: 11 });
    await getPredictions(userId).catch(() => null);

    // ── Level 2: Per-Subject Data ──────────────────────────────────────
    const subjectsList = subjects && subjects.length > 0 ? subjects : [];
    onProgress({ phase: 'per_subject', label: 'Fotos, documentos y categorías', current: 0, total: subjectsList.length });

    for (let i = 0; i < subjectsList.length; i++) {
      const sub = subjectsList[i];
      await Promise.all([
        getPhotosBySubject(sub.id).catch(() => []),
        getScannedDocumentsBySubject(sub.id).catch(() => []),
        getCategoriesBySubject(sub.id).catch(() => []),
      ]);
      onProgress({ phase: 'per_subject', label: sub.name || `Materia ${sub.id}`, current: i + 1, total: subjectsList.length });
    }

    // ── Level 3: Per-Deck Data (Flashcards) ────────────────────────────
    const decksList = subjectsList; // Reuse subjects list — decks fetched above
    onProgress({ phase: 'per_deck', label: 'Tarjetas de mazos', current: 0, total: decksList.length });

    const { getFlashcardDecks: fetchDecksAgain } = await import('./api/flashcards');
    const freshDecks = await fetchDecksAgain().catch(() => []);
    for (let i = 0; i < freshDecks.length; i++) {
      const deck = freshDecks[i];
      await Promise.all([
        getFlashcards(deck.id).catch(() => []),
        getFlashcardsPrioritized(deck.id).catch(() => []),
        getCardsNotSnoozed(deck.id).catch(() => []),
      ]);
      onProgress({ phase: 'per_deck', label: deck.title || `Mazo ${deck.id}`, current: i + 1, total: freshDecks.length });
    }

    onProgress({ phase: 'done', label: 'Completado', current: 0, total: 0 });
    return { success: true };
  } catch (error: any) {
    console.error('[Preloader] Error:', error);
    return { success: false, error: error.message };
  }
}