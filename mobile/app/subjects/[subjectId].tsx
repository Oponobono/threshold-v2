import React, { useState, useEffect } from 'react';
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
import { GradeCalculator } from '../../src/components/subjects/GradeCalculator';
import { useSubjectDetail } from '../../src/hooks/useSubjectDetail';
import { updateSubject } from '../../src/services/api';
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

  // ── Grade Calculator State ──
  const [calcCurrentGrade, setCalcCurrentGrade] = useState('');
  const [calcRequiredPass, setCalcRequiredPass] = useState('60');
  const [calcRemainingWeight, setCalcRemainingWeight] = useState('');
  const [calcMinNeeded, setCalcMinNeeded] = useState<number | null>(null);
  const [calcMaxAchievable, setCalcMaxAchievable] = useState<number | null>(null);

  useEffect(() => {
    if (selectedSubject) {
      const raw = selectedSubject.avg_score || 0;
      const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
      setCalcCurrentGrade(avg ? String(Math.round(avg)) : '');
      setCalcRequiredPass(selectedSubject.target_grade ? String(selectedSubject.target_grade) : '60');
      setCalcRemainingWeight('');
      setCalcMinNeeded(null);
      setCalcMaxAchievable(null);
    }
  }, [selectedSubject]);

  const handleSimulate = () => {
    const cg = parseFloat(calcCurrentGrade || (selectedSubject?.avg_score?.toString() || '0'));
    const rp = parseFloat(calcRequiredPass || (selectedSubject?.target_grade?.toString() || '60'));
    const rw = parseFloat(calcRemainingWeight);

    if (isNaN(cg) || isNaN(rp) || isNaN(rw) || rw <= 0) {
      return;
    }

    const doneWeight = 100 - rw;
    const result = (rp - (cg * doneWeight) / 100) / (rw / 100);
    const maxScale = rp <= 5 ? 5 : rp <= 10 ? 10 : 100;
    const max = (cg * doneWeight / 100) + (maxScale * rw / 100);

    setCalcMinNeeded(Number(result.toFixed(2)));
    setCalcMaxAchievable(Number(max.toFixed(2)));
  };

  const handleReset = () => {
    if (selectedSubject) {
      const raw = selectedSubject.avg_score || 0;
      const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
      setCalcCurrentGrade(avg ? avg.toFixed(1) : '');
      setCalcRequiredPass(selectedSubject.target_grade ? String(selectedSubject.target_grade) : '60');
    }
    setCalcRemainingWeight('');
    setCalcMinNeeded(null);
    setCalcMaxAchievable(null);
  };

  const handleSaveTarget = async () => {
    if (!selectedSubject) return;
    const rp = calcRequiredPass ? parseFloat(calcRequiredPass) : null;
    if (rp === null || isNaN(rp)) return;

    try {
      await updateSubject(selectedSubject.id, { target_grade: rp });
    } catch (error: any) {
      console.error('Error saving target grade:', error.message);
    }
  };

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
            avgScore={averageGrade > 0 ? averageGrade : ((selectedSubject?.avg_score ?? 0) > SCALE_MAX * 2 ? ((selectedSubject?.avg_score ?? 0) / 100) * SCALE_MAX : (selectedSubject?.avg_score ?? 0))}
            progress={securedPercent}
            displayLabel={averageGrade > 0 ? undefined : selectedSubject?.display_label}
            displayColor={averageGrade > 0 ? undefined : selectedSubject?.display_color}
            gpaEquivalent={selectedSubject?.gpa_equivalent}
          />

          <SubjectThreshold
            securedPercent={securedPercent}
            finalNeededText={finalNeededText}
            subjectColor={selectedSubject?.color ?? undefined}
            status={thresholdStatus}
            objectiveGrade={selectedSubject?.target_grade}
            onPressInfo={() => {
              setOverlayText(t('subjects.thresholdOverlay'));
              setOverlayVisible(true);
            }}
          />

          <SubjectStats
            averageGrade={averageGrade}
            projectedGrade={projectedGrade}
            delta={delta}
            deliveredText={deliveredText}
            onPressInfo={() => {
              setOverlayText(t('subjects.subjectStatsOverlay'));
              setOverlayVisible(true);
            }}
          />

          <GradeCalculator
            selectedSubject={selectedSubject}
            currentGrade={calcCurrentGrade}
            requiredPass={calcRequiredPass}
            remainingWeight={calcRemainingWeight}
            minNeeded={calcMinNeeded}
            maxAchievable={calcMaxAchievable}
            onCurrentGradeChange={setCalcCurrentGrade}
            onRequiredPassChange={setCalcRequiredPass}
            onRemainingWeightChange={setCalcRemainingWeight}
            onSimulate={handleSimulate}
            onReset={handleReset}
            onSaveTarget={handleSaveTarget}
            onInfoPress={() => {
              setOverlayText(t('subjects.calculatorOverlay'));
              setOverlayVisible(true);
            }}
            t={t}
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

      {isReady && isScannerVisible && (
        <DocumentScannerModal
          isVisible={isScannerVisible}
          onClose={() => setIsScannerVisible(false)}
          subjects={selectedSubject ? [selectedSubject as unknown as Subject] : [] as Subject[]}
          onSave={handleScannerSave}
        />
      )}

      {isReady && isPhotoModalVisible && (
        <PhotoCaptureModal
          isVisible={isPhotoModalVisible}
          onClose={() => setIsPhotoModalVisible(false)}
          subjects={selectedSubject ? [selectedSubject as Subject] : []}
          initialSubjectId={subjectId || undefined}
          onSave={handlePhotoSave}
        />
      )}

      {isReady && isViewerVisible && (
        <ImageViewerModal
          isVisible={isViewerVisible}
          photos={imagePhotos}
          initialIndex={initialViewerIndex}
          onClose={() => setIsViewerVisible(false)}
          onPhotoDeleted={handleViewerPhotoDeleted}
          onOCRSaved={handleViewerOCRSaved}
        />
      )}

      {isReady && isPDFImportVisible && (
        <PDFImportModal
          isVisible={isPDFImportVisible}
          onClose={() => setIsPDFImportVisible(false)}
          selectedSubjectId={subjectId || undefined}
          onImportSuccess={handlePDFImportSuccess}
        />
      )}

      {isReady && subjectId && profile?.id && (
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

      {/* FAB de Zyren: aparece en cuanto la materia está disponible (caché MMKV instantáneo) */}
      {!!selectedSubject && (
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

      {isReady && selectedSubject && (
        <CreateGradeModal
          visible={isCreateGradeVisible}
          onClose={handleCloseCreateGrade}
          subjects={[selectedSubject as any]}
          initialSubjectId={subjectId}
        />
      )}

      <ExplanationOverlay
        visible={overlayVisible}
        explanation={overlayText}
        onDismiss={() => setOverlayVisible(false)}
      />
    </>
  );
}
