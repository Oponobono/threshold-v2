import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import {
  getAssessments,
  getSubjectById,
  getPhotosBySubject,
  getCurrentUserProfile,
  getSchedulesBySubject,
  getAudioRecordings,
  getYouTubeVideos,
  getScannedDocumentsBySubject,
  deleteYouTubeVideo,
  deleteSubject,
  type Subject,
  type UserProfile,
  type YouTubeVideo,
  type ScannedDocument,
} from '../services/api';
import { useSubjectGrades } from './useSubjectGrades';
import { useAudioRecorder } from './useAudioRecorder';
import { useDataStore } from '../store/useDataStore';
import { useConnectivityStore } from '../store/useConnectivityStore';
import { photoRepository, documentRepository, youTubeRepository, studyNoteRepository } from '../services/database';
import { useCustomAlert, alertRef } from '../components/ui/CustomAlert';
import { generatePdfFromImages } from '../utils/pdfGenerator';

type DetailSubject = Subject & {
  avg_score?: number | null;
  completion_percent?: number | null;
  course_name?: string;
  milestone?: string;
};

export function useSubjectDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string }>();
  const { subjects: storeSubjects, assessments: storeAssessments, refreshAssessments } = useDataStore();
  const { showAlert } = useCustomAlert();
  const { playSound, stopSound, playingId, deleteRecordingConfirmed, recordings, cleanupAudio } = useAudioRecorder();

  const subjectId = useMemo(() => {
    const raw = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
    return raw || null;
  }, [params.subjectId]);

  // ── Hydratación instantánea desde el store Zustand (ya cargado por MMKV) ────
  // Esto evita que la pantalla muestre datos vacíos mientras la red responde.
  const immediateSubject = useMemo(() => {
    if (!subjectId) return null;
    return (storeSubjects.find(s => s.id === subjectId) as DetailSubject) ?? null;
  }, [subjectId, storeSubjects]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<DetailSubject | null>(immediateSubject);
  const [subjectSchedules, setSubjectSchedules] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocument[]>([]);
  const [studyNotes, setStudyNotes] = useState<any[]>([]);
  const [allSubjects] = useState<Subject[]>([]);
  // Si ya tenemos el sujeto en caché, no mostramos el spinner de carga inicial.
  const [isLoading, setIsLoading] = useState(immediateSubject === null);
  const [isDetailLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  // Ref para saber si ya tenemos datos al entrar (evita closure stale en effect)
  const hadInitialDataRef = useRef(immediateSubject !== null);

  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  const [isPDFImportVisible, setIsPDFImportVisible] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [isCreateGradeVisible, setIsCreateGradeVisible] = useState(false);
  const [initialViewerIndex, setInitialViewerIndex] = useState(0);

  const [recentVideos, setRecentVideos] = useState<YouTubeVideo[]>([]);
  const [allSubjectVideos, setAllSubjectVideos] = useState<YouTubeVideo[]>([]);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');

  const [isFlashcardModalVisible, setIsFlashcardModalVisible] = useState(false);
  const [flashcardContextText, setFlashcardContextText] = useState<string>('');
  const [flashcardBase64, setFlashcardBase64] = useState<string>('');

  // Stop audio when leaving the subject screen
  useFocusEffect(
    useCallback(() => {
      return () => { cleanupAudio(); };
    }, [cleanupAudio])
  );

  // All recordings for this subject
  const allSubjectRecordings = useMemo(() => {
    if (!subjectId || !recordings) return [];
    return recordings.filter(r => r.subject_id == subjectId);
  }, [recordings, subjectId]);

  const recentRecordings = useMemo(() => allSubjectRecordings.slice(0, 3), [allSubjectRecordings]);

  // Sync immediateSubject → selectedSubject cuando cambia el subjectId
  // (navegación entre materias sin desmontar el componente)
  useEffect(() => {
    if (immediateSubject && !selectedSubject) {
      setSelectedSubject(immediateSubject);
    }
  }, [immediateSubject, selectedSubject]);

  // Data loading — Network First con fallback al caché ya aplicado en cada API
  useEffect(() => {
    let mounted = true;

    const loadAllData = async () => {
      if (!subjectId) return;
      // Solo mostrar spinner si no tenemos datos de caché previos
      if (!hadInitialDataRef.current) setIsLoading(true);
      // Resetear para próximas navegaciones
      hadInitialDataRef.current = false;
      const isOnline = useConnectivityStore.getState().isOnline;

      try {
        const pProfile = getCurrentUserProfile().then(p => {
          if (mounted && p) setProfile(p);
        });

        const pSubject = getSubjectById(subjectId).then(s => {
          if (mounted && s) {
            const existsInStore = useDataStore.getState().subjects.some(storeSub => String(storeSub.id) === String(s.id));
            if (existsInStore) {
              setSelectedSubject(s as DetailSubject);
            } else {
              console.warn(`[useSubjectDetail] Materia ${s.id} ignorada — ya no existe en el store`);
            }
          }
        });

        const pPhotos = getPhotosBySubject(subjectId)
          .then(p => { if (mounted && p) setPhotos(p); })
          .catch(async () => {
            if (!isOnline && mounted) {
              const cached = await photoRepository.getBySubject(subjectId);
              if (cached.length > 0 && mounted) setPhotos(cached);
            }
          });

        const pDocs = getScannedDocumentsBySubject(subjectId)
          .then(d => { if (mounted && d) setScannedDocuments(d); })
          .catch(async () => {
            if (!isOnline && mounted) {
              const cached = await documentRepository.getBySubject(subjectId);
              if (cached.length > 0 && mounted) setScannedDocuments(cached);
            }
          });

        const pAssessments = getAssessments(subjectId);

        const pSchedules = getSchedulesBySubject(subjectId)
          .then(s => { if (mounted && s) setSubjectSchedules(s); })
          .catch(async () => {
            if (!isOnline && mounted) {
              const store = useDataStore.getState();
              const cached = store.schedules.filter(sch => sch.subject_id === subjectId);
              if (cached.length > 0 && mounted) setSubjectSchedules(cached);
            }
          });

        const pAudio = getAudioRecordings();

        const pVideos = getYouTubeVideos()
          .then(v => {
            if (mounted && v) {
              const videoList = Array.isArray(v) ? v : [];
              const filtered = videoList.filter(vid => vid.subject_id == subjectId);
              setAllSubjectVideos(filtered);
              setRecentVideos(filtered.slice(0, 3));
            }
          })
          .catch(async () => {
            if (!isOnline && mounted) {
              const cached = await youTubeRepository.getBySubject(String(subjectId));
              if (cached.length > 0 && mounted) {
                const filtered = cached.filter(vid => vid.subject_id === subjectId);
                if (filtered.length > 0) {
                  setAllSubjectVideos(filtered);
                  setRecentVideos(filtered.slice(0, 3));
                }
              }
            }
          });

        const pNotes = studyNoteRepository.getBySubject(subjectId)
          .then(n => { if (mounted && n) setStudyNotes(n); })
          .catch(() => {});

        await Promise.allSettled([
          pProfile,
          pSubject,
          pPhotos,
          pDocs,
          pAssessments,
          pSchedules,
          pAudio,
          pVideos,
          pNotes,
        ]);
      } catch (err) {
        console.error('Error loading subject data:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
      loadAllData();
    });

    return () => {
      mounted = false;
      task.cancel();
    };
  }, [subjectId]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { stopSound(); };
  }, [stopSound]);

  // Filter assessments for this subject from the global store
  const subjectAssessments = useMemo(() => {
    if (!subjectId) return [];
    return storeAssessments.filter(a => a.subject_id === subjectId);
  }, [storeAssessments, subjectId]);

  const {
    averageGrade,
    projectedGrade,
    delta,
    deliveredText,
    securedPercent,
    finalNeededText,
    recentAssessments,
    thresholdStatus,
  } = useSubjectGrades(subjectAssessments, selectedSubject, profile);

  const imagePhotos = useMemo(() => photos.filter(p => !p.local_uri?.endsWith('.pdf')), [photos]);
  const pdfDocuments = useMemo(() => {
    const oldPdfs = photos.filter(p => p.local_uri?.endsWith('.pdf')).map(p => ({ ...p, is_legacy_photo: true }));
    return [...scannedDocuments, ...oldPdfs];
  }, [photos, scannedDocuments]);

  const subjectSubtitle = selectedSubject?.professor || profile?.major || t('subjects.defaultSubtitle');
  const subjectScheduleLabel = subjectSchedules[0]
    ? `${subjectSchedules[0].start_time} - ${subjectSchedules[0].end_time}`
    : t('subjects.noSchedule');

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleDeleteSubject = () => {
    showAlert({
      title: t('subjects.deleteSubjectTitle'),
      message: t('subjects.deleteSubjectConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' as const },
        {
          text: t('common.delete') || 'Eliminar',
          style: 'destructive' as const,
          onPress: async () => {
            if (!subjectId) return;
            try {
              setIsLoading(true);
              await deleteSubject(subjectId);
              
              // Remove from global store so it disappears immediately
              await useDataStore.getState().refreshSubjects();
              
              router.back();
              // Evitar freeze de Modal de React Native usando un timeout para permitir 
              // que la animación de navegación y el dismiss del primer Modal terminen.
              setTimeout(() => {
                alertRef.show({ title: t('subjects.deleteSubjectTitle'), message: t('subjects.deleteSubjectSuccess'), type: 'info' });
              }, 400);
            } catch {
              setIsLoading(false);
              setTimeout(() => {
                alertRef.show({ title: t('subjects.error') || 'Error', message: t('subjects.deleteSubjectError'), type: 'error' });
              }, 400);
            }
          },
        },
      ],
    });
  };

  const handleDeleteVideo = (videoId: number | string) => {
    showAlert({
      title: t('subjects.deleteVideo'),
      message: t('subjects.deleteVideoConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('subjects.cancel'), style: 'cancel' as const },
        {
          text: t('subjects.delete'),
          style: 'destructive' as const,
          onPress: async () => {
            try {
              await deleteYouTubeVideo(String(videoId));
              setRecentVideos(prev => prev.filter(v => v.id !== videoId));
            } catch {
              showAlert({ title: t('subjects.error'), message: t('subjects.deleteVideoError'), type: 'error' });
            }
          },
        },
      ],
    });
  };

  const handleTakePhoto = () => setIsPhotoModalVisible(true);
  const handleOpenScanner = () => setIsScannerVisible(true);

  const handleScannerSave = useCallback(async (_uri: string, _id: string, base64?: string | null) => {
    if (!subjectId) return;
    const updatedPhotos = await getPhotosBySubject(subjectId);
    const updatedDocs = await getScannedDocumentsBySubject(subjectId);
    setPhotos(updatedPhotos || []);
    setScannedDocuments(updatedDocs || []);
    if (base64) {
      setFlashcardBase64(base64);
      setIsFlashcardModalVisible(true);
    }
  }, [subjectId]);

  const handlePhotoSave = useCallback(async () => {
    if (!subjectId) return;
    const updatedPhotos = await getPhotosBySubject(subjectId);
    const updatedDocs = await getScannedDocumentsBySubject(subjectId);
    setPhotos(updatedPhotos || []);
    setScannedDocuments(updatedDocs || []);
  }, [subjectId]);

  const handleViewerPhotoDeleted = useCallback((id: string) => {
    setPhotos(prev => prev.filter(p => String(p.id) !== id));
  }, []);

  const handleViewerOCRSaved = useCallback(async () => {
    if (!subjectId) return;
    const updatedPhotos = await getPhotosBySubject(subjectId);
    setPhotos(updatedPhotos || []);
  }, [subjectId]);

  const handleDocumentDeleted = useCallback((id: number | string) => {
    setScannedDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  const handlePDFImportSuccess = useCallback(async () => {
    if (!subjectId) return;
    const updatedDocs = await getScannedDocumentsBySubject(subjectId);
    setScannedDocuments(updatedDocs || []);
  }, [subjectId]);

  const handleGenerateFlashcardsFromDocs = useCallback(async (uris: string[]) => {
    if (uris.length === 0) return;
    try {
      const base64Data = await FileSystem.readAsStringAsync(uris[0], {
        encoding: FileSystem.EncodingType.Base64,
      });
      setFlashcardBase64(base64Data);
      setIsFlashcardModalVisible(true);
    } catch (e) {
      console.error('Error leyendo base64 para flashcards:', e);
    }
  }, []);

  const handleExportPdf = useCallback(async (uris: string[]) => {
    if (uris.length === 0) return;
    try {
      await generatePdfFromImages(uris);
    } catch (e: any) {
      console.error('[PDF] Error:', e?.message || e);
      const message = t('subjects.pdfGenerationError').replace('{{message}}', e?.message || 'desconocido');
      showAlert({ title: t('subjects.error'), message, type: 'error' });
    }
  }, [t, showAlert]);

  const handleFlashcardModalClose = useCallback(() => {
    setIsFlashcardModalVisible(false);
    setFlashcardContextText('');
    setFlashcardBase64('');
  }, []);

  const handleFlashcardSuccess = useCallback((deckId: string) => {
    setIsFlashcardModalVisible(false);
    setFlashcardContextText('');
    setFlashcardBase64('');
    if (deckId) {
      router.push(`/flashcards?deckId=${deckId}`);
    }
  }, [router]);

  const handleAIGenerateFlashcards = useCallback(async (contextText: string | null) => {
    if (contextText && subjectId && profile?.id) {
      setFlashcardContextText(contextText);
      setIsFlashcardModalVisible(true);
    } else {
      showAlert({
        title: t('subjects.noContextTitle'),
        message: t('subjects.noContextMessage'),
        type: 'warning',
      });
    }
  }, [subjectId, profile, t, showAlert]);

  const handleOpenCreateGrade = () => setIsCreateGradeVisible(true);

  const handleCloseCreateGrade = useCallback(() => {
    setIsCreateGradeVisible(false);
    refreshAssessments().catch(console.error);
  }, [refreshAssessments]);

  const handleDeleteAssessment = useCallback(() => {
    const { refreshSubjects } = useDataStore.getState();
    Promise.all([refreshSubjects(), refreshAssessments()]).catch(console.error);
  }, [refreshAssessments]);

  const handleAssessmentUpdated = useCallback(() => {
    const store = useDataStore.getState();
    Promise.all([store.refreshSubjects(), store.refreshAssessments()])
      .then(() => console.log('[SubjectDetailScreen] ✅ Global store refreshed'))
      .catch(err => console.error('[SubjectDetailScreen] ❌ Error refreshing store:', err));
  }, []);

  const handleOpenCategories = useCallback(() => {
    if (subjectId) {
      router.push(`/categories/${subjectId}?subjectName=${encodeURIComponent(selectedSubject?.name ?? '')}`);
    }
  }, [subjectId, selectedSubject, router]);

  return {
    subjectId,
    selectedSubject,
    profile,
    photos,
    scannedDocuments,
    studyNotes,
    isLoading,
    isReady,
    recentVideos,
    allSubjectVideos,
    imagePhotos,
    pdfDocuments,
    recentRecordings,
    allSubjectRecordings,
    subjectSubtitle,
    subjectScheduleLabel,
    storeSubjects,
    averageGrade,
    projectedGrade,
    delta,
    deliveredText,
    securedPercent,
    finalNeededText,
    recentAssessments,
    thresholdStatus,
    playingId,
    playSound,
    stopSound,
    deleteRecordingConfirmed,
    router,
    isScannerVisible,
    isPhotoModalVisible,
    isPDFImportVisible,
    isViewerVisible,
    isCreateGradeVisible,
    isFlashcardModalVisible,
    flashcardContextText,
    flashcardBase64,
    initialViewerIndex,
    overlayVisible,
    overlayText,
    setIsScannerVisible,
    setIsPhotoModalVisible,
    setIsViewerVisible,
    setIsPDFImportVisible,
    setInitialViewerIndex,
    setOverlayVisible,
    setOverlayText,
    setIsFlashcardModalVisible,
    setFlashcardBase64,
    handleDeleteSubject,
    handleDeleteVideo,
    handleTakePhoto,
    handleOpenScanner,
    handleScannerSave,
    handlePhotoSave,
    handleViewerPhotoDeleted,
    handleViewerOCRSaved,
    handleDocumentDeleted,
    handlePDFImportSuccess,
    handleGenerateFlashcardsFromDocs,
    handleExportPdf,
    handleFlashcardModalClose,
    handleFlashcardSuccess,
    handleAIGenerateFlashcards,
    handleOpenCreateGrade,
    handleCloseCreateGrade,
    handleDeleteAssessment,
    handleAssessmentUpdated,
    handleOpenCategories,
  };
}
