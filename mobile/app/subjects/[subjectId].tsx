import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
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
  type Assessment,
  type Subject,
  type UserProfile,
  type YouTubeVideo,
  type ScannedDocument,
} from '../../src/services/api';

import { SubjectHeroCard } from '../../src/components/SubjectHeroCard';
import { SubjectRecentRecordings } from '../../src/components/SubjectRecentRecordings';
import { DocumentScannerModal } from '../../src/components/DocumentScannerModal';
import { PhotoCaptureModal } from '../../src/components/PhotoCaptureModal';
import { ImageViewerModal } from '../../src/components/ImageViewerModal';
import { SubjectGalleryGrid } from '../../src/components/SubjectGalleryGrid';
import { SubjectDocumentsList } from '../../src/components/SubjectDocumentsList';
import { FlashcardCreatorModal } from '../../src/components/FlashcardCreatorModal';
import { SubjectStats } from '../../src/components/SubjectStats';
import { SubjectThreshold } from '../../src/components/SubjectThreshold';
import { SubjectInsights } from '../../src/components/SubjectInsights';
import { SubjectAIFab } from '../../src/components/SubjectAIFab';
import { CreateGradeModal } from '../../src/components/dashboard/CreateGradeModal';
import { useSubjectGrades } from '../../src/hooks/useSubjectGrades';
import { useAudioRecorder } from '../../src/hooks/useAudioRecorder';
import { AutoUploadIndicator } from '../../src/components/AutoUploadIndicator';
import { useDataStore } from '../../src/store/useDataStore';
import * as FileSystem from 'expo-file-system/legacy';
import { subjectDetailStyles as styles } from '../../src/styles/SubjectDetail.styles';
import { useCustomAlert } from '../../src/components/CustomAlert';
import { SubjectYouTubeVideos } from '../../src/components/SubjectYouTubeVideos';
import { PDFImportModal } from '../../src/components/PDFImportModal';
import { generatePdfFromImages } from '../../src/utils/pdfGenerator';

// Helper removed

type DetailSubject = Subject & {
  avg_score?: number | null;
  completion_percent?: number | null;
};

/**
 * SubjectDetailScreen
 *
 * Pantalla principal de detalle de una materia. Actúa como el orquestador o contenedor (Smart Component)
 * que reúne y distribuye todos los datos académicos (grabaciones, documentos, fotos, flashcards y estadísticas).
 * Provee callbacks para el manejo de estado y persistencia hacia los componentes hijos (Dumb Components).
 */
export default function SubjectDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string }>();
  const { subjects: storeSubjects } = useDataStore();

  const subjectId = useMemo(() => {
    const raw = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params.subjectId]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<DetailSubject | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subjectSchedules, setSubjectSchedules] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocument[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  const [isPDFImportVisible, setIsPDFImportVisible] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [isCreateGradeVisible, setIsCreateGradeVisible] = useState(false);
  const [initialViewerIndex, setInitialViewerIndex] = useState(0);

  const [recentVideos, setRecentVideos] = useState<YouTubeVideo[]>([]);
  const [allSubjectVideos, setAllSubjectVideos] = useState<YouTubeVideo[]>([]);

  const { playSound, stopSound, playingId, deleteRecordingConfirmed, recordings, cleanupAudio } = useAudioRecorder();

  // Stop audio when leaving the subject screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        cleanupAudio();
      };
    }, [cleanupAudio])
  );

  // All recordings for this subject (used by the AI context modal — not sliced)
  const allSubjectRecordings = useMemo(() => {
    if (!subjectId || !recordings) return [];
    // eslint-disable-next-line eqeqeq
    return recordings.filter(r => r.subject_id == subjectId);
  }, [recordings, subjectId]);

  const recentRecordings = useMemo(() => allSubjectRecordings.slice(0, 3), [allSubjectRecordings]);
  
  const [isFlashcardModalVisible, setIsFlashcardModalVisible] = useState(false);
  /** contextText construido por el backend — se pasa directamente al FlashcardCreatorModal como `content` */
  const [flashcardContextText, setFlashcardContextText] = useState<string>('');
  const [flashcardBase64, setFlashcardBase64] = useState<string>('');
  const { showAlert } = useCustomAlert();

  /** Muestra la alerta de confirmación y elimina la materia completa (en cascada) */
  const handleDeleteSubject = () => {
    showAlert({
      title: t('subjects.deleteSubjectTitle'),
      message: t('subjects.deleteSubjectConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('common.delete') || 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!subjectId) return;
            try {
              setIsLoading(true);
              await deleteSubject(subjectId);
              router.back();
              showAlert({ title: t('subjects.deleteSubjectTitle'), message: t('subjects.deleteSubjectSuccess'), type: 'info' });
            } catch {
              setIsLoading(false);
              showAlert({ title: t('subjects.error') || 'Error', message: t('subjects.deleteSubjectError'), type: 'error' });
            }
          }
        }
      ]
    });
  };

  /** Muestra la alerta de confirmación y elimina el enlace de un video de YouTube */
  const handleDeleteVideo = (videoId: number | string) => {
    showAlert({
      title: t('subjects.deleteVideo'),
      message: t('subjects.deleteVideoConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('subjects.cancel'), style: 'cancel' },
        {
          text: t('subjects.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteYouTubeVideo(Number(videoId));
              setRecentVideos(prev => prev.filter(v => v.id !== videoId));
            } catch {
              showAlert({ title: t('subjects.error'), message: t('subjects.deleteVideoError'), type: 'error' });
            }
          }
        }
      ]
    });
  };

  useEffect(() => {
    let mounted = true;

    const loadAllData = async () => {
      if (!subjectId) return;

      setIsLoading(true);
      try {
        const [profileRes, subjectRes, photosRes, docsRes, assessmentsRes, schedulesRes, , videosRes] =
          await Promise.allSettled([
            getCurrentUserProfile(),
            getSubjectById(subjectId),
            getPhotosBySubject(subjectId),
            getScannedDocumentsBySubject(subjectId),
            getAssessments(subjectId),
            getSchedulesBySubject(subjectId),
            getAudioRecordings(),
            getYouTubeVideos(),
          ]);

        if (!mounted) return;

        if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
        if (subjectRes.status === 'fulfilled') setSelectedSubject(subjectRes.value as DetailSubject);
        if (photosRes.status === 'fulfilled') setPhotos(photosRes.value || []);
        if (docsRes.status === 'fulfilled') setScannedDocuments(docsRes.value || []);
        if (assessmentsRes.status === 'fulfilled') setAssessments((assessmentsRes.value || []) as Assessment[]);
        if (schedulesRes.status === 'fulfilled') setSubjectSchedules(schedulesRes.value || []);
        // Grabaciones gestionadas por useAudioRecorder hook
        if (videosRes.status === 'fulfilled') {
          const videoList = Array.isArray(videosRes.value) ? videosRes.value : [];
          // eslint-disable-next-line eqeqeq
          const filtered = videoList.filter(v => v.subject_id == subjectId);
          setAllSubjectVideos(filtered);
          setRecentVideos(filtered.slice(0, 3));
        }
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

  // Cleanup: detener la reproducción de audio cuando se desmonta el componente o se sale de la pantalla
  useEffect(() => {
    return () => {
      stopSound();
    };
  }, [stopSound]);

  const {
    averageGrade,
    projectedGrade,
    deliveredText,
    securedPercent,
    finalNeededText,
    recentAssessments,
    thresholdStatus,
  } = useSubjectGrades(assessments, selectedSubject, profile);

  const imagePhotos = useMemo(() => photos.filter(p => !p.local_uri?.endsWith('.pdf')), [photos]);
  // Combine old pdfs saved as photos + new scanned_documents
  const pdfDocuments = useMemo(() => {
    const oldPdfs = photos.filter(p => p.local_uri?.endsWith('.pdf')).map(p => ({ ...p, is_legacy_photo: true }));
    return [...scannedDocuments, ...oldPdfs];
  }, [photos, scannedDocuments]);

  const subjectSubtitle = selectedSubject?.professor || profile?.major || t('subjects.defaultSubtitle');
  const subjectScheduleLabel = subjectSchedules[0]
    ? `${subjectSchedules[0].start_time} - ${subjectSchedules[0].end_time}`
    : t('subjects.noSchedule');

  const handleTakePhoto = () => setIsPhotoModalVisible(true);
  const handleOpenScanner = () => setIsScannerVisible(true);

  if (isLoading) {
    return (
      <SafeAreaView style={[globalStyles.safeArea, { backgroundColor: '#fff' }]}>
        <View style={styles.premiumLoadingContainer}>
          <View style={styles.loadingLogoContainer}>
            <View style={styles.loadingLogoCircle}>
              <Ionicons name="leaf-outline" size={32} color={theme.colors.primary} />
            </View>
            <View style={styles.loadingPulse} />
          </View>
          <Text style={styles.premiumLoadingText}>{t('subjects.loading').toUpperCase()}</Text>
          <View style={styles.loadingBarTrack}>
            <View style={styles.loadingBarFill} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={globalStyles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerAction} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={18} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <AutoUploadIndicator size={16} />
              <View style={styles.headerBadge}>
                <Ionicons name="book-outline" size={18} color={theme.colors.primary} />
              </View>
              <TouchableOpacity style={styles.headerAction} onPress={() => router.push('/gallery')}>
                <Ionicons name="images-outline" size={16} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <SubjectHeroCard
            color={selectedSubject?.color}
            iconName={selectedSubject?.icon}
            title={selectedSubject?.name || t('subjects.noSubjectSelected')}
            subtitle={subjectSubtitle}
            meta={subjectScheduleLabel}
            avgScore={selectedSubject?.avg_score || 0}
            displayLabel={selectedSubject?.display_label}
            displayColor={selectedSubject?.display_color}
            gpaEquivalent={selectedSubject?.gpa_equivalent}
            onDelete={handleDeleteSubject}
          />

          <SubjectStats
            averageGrade={averageGrade}
            projectedGrade={projectedGrade}
            deliveredText={deliveredText}
          />

          <SubjectThreshold
            securedPercent={securedPercent}
            finalNeededText={finalNeededText}
            subjectColor={selectedSubject?.color ?? undefined}
            status={thresholdStatus}
          />

          <SubjectInsights 
            recentAssessments={recentAssessments} 
            onDeleteAssessment={(id) => {
              setAssessments(prev => prev.filter(a => a.id !== id));
              const { refreshSubjects, refreshAssessments } = useDataStore.getState();
              Promise.all([refreshSubjects(), refreshAssessments()]).catch(console.error);
            }}
            onAssessmentUpdated={(updatedAssessment) => {
              console.log('[SubjectDetailScreen] 📥 onAssessmentUpdated callback recibido:', {
                updated: updatedAssessment ? true : false,
                assessmentId: updatedAssessment?.id,
                grade_value: updatedAssessment?.grade_value,
                normalized_value: updatedAssessment?.normalized_value,
                is_completed: updatedAssessment?.is_completed,
              });

              // If we have an updated assessment, merge it into local state immediately
              if (updatedAssessment && updatedAssessment.id) {
                console.log('[SubjectDetailScreen] 🔄 Merging assessment into local state immediately:', {
                  assessmentId: updatedAssessment.id,
                  gradeValue: updatedAssessment.grade_value,
                });
                setAssessments(prev => {
                  const updated = prev.map(a => a.id === updatedAssessment.id ? updatedAssessment : a);
                  console.log('[SubjectDetailScreen] ✅ Local state merged. New assessments count:', updated.length);
                  return updated;
                });
              }
              
              // Also refetch to ensure consistency
              if (subjectId) {
                console.log('[SubjectDetailScreen] 🔄 Refetching assessments from API...');
                getAssessments(subjectId)
                  .then(res => {
                    console.log('[SubjectDetailScreen] ✅ API refetch completed, new count:', res?.length || 0);
                    setAssessments((res || []) as Assessment[]);
                  })
                  .catch((err) => {
                    console.error('[SubjectDetailScreen] ❌ Error refetching assessments:', err);
                  });
              }
              
              console.log('[SubjectDetailScreen] 🔄 Refreshing global store...');
              const { refreshSubjects, refreshAssessments } = useDataStore.getState();
              Promise.all([refreshSubjects(), refreshAssessments()])
                .then(() => console.log('[SubjectDetailScreen] ✅ Global store refreshed'))
                .catch(err => console.error('[SubjectDetailScreen] ❌ Error refreshing store:', err));
            }}
            onOpenCategories={() => {
              if (subjectId) {
                router.push(`/categories/${subjectId}?subjectName=${encodeURIComponent(selectedSubject?.name ?? '')}`);
              }
            }}
            onAddAssessment={() => setIsCreateGradeVisible(true)}
            subjects={storeSubjects}
          />

          <SubjectDocumentsList 
            documents={pdfDocuments}
            onDocumentDeleted={(id) => {
              setScannedDocuments(prev => prev.filter(d => d.id !== id));
            }}
            onOpenImportPDF={() => setIsPDFImportVisible(true)}
            onGenerateFlashcards={async (uris) => {
              if (uris.length === 0) return;
              // Leemos la primera imagen para las flashcards (como MVP)
              // Idealmente las combinariamos o enviariamos todas, pero por ahora tomaremos la primera para este prototipo.
              try {
                const base64Data = await FileSystem.readAsStringAsync(uris[0], {
                  encoding: FileSystem.EncodingType.Base64,
                });
                setFlashcardBase64(base64Data);
                setIsFlashcardModalVisible(true);
              } catch (e) {
                console.error('Error leyendo base64 para flashcards:', e);
              }
            }}
            onExportPdf={async (uris) => {
              if (uris.length === 0) return;
              try {
                await generatePdfFromImages(uris);
              } catch (e: any) {
                console.error('[PDF] Error:', e?.message || e);
                const message = t('subjects.pdfGenerationError').replace('{{message}}', e?.message || 'desconocido');
                showAlert({ title: t('subjects.error'), message, type: 'error' });
              }
            }}
          />

          <SubjectGalleryGrid
            photos={imagePhotos}
            subjectName={selectedSubject?.name ? selectedSubject.name : undefined}
            onOpenScanner={handleOpenScanner}
            onTakePhoto={handleTakePhoto}
            onOpenViewer={(index) => {
              setInitialViewerIndex(index);
              setIsViewerVisible(true);
            }}
          />

          <SubjectRecentRecordings
            recentRecordings={recentRecordings}
            playingId={playingId}
            playSound={playSound}
            stopSound={stopSound}
            deleteRecording={deleteRecordingConfirmed}
          />

          <SubjectYouTubeVideos
            videos={recentVideos}
            onDeleteVideo={handleDeleteVideo}
          />

          {isDetailLoading && (
            <View style={styles.detailLoadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.detailLoadingText}>{t('subjects.refreshing')}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {isReady && (
      <>
      <DocumentScannerModal
        isVisible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        subjects={selectedSubject ? [selectedSubject as Subject] : []}
        onSave={async (uri, id, base64) => {
          if (subjectId) {
            const updatedPhotos = await getPhotosBySubject(subjectId);
            const updatedDocs = await getScannedDocumentsBySubject(subjectId);
            setPhotos(updatedPhotos || []);
            setScannedDocuments(updatedDocs || []);
            
            if (base64) {
              setFlashcardBase64(base64);
              setIsFlashcardModalVisible(true);
            }
          }
        }}
      />

      <PhotoCaptureModal
        isVisible={isPhotoModalVisible}
        onClose={() => setIsPhotoModalVisible(false)}
        subjects={selectedSubject ? [selectedSubject as Subject] : []}
        initialSubjectId={subjectId || undefined}
        onSave={async () => {
          if (subjectId) {
            const updatedPhotos = await getPhotosBySubject(subjectId);
            const updatedDocs = await getScannedDocumentsBySubject(subjectId);
            setPhotos(updatedPhotos || []);
            setScannedDocuments(updatedDocs || []);
          }
        }}
      />

      <ImageViewerModal
        isVisible={isViewerVisible}
        photos={imagePhotos}
        initialIndex={initialViewerIndex}
        onClose={() => setIsViewerVisible(false)}
        onPhotoDeleted={(id) => {
          setPhotos(prev => prev.filter(p => p.id !== id));
        }}
        onOCRSaved={async () => {
          if (subjectId) {
            const updatedPhotos = await getPhotosBySubject(subjectId);
            setPhotos(updatedPhotos || []);
          }
        }}
      />

      <PDFImportModal
        isVisible={isPDFImportVisible}
        onClose={() => setIsPDFImportVisible(false)}
        selectedSubjectId={subjectId || undefined}
        onImportSuccess={async () => {
          if (subjectId) {
            const updatedDocs = await getScannedDocumentsBySubject(subjectId);
            setScannedDocuments(updatedDocs || []);
          }
        }}
      />

      {subjectId && profile?.id && (
        <FlashcardCreatorModal
          visible={isFlashcardModalVisible}
          onClose={() => {
            setIsFlashcardModalVisible(false);
            setFlashcardContextText('');
            setFlashcardBase64('');
          }}
          onSuccess={(deckId: number) => {
            setIsFlashcardModalVisible(false);
            setFlashcardContextText('');
            setFlashcardBase64('');
            // Navegar al módulo de flashcards para que vea el mazo creado
            if (deckId) {
              router.push(`/flashcards?deckId=${deckId}`);
            }
          }}
          // Pasar el texto construido por el backend o la imagen base64
          content={flashcardContextText}
          imageBase64={flashcardBase64}
          contentType="document"
          title={selectedSubject?.name || 'Documento'}
          subjectId={subjectId}
          userId={profile.id}
        />
      )}

      {selectedSubject && (
        <SubjectAIFab
          subjectId={subjectId || undefined}
          userId={profile?.id || undefined}
          subjectName={selectedSubject.name}
          recordings={allSubjectRecordings}
          photos={imagePhotos}
          documents={pdfDocuments as any}
          videos={allSubjectVideos}
          onGenerateFlashcards={async (contextText, selectedItems) => {
            // El contextText ya fue construido por el backend (texto de transcripciones,
            // OCR de docs, captions de videos). Se pasa directamente como `content`
            // al FlashcardCreatorModal sin necesidad de leer archivos del dispositivo.
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
          }}
        />
      )}
      {selectedSubject && (
        <CreateGradeModal
          visible={isCreateGradeVisible}
          onClose={() => {
            setIsCreateGradeVisible(false);
            // Refresh assessments
            getAssessments(subjectId!).then(setAssessments).catch(console.error);
          }}
          subjects={[selectedSubject as any]}
          initialSubjectId={subjectId}
        />
      )}
      </>)}
    </>
  );
}
