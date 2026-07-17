import React from 'react';
import { View, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../src/styles/theme';
import { documentsStyles as styles } from '../src/styles/DocumentsScreen.styles';

import { PremiumLoading } from '../src/components/ui/PremiumLoading';
import { DocumentsHeader } from '../src/components/documents/DocumentsHeader';
import { DocumentsSearchBar } from '../src/components/documents/DocumentsSearchBar';
import { DocumentsFilterPills } from '../src/components/documents/DocumentsFilterPills';
import { DocumentsGrid } from '../src/components/documents/DocumentsGrid';
import { EmptyDocuments } from '../src/components/documents/EmptyDocuments';
import { useDocuments } from '../src/hooks/useDocuments';

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const {
    isLoading, showSearch, searchAnim, searchInputRef,
    searchQuery, setSearchQuery,
    activeCourseFilter, setActiveCourseFilter,
    activeSubjectFilter, setActiveSubjectFilter,
    activeFormatFilter, setActiveFormatFilter,
    courses, subjects, availableFormats,
    sections, handlePressDocument, handleDeleteDocument,
    toggleSearch,
  } = useDocuments();

  if (isLoading && sections.length === 0) {
    return <PremiumLoading text={t('documents.screenTitle') || 'CARGANDO'} />;
  }

  const isEmpty = sections.length === 0;

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} translucent={false} />

      <View style={{ height: insets.top, backgroundColor: theme.colors.card }} />

      <DocumentsHeader
        showSearch={showSearch}
        onToggleSearch={toggleSearch}
      />

      <DocumentsSearchBar
        searchAnim={searchAnim}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        inputRef={searchInputRef}
      />

      <DocumentsFilterPills
        courses={courses}
        subjects={subjects}
        availableFormats={availableFormats}
        activeCourseFilter={activeCourseFilter}
        activeSubjectFilter={activeSubjectFilter}
        activeFormatFilter={activeFormatFilter}
        onCourseFilterChange={setActiveCourseFilter}
        onSubjectFilterChange={setActiveSubjectFilter}
        onFormatFilterChange={setActiveFormatFilter}
      />

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <EmptyDocuments />
        ) : (
          <DocumentsGrid
            sections={sections}
            onPressDocument={handlePressDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        )}
      </ScrollView>
    </View>
  );
}
