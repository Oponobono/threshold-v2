import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { subjectDetailStyles as styles } from '../../src/styles/SubjectDetail.styles';
import { SubjectHeroCard } from '../../src/components/subjects/SubjectHeroCard';
import { SubjectRecentRecordings } from '../../src/components/subjects/SubjectRecentRecordings';
import { DocumentScannerModal } from '../../src/components/modals/DocumentScannerModal';
import { PhotoCaptureModal } from '../../src/components/modals/PhotoCaptureModal';
import { ImageViewerModal } from '../../src/components/modals/ImageViewerModal';
import { SubjectGalleryGrid } from '../../src/components/subjects/SubjectGalleryGrid';
import { SubjectDocumentsList } from '../../src/components/subjects/SubjectDocumentsList';
import { FlashcardCreatorModal } from '../../src/components/flashcards/FlashcardCreatorModal';
import { SubjectStats } from '../../src/components/subjects/SubjectStats';
import { SubjectThreshold } from '../../src/components/subjects/SubjectThreshold';
import { SubjectInsights } from '../../src/components/subjects/SubjectInsights';
import { SubjectAIFab } from '../../src/components/subjects/SubjectAIFab';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';
import { CreateGradeModal } from '../../src/components/dashboard/CreateGradeModal';
import { AutoUploadIndicator } from '../../src/components/ui/AutoUploadIndicator';
import { SubjectYouTubeVideos } from '../../src/components/subjects/SubjectYouTubeVideos';
import { PDFImportModal } from '../../src/components/modals/PDFImportModal';
import { useSubjectDetail } from '../../src/hooks/useSubjectDetail';
import { SCALE_MAX } from '../../src/utils/grades';
import type { Subject } from '../../src/services/api';

export default function SubjectDetailScreen() {
  const { t } = useTranslation();
  const {
    selectedSubject,
    isLoading,
    isReady,
    imagePhotos,
    pdfDocuments,
    recentRecordings,
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
    subjectId,
    profile,
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
    subjectSubtitle,
    subjectScheduleLabel,
    recentVideos,
    allSubjectRecordings,
    allSubjectVideos,
    setIsScannerVisible,
    setIsPhotoModalVisible,
    setIsViewerVisible,
    setIsPDFImportVisible,
    setInitialViewerIndex,
    setOverlayVisible,
    setOverlayText,
    setFlashcardBase64,
    setIsFlashcardModalVisible,
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
  } = useSubjectDetail();

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
            avgScore={(selectedSubject?.avg_score ?? 0) > SCALE_MAX * 2 ? ((selectedSubject?.avg_score ?? 0) / 100) * SCALE_MAX : (selectedSubject?.avg_score ?? 0)}
            progress={securedPercent}
            displayLabel={selectedSubject?.display_label}
            displayColor={selectedSubject?.display_color}
            gpaEquivalent={selectedSubject?.gpa_equivalent}
            onDelete={handleDeleteSubject}
          />

          <SubjectStats
            averageGrade={averageGrade}
            projectedGrade={projectedGrade}
            delta={delta}
            deliveredText={deliveredText}
            onPressInfo={() => {
              setOverlayText('**Promedio Ponderado**\n\nEste número no es un promedio simple. Es el resultado exacto de calcular cada una de tus notas multiplicada por su peso o porcentaje real.\n\n**Nota Proyectada & Delta**\n\nUtiliza nuestro motor matemático (Media Móvil Exponencial) para predecir cuál será tu nota final al terminar el semestre si mantienes tu tendencia actual. El **Delta** (ej. +0.05 pts) indica si tu rendimiento está subiendo o bajando en comparación con tu promedio actual.\n\n**Tareas Completadas**\n\nMuestra el número de actividades y evaluaciones que ya has entregado frente al total planificado de esta materia en específico.');
              setOverlayVisible(true);
            }}
          />

          <SubjectThreshold
            securedPercent={securedPercent}
            finalNeededText={finalNeededText}
            subjectColor={selectedSubject?.color ?? undefined}
            status={thresholdStatus}
            objectiveGrade={selectedSubject?.target_grade}
            onPressInfo={() => {
              setOverlayText('**Threshold**\n\nEsta es la sección más importante de la aplicación. Aquí se muestra el porcentaje de tu materia que ya has "asegurado" con tus calificaciones actuales.\n\n**Tu Porcentaje Asegurado**\nEs el porcentaje de la nota final que ya está matemáticamente garantizado por las evaluaciones que has completado.\n\n**Tu Objetivo**\nMuestra exactamente qué nota necesitas en el porcentaje restante de la materia para alcanzar tu Threshold (nota objetivo). El cálculo considera todos tus pesos actuales y es 100% preciso.\n\n**Barra de Progreso**\nVisualiza visualmente cuánto falta para llegar al 100% y completar la materia.');
              setOverlayVisible(true);
            }}
          />

          <SubjectInsights
            recentAssessments={recentAssessments}
            onDeleteAssessment={handleDeleteAssessment}
            onAssessmentUpdated={handleAssessmentUpdated}
            onOpenCategories={handleOpenCategories}
            onAddAssessment={handleOpenCreateGrade}
            subjects={storeSubjects}
          />

          <SubjectDocumentsList
            documents={pdfDocuments}
            onDocumentDeleted={handleDocumentDeleted}
            onOpenImportPDF={() => setIsPDFImportVisible(true)}
            onGenerateFlashcards={handleGenerateFlashcardsFromDocs}
            onExportPdf={handleExportPdf}
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
        </ScrollView>
      </SafeAreaView>

      {isReady && (
      <>
      <DocumentScannerModal
        isVisible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        subjects={selectedSubject ? [selectedSubject as Subject] : []}
        onSave={handleScannerSave}
      />

      <PhotoCaptureModal
        isVisible={isPhotoModalVisible}
        onClose={() => setIsPhotoModalVisible(false)}
        subjects={selectedSubject ? [selectedSubject as Subject] : []}
        initialSubjectId={subjectId || undefined}
        onSave={handlePhotoSave}
      />

      <ImageViewerModal
        isVisible={isViewerVisible}
        photos={imagePhotos}
        initialIndex={initialViewerIndex}
        onClose={() => setIsViewerVisible(false)}
        onPhotoDeleted={handleViewerPhotoDeleted}
        onOCRSaved={handleViewerOCRSaved}
      />

      <PDFImportModal
        isVisible={isPDFImportVisible}
        onClose={() => setIsPDFImportVisible(false)}
        selectedSubjectId={subjectId || undefined}
        onImportSuccess={handlePDFImportSuccess}
      />

      {subjectId && profile?.id && (
        <FlashcardCreatorModal
          visible={isFlashcardModalVisible}
          onClose={handleFlashcardModalClose}
          onSuccess={handleFlashcardSuccess}
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
          onGenerateFlashcards={handleAIGenerateFlashcards}
        />
      )}

      {selectedSubject && (
        <CreateGradeModal
          visible={isCreateGradeVisible}
          onClose={handleCloseCreateGrade}
          subjects={[selectedSubject as any]}
          initialSubjectId={subjectId}
        />
      )}
      </>)}

      <ExplanationOverlay
        visible={overlayVisible}
        explanation={overlayText}
        onDismiss={() => setOverlayVisible(false)}
      />
    </>
  );
}
