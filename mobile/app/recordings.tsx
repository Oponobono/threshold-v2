import React, { useState, useMemo } from 'react';
import { View, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../src/styles/theme';
import { recordingsStyles as styles } from '../src/styles/RecordingsScreen.styles';

import { PremiumLoading } from '../src/components/ui/PremiumLoading';
import { RecordingsGrid } from '../src/components/recordings/RecordingsGrid';
import { YouTubeAddModal } from '../src/components/modals/YouTubeAddModal';
import { FilterSortModal } from '../src/components/modals/FilterSortModal';
import { AudioRecorderBottomBar } from '../src/components/audio/AudioRecorderBottomBar';
import { RecordingsHeader } from '../src/components/recordings/RecordingsHeader';
import { RecordingsSearchBar } from '../src/components/recordings/RecordingsSearchBar';
import { RecordingsFilterPills } from '../src/components/recordings/RecordingsFilterPills';
import { EmptyRecordings } from '../src/components/recordings/EmptyRecordings';
import { useRecordings } from '../src/hooks/useRecordings';
import { FilterDropdown } from '../src/components/ui/FilterDropdown';
import { OptionSelectorModal, SelectorOption } from '../src/components/ui/OptionSelectorModal';

export default function RecordingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const {
    showYoutubeModal, youtubeUrl, showSearch, showFilterModal,
    searchAnim, searchInputRef, pulseAnim, meterAnim,
    isLoadingVideos, isAddingYouTubeVideo, youTubeVideos, recordings,
    isReady,
    searchQuery, setSearchQuery, activeFilter, setActiveFilter,
    sortOrder, setSortOrder, dateFilter, setDateFilter,
    sections, playingId, playSound, stopSound,
    isRecording, isPaused, recordingDuration,
    startRecording, pauseRecording, resumeRecording, stopRecording,
    formatDuration,
    setShowYoutubeModal, setYoutubeUrl, setShowFilterModal,
    onAddYouTubeVideo, toggleSearch, handlePressItem, handleDeleteItem,
    selectedSubjectId, setSelectedSubjectId,
    selectedCourseId, setSelectedCourseId,
    subjects, courses,
    availableCourseIds, availableSubjectIds,
  } = useRecordings();

  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);

  const courseOptions: SelectorOption[] = useMemo(() => {
    return (courses as any[])
      .filter((c: any) => availableCourseIds.has(c.id))
      .map(c => ({ id: c.id, name: c.name }));
  }, [courses, availableCourseIds]);

  const subjectsForCourse = useMemo(() =>
    selectedCourseId ? subjects.filter((s: any) => s.course_id === selectedCourseId) : subjects
  , [subjects, selectedCourseId]);

  const subjectOptions: SelectorOption[] = useMemo(() => {
    return subjectsForCourse
      .filter((s: any) => availableSubjectIds.has(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon || 'book-outline',
        color: s.color,
        subtitle: s.professor
      }));
  }, [subjectsForCourse, availableSubjectIds]);

  const selectedCourseName = (courses as any[]).find(c => c.id === selectedCourseId)?.name || null;
  const selectedSubjectName = subjects.find(s => s.id === selectedSubjectId)?.name || null;

  const showFilters = courseOptions.length > 0;
  const showSubjectFilter = subjectOptions.length > 0;

  if (isLoadingVideos && youTubeVideos.length === 0 && recordings.length === 0) {
    return <PremiumLoading text={t('recordings.loadingList') || 'CARGANDO'} />;
  }

  const isEmpty = sections.length === 0;

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} translucent={false} />

      <View style={{ height: insets.top, backgroundColor: theme.colors.card }} />

      <RecordingsHeader
        showSearch={showSearch}
        dateFilter={dateFilter}
        sortOrder={sortOrder}
        onToggleSearch={toggleSearch}
        onOpenYoutube={() => setShowYoutubeModal(true)}
        onOpenFilter={() => setShowFilterModal(true)}
      />

      <RecordingsSearchBar
        searchAnim={searchAnim}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        inputRef={searchInputRef}
      />

      {showFilters && (
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: theme.spacing.lg, marginBottom: 4 }}>
          <FilterDropdown
            label={t('dashboard.course', { defaultValue: 'Curso' })}
            value={selectedCourseName}
            iconName="folder"
            onPress={() => setCourseModalVisible(true)}
            isActive={!!selectedCourseId}
          />
          {showSubjectFilter && (
            <FilterDropdown
              label={t('dashboard.newSubject.subjectPlaceholder', { defaultValue: 'Materia' })}
              value={selectedSubjectName}
              iconName="book"
              onPress={() => setSubjectModalVisible(true)}
              isActive={!!selectedSubjectId}
            />
          )}
        </View>
      )}

      <RecordingsFilterPills
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <EmptyRecordings />
        ) : (
          <RecordingsGrid
            sections={sections}
            playingId={playingId}
            onPlay={playSound}
            onStop={stopSound}
            onDelete={handleDeleteItem}
            onPress={handlePressItem}
          />
        )}
      </ScrollView>

      {isReady && (
        <>
          <FilterSortModal
            visible={showFilterModal}
            sortOrder={sortOrder}
            dateFilter={dateFilter}
            onSortChange={setSortOrder}
            onFilterChange={setDateFilter}
            onClose={() => setShowFilterModal(false)}
          />

          <YouTubeAddModal
            visible={showYoutubeModal}
            youtubeUrl={youtubeUrl}
            isAdding={isAddingYouTubeVideo}
            onUrlChange={setYoutubeUrl}
            onCancel={() => { setShowYoutubeModal(false); setYoutubeUrl(''); }}
            onAdd={onAddYouTubeVideo}
          />

          <OptionSelectorModal
            visible={courseModalVisible}
            title={t('dashboard.selectCourse', { defaultValue: 'Seleccionar curso' })}
            options={courseOptions}
            selectedId={selectedCourseId}
            onSelect={(val) => {
              setSelectedCourseId(val);
              setSelectedSubjectId(null);
              setCourseModalVisible(false);
            }}
            onClose={() => setCourseModalVisible(false)}
            allowClear
          />

          <OptionSelectorModal
            visible={subjectModalVisible}
            title={t('dashboard.selectSubject', { defaultValue: 'Seleccionar materia' })}
            options={subjectOptions}
            selectedId={selectedSubjectId}
            onSelect={(val) => {
              setSelectedSubjectId(val);
              if (val) {
                const subj = subjects.find((s: any) => s.id === val);
                if (subj && (subj as any).course_id) {
                  setSelectedCourseId((subj as any).course_id);
                }
              }
              setSubjectModalVisible(false);
            }}
            onClose={() => setSubjectModalVisible(false)}
            allowClear
          />
        </>
      )}

      <AudioRecorderBottomBar
        isRecording={isRecording}
        isPaused={isPaused}
        recordingDuration={recordingDuration}
        formatDuration={formatDuration}
        pulseAnim={pulseAnim}
        meterAnim={meterAnim}
        insetsBottom={insets.bottom}
        onStart={startRecording}
        onPause={pauseRecording}
        onResume={resumeRecording}
        onStop={stopRecording}
      />
    </View>
  );
}
