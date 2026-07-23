import React, { Suspense, lazy } from 'react';
import { FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { useGallery } from '../../src/hooks/useGallery';
import { GRID_COL_W, galleryStyles } from '../../src/styles/Gallery.styles';
import { GalleryPhoto } from '../../src/types/gallery';
import { deletePhoto } from '../../src/services/api';
import { alertRef } from '../../src/components/ui/CustomAlert';

import { GalleryHeader } from '../../src/components/gallery/GalleryHeader';
import { SearchBar } from '../../src/components/gallery/SearchBar';
import { FilterTabs } from '../../src/components/gallery/FilterTabs';
import { SubjectChips } from '../../src/components/gallery/SubjectChips';
import { StarredRow } from '../../src/components/gallery/StarredRow';
import { GridItem } from '../../src/components/gallery/GridItem';
import { EmptyState } from '../../src/components/gallery/EmptyState';
import { OcrModal } from '../../src/components/gallery/OcrModal';
import { CoursePills } from '../../src/components/ui/CoursePills';

const ImageViewerModal = lazy(() =>
  import('../../src/components/modals/ImageViewerModal').then(m => ({ default: m.ImageViewerModal }))
);
const PhotoCaptureModal = lazy(() =>
  import('../../src/components/modals/PhotoCaptureModal').then(m => ({ default: m.PhotoCaptureModal }))
);
const DocumentScannerModal = lazy(() =>
  import('../../src/components/modals/DocumentScannerModal').then(m => ({ default: m.DocumentScannerModal }))
);

export default function GalleryScreen() {
  const { t } = useTranslation();
  const g = useGallery(t);

  const handleStarredPress = (photos: GalleryPhoto[], index: number) => {
    g.setViewerPhotos(photos);
    g.setViewerIndex(index);
    g.setViewerVisible(true);
  };

  const handleGridDelete = async (group: GalleryPhoto[]) => {
    const ids = group.map((p) => p.id).filter(Boolean) as string[];
    const count = ids.length;
    if (count === 0) return;
    alertRef.show({
      title: count === 1 ? t('gallery.deletePhotoTitle') : t('gallery.deleteGroupTitle', { count }),
      message: count === 1
        ? t('gallery.deletePhotoConfirm')
        : t('gallery.deleteGroupConfirm', { count }),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(ids.map((id) => deletePhoto(id)));
              g.handleGroupDeleted(group);
              alertRef.show({
                title: t('common.success'),
                message: count === 1 ? t('gallery.photoDeleted') : t('gallery.photosDeleted', { count }),
                type: 'success',
              });
            } catch (error) {
              alertRef.show({
                title: t('common.error'),
                message: error instanceof Error ? error.message : t('gallery.deletePhotoError'),
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const handleGridPress = (photo: GalleryPhoto, group: GalleryPhoto[]) => {
    const flatPhotos = g.imagePhotos.flat();
    g.setViewerPhotos(flatPhotos);
    const idx = flatPhotos.findIndex((p) => p.id === photo.id);
    g.setViewerIndex(idx >= 0 ? idx : 0);
    g.setViewerVisible(true);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <GalleryHeader
        isSearchOpen={g.isSearchOpen}
        onToggleSearch={() => {
          g.setIsSearchOpen((v: boolean) => !v);
          if (g.isSearchOpen) g.setSearchQuery('');
        }}
        onOpenScanner={() => g.setIsScannerVisible(true)}
        onOpenCamera={() => g.setIsPhotoVisible(true)}
        t={t}
      />

      {g.isSearchOpen && (
        <SearchBar
          value={g.searchQuery}
          onChangeText={g.setSearchQuery}
          onClear={() => g.setSearchQuery('')}
          t={t}
        />
      )}

      <FilterTabs
        filterTab={g.filterTab}
        totalPhotoCount={g.totalPhotoCount}
        onSelectTab={g.setFilterTab}
        t={t}
      />

      <CoursePills
        courses={g.courses}
        selectedCourseId={g.selectedCourseId}
        onSelectCourse={(id) => {
          g.setSelectedCourseId(id);
          // Al cambiar de curso, resetear el filtro de materia
          g.setSelectedSubjectId(null);
        }}
      />

      <SubjectChips
        subjects={g.subjectsForCourse}
        selectedSubjectId={g.selectedSubjectId as string | null}
        onSelectSubject={g.setSelectedSubjectId as (id: string | null) => void}
        t={t}
      />

      <FlatList
        data={g.imagePhotos}
        keyExtractor={(item) => item[0].id?.toString() || Math.random().toString()}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, paddingHorizontal: theme.spacing.lg }}
        contentContainerStyle={[galleryStyles.scroll, { flexGrow: 1, paddingHorizontal: 0 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <React.Fragment>
            {g.filterTab === 'all' && g.starred.length > 0 && (
              <StarredRow
                starred={g.starred}
                onPress={handleStarredPress}
                onStar={g.toggleStar}
                formatDate={g.formatDate}
              />
            )}
          </React.Fragment>
        }
        renderItem={({ item }) => (
          <GridItem
            item={item}
            colWidth={GRID_COL_W}
            formatDate={g.formatDate}
            onPress={handleGridPress}
            onStar={g.toggleStar}
            onDelete={handleGridDelete}
            onOcrPress={g.handleOcrPress}
            t={t}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={
              g.filterTab === 'starred' ? 'star-outline' :
              g.filterTab === 'ocr' ? 'text-outline' : 'images-outline'
            }
            message={
              g.filterTab === 'starred' ? (t('gallery.emptyStarred') || 'No tienes fotos favoritas') :
              g.filterTab === 'ocr' ? 'No hay fotos con texto OCR' :
              (t('gallery.emptyGallery') || 'Tu galería está vacía')
            }
            sub={g.filterTab === 'all' ? (t('gallery.emptyGallerySub') || 'Toma fotos o escanea documentos para empezar') : undefined}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={g.isRefreshing}
            onRefresh={() => g.loadPhotos(true)}
            tintColor={theme.colors.primary}
          />
        }
      />

      <Suspense fallback={<ActivityIndicator style={{ marginTop: 20 }} />}>
        {g.isReady && g.viewerVisible && (
          <ImageViewerModal
            isVisible={g.viewerVisible}
            photos={g.viewerPhotos as any}
            initialIndex={g.viewerIndex}
            onClose={() => g.setViewerVisible(false)}
            onPhotoDeleted={g.handlePhotoDeleted as unknown as (id: string) => void}
            onOCRSaved={g.handleSave}
          />
        )}
        {g.isReady && g.isScannerVisible && (
          <DocumentScannerModal
            isVisible={g.isScannerVisible}
            onClose={() => g.setIsScannerVisible(false)}
            subjects={g.subjects}
            onSave={g.handleSave}
          />
        )}
        {g.isReady && g.isPhotoVisible && (
          <PhotoCaptureModal
            isVisible={g.isPhotoVisible}
            onClose={() => g.setIsPhotoVisible(false)}
            subjects={g.subjects}
            onSave={g.handleSave}
          />
        )}
        <OcrModal
          visible={g.ocrModalVisible}
          text={g.selectedOcrText}
          onClose={() => g.setOcrModalVisible(false)}
          t={t}
        />
      </Suspense>
    </SafeAreaView>
  );
}
