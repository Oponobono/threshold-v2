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
import { cacheService } from './cacheService';

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
    const profile = await getCurrentUserProfile().catch(() => null);
    if (profile) await cacheService.saveProfile(profile);

    // ── Level 1: Subjects ──────────────────────────────────────────────
    onProgress({ phase: 'subjects', label: 'Materias', current: 1, total: 11 });
    const subjects = await getSubjects().catch(() => []);
    if (subjects && subjects.length > 0) await cacheService.saveSubjects(subjects);

    // ── Level 1: Assessments ───────────────────────────────────────────
    onProgress({ phase: 'assessments', label: 'Evaluaciones', current: 2, total: 11 });
    const assessments = await getAllAssessments().catch(() => []);
    if (assessments && assessments.length > 0) await cacheService.saveAssessments(assessments);

    // ── Level 1: Schedules ─────────────────────────────────────────────
    onProgress({ phase: 'schedules', label: 'Horarios', current: 3, total: 11 });
    const schedules = await getAllSchedules().catch(() => []);
    if (schedules && schedules.length > 0) await cacheService.saveSchedules(schedules);

    // ── Level 1: Gallery ───────────────────────────────────────────────
    onProgress({ phase: 'gallery', label: 'Galería', current: 4, total: 11 });
    const gallery = await getGalleryItems().catch(() => []);
    if (gallery && gallery.length > 0) await cacheService.saveGalleryItems(gallery);

    // ── Level 1: Audio ─────────────────────────────────────────────────
    onProgress({ phase: 'audio', label: 'Grabaciones', current: 5, total: 11 });
    const audio = await getAudioRecordings().catch(() => []);
    if (audio && audio.length > 0) await cacheService.saveAudioRecordings(audio);

    // ── Level 1: YouTube ───────────────────────────────────────────────
    onProgress({ phase: 'youtube', label: 'Videos', current: 6, total: 11 });
    const youtube = await getYouTubeVideos().catch(() => []);
    if (youtube && youtube.length > 0) await cacheService.saveYouTubeVideos(youtube);

    // ── Level 1: Flashcard Decks ───────────────────────────────────────
    onProgress({ phase: 'decks', label: 'Mazos', current: 7, total: 11 });
    const [decks, decksWithMetrics] = await Promise.all([
      getFlashcardDecks().catch(() => []),
      getFlashcardDecksWithMetrics().catch(() => []),
    ]);
    if (decks && decks.length > 0) await cacheService.saveFlashcardDecks(decks);
    if (decksWithMetrics && decksWithMetrics.length > 0) await cacheService.saveFlashcardDecksWithMetrics(decksWithMetrics);

    // ── Level 1: Calendar Events ───────────────────────────────────────
    onProgress({ phase: 'calendar', label: 'Eventos', current: 8, total: 11 });
    const calendarEvents = await getCalendarEvents().catch(() => []);
    if (calendarEvents && calendarEvents.length > 0) await cacheService.saveCalendarEvents(calendarEvents);

    // ── Level 1: Grading Systems ───────────────────────────────────────
    onProgress({ phase: 'grading', label: 'Sistemas de calificación', current: 9, total: 11 });
    const gradingSystems = await fetchGradingSystems().catch(() => []);
    if (gradingSystems && gradingSystems.length > 0) await cacheService.saveGradingSystems(gradingSystems);

    // ── Level 1: Predictions ───────────────────────────────────────────
    onProgress({ phase: 'predictions', label: 'Predicciones', current: 10, total: 11 });
    const predictions = await getPredictions(userId).catch(() => null);
    if (predictions) await cacheService.savePredictions(predictions);

    // ── Level 2: Per-Subject Data ──────────────────────────────────────
    const subjectsList = subjects && subjects.length > 0 ? subjects : [];
    onProgress({ phase: 'per_subject', label: 'Fotos, documentos y categorías', current: 0, total: subjectsList.length });

    for (let i = 0; i < subjectsList.length; i++) {
      const sub = subjectsList[i];
      const [photos, docs, categories] = await Promise.all([
        getPhotosBySubject(sub.id).catch(() => []),
        getScannedDocumentsBySubject(sub.id).catch(() => []),
        getCategoriesBySubject(sub.id).catch(() => []),
      ]);
      const saves: Promise<void>[] = [];
      if (photos && photos.length > 0) saves.push(cacheService.savePhotosBySubject(sub.id, photos));
      if (docs && docs.length > 0) saves.push(cacheService.saveScannedDocumentsBySubject(sub.id, docs));
      if (categories && categories.length > 0) saves.push(cacheService.saveAssessmentCategoriesBySubject(sub.id, categories));
      await Promise.all(saves);
      onProgress({ phase: 'per_subject', label: sub.name || `Materia ${sub.id}`, current: i + 1, total: subjectsList.length });
    }

    // ── Level 3: Per-Deck Data (Flashcards) ────────────────────────────
    const decksList = decks && decks.length > 0 ? decks : [];
    onProgress({ phase: 'per_deck', label: 'Tarjetas de mazos', current: 0, total: decksList.length });

    for (let i = 0; i < decksList.length; i++) {
      const deck = decksList[i];
      await Promise.all([
        getFlashcards(deck.id).catch(() => []).then(cards => {
          if (cards && cards.length > 0) return cacheService.saveFlashcardsByDeck(deck.id, cards);
        }),
        getFlashcardsPrioritized(deck.id).catch(() => []).then(cards => {
          if (cards && cards.length > 0) return cacheService.saveFlashcardsPrioritizedByDeck(deck.id, cards);
        }),
        getCardsNotSnoozed(deck.id).catch(() => []).then(cards => {
          if (cards && cards.length > 0) return cacheService.saveCardsNotSnoozedByDeck(deck.id, cards);
        }),
      ]);
      onProgress({ phase: 'per_deck', label: deck.title || `Mazo ${deck.id}`, current: i + 1, total: decksList.length });
    }

    onProgress({ phase: 'done', label: 'Completado', current: 0, total: 0 });
    return { success: true };
  } catch (error: any) {
    console.error('[Preloader] Error:', error);
    return { success: false, error: error.message };
  }
}
