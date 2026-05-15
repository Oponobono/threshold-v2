import React, { useState, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import {
  View, Text, Dimensions, ActivityIndicator,
  InteractionManager, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { galleryStyles as styles } from '../../src/styles/Gallery.styles';
import {
  getGalleryItems, updatePhoto,
  type Photo,
} from '../../src/services/api';
import { useDataStore } from '../../src/store/useDataStore';
import { AutoUploadIndicator } from '../../src/components/AutoUploadIndicator';

// ── Lazy-loaded heavy modals ──────────────────────────────────────────────────
const ImageViewerModal = lazy(() =>
  import('../../src/components/ImageViewerModal').then(m => ({ default: m.ImageViewerModal }))
);
const PhotoCaptureModal = lazy(() =>
  import('../../src/components/PhotoCaptureModal').then(m => ({ default: m.PhotoCaptureModal }))
);
const DocumentScannerModal = lazy(() =>
  import('../../src/components/DocumentScannerModal').then(m => ({ default: m.DocumentScannerModal }))
);

const SCREEN_W = Dimensions.get('window').width;
const GRID_COL_W = (SCREEN_W - theme.spacing.lg * 2 - 16 - 1) / 2;

// ── Types ─────────────────────────────────────────────────────────────────────
interface GalleryPhoto extends Photo {
  subject_name?: string;
  subject_color?: string;
}

// ── Memoized grid item — prevents re-render of every card on star toggle ──────
const GridItem = memo(function GridItem({
  item,
  onPress,
  onStar,
  formatDate,
}: {
  item: GalleryPhoto;
  onPress: () => void;
  onStar: () => void;
  formatDate: (d?: string) => string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.gridCard, { width: GRID_COL_W }]}
      onPress={onPress}
    >
      <Image 
        source={{ uri: item.local_uri }} 
        style={styles.gridImage} 
        contentFit="cover"
        transition={200}
      />

      {item.ocr_text ? (
        <View style={styles.ocrOverlay}>
          <MaterialCommunityIcons name="text-recognition" size={10} color={theme.colors.primary} />
          <Text style={styles.ocrOverlayText}>OCR</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={onStar}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: 'absolute', top: 6, left: 6,
          backgroundColor: theme.colors.primaryTransparent.heavy,
          borderRadius: 12, padding: 4,
        }}
      >
        <Ionicons
          name={item.es_favorita ? 'star' : 'star-outline'}
          size={14}
          color={item.es_favorita ? '#FFD700' : '#fff'}
        />
      </TouchableOpacity>

      <View style={styles.gridInfo}>
        <View style={[globalStyles.rowCenter, globalStyles.mb4, { gap: 4 }]}>
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: item.subject_color || theme.colors.primary,
          }} />
          <Text style={styles.gridSubject} numberOfLines={1}>{item.subject_name}</Text>
        </View>
        <Text style={styles.gridDate}>{formatDate(item.created_at)}</Text>
        {item.ocr_text ? (
          <Text style={styles.gridOcr} numberOfLines={2}>{item.ocr_text}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = React.memo(function EmptyState({
  icon, message, sub,
}: {
  icon: string; message: string; sub?: string;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: theme.spacing.lg }}>
      <View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: theme.colors.primary + '15',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Ionicons name={icon as any} size={32} color={theme.colors.primary} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text.primary, textAlign: 'center', marginBottom: 6 }}>
        {message}
      </Text>
      {sub ? (
        <Text style={{ fontSize: 13, color: theme.colors.text.secondary, textAlign: 'center' }}>{sub}</Text>
      ) : null}
    </View>
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function GalleryScreen() {
  const { t } = useTranslation();

  // Subjects come from the shared Zustand store — no extra fetch needed
  const { subjects, loadAllData } = useDataStore();

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'starred' | 'ocr'>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Modals — only mounted when opened
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isPhotoVisible, setIsPhotoVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<GalleryPhoto[]>([]);

  // ── Load photos ─────────────────────────────────────────────────────────────
  const loadPhotos = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const raw = await getGalleryItems();
      const list = Array.isArray(raw) ? raw : [];
      const subjectMap = new Map(subjects.map((s) => [s.id, s]));
      const enriched: GalleryPhoto[] = list.map((item: any) => {
        const subj = subjectMap.get(item.subject_id);
        return {
          ...item,
          subject_name: subj?.name ?? t('gallery.unknownSubject'),
          subject_color: subj?.color ?? theme.colors.primary,
        };
      });
      setPhotos(enriched);
    } catch (err) {
      console.warn('[GalleryScreen] loadPhotos error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [subjects, t]);

  // Defer load until navigation animations finish
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadAllData();   // Refreshes subjects from the store (no-op if already loaded)
        loadPhotos();
      });
      return () => task.cancel();
    }, [loadAllData, loadPhotos])
  );

  // ── Toggle Starred ──────────────────────────────────────────────────────────
  const toggleStar = useCallback(async (photo: GalleryPhoto) => {
    const newVal = photo.es_favorita ? 0 : 1;
    setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, es_favorita: newVal } : p));
    try {
      if (photo.id) await updatePhoto(photo.id, { es_favorita: newVal === 1 });
    } catch {
      setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, es_favorita: photo.es_favorita } : p));
    }
  }, []);

  const handlePhotoDeleted = useCallback((id: number) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleSave = useCallback(() => loadPhotos(true), [loadPhotos]);

  // ── Derived filtered lists — only recomputed when deps change ───────────────
  const { imagePhotos, starred } = useMemo(() => {
    const allImgs = photos.filter((p) => !p.local_uri?.endsWith('.pdf'));
    
    // Filtramos por materia seleccionada y búsqueda
    const filteredBySubjectAndSearch = allImgs.filter((p) => {
      const matchesSubject = selectedSubjectId === null || p.subject_id === selectedSubjectId;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        p.subject_name?.toLowerCase().includes(q) ||
        p.ocr_text?.toLowerCase().includes(q) ||
        p.tags?.toLowerCase().includes(q);
      
      return matchesSubject && matchesSearch;
    });

    // La lista para el grid depende del tab activo (Todas, Favoritas, OCR)
    const gridPhotos = filteredBySubjectAndSearch.filter((p) => {
      if (filterTab === 'starred') return p.es_favorita === 1;
      if (filterTab === 'ocr') return !!p.ocr_text;
      return true;
    });

    // Las favoritas ahora respetan el filtro de materia
    const starredPhotos = filteredBySubjectAndSearch.filter((p) => p.es_favorita === 1);

    return {
      imagePhotos: gridPhotos,
      starred: starredPhotos,
    };
  }, [photos, filterTab, selectedSubjectId, searchQuery]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
        <View style={globalStyles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="images-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
          <Text style={styles.logoText}>{t('gallery.title') || 'Galería'}</Text>
        </View>
        <View style={globalStyles.row}>
          <TouchableOpacity
            style={{ padding: 4 }}
            onPress={() => { setIsSearchOpen((v) => !v); if (isSearchOpen) setSearchQuery(''); }}
          >
            <Feather name={isSearchOpen ? 'x' : 'search'} size={18} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanBtn, { marginLeft: 8 }]}
            onPress={() => setIsScannerVisible(true)}
          >
            <Ionicons name="scan-outline" size={16} color={theme.colors.text.primary} style={{ marginRight: 4 }} />
            <Text style={styles.scanText}>{t('gallery.scan') || 'Escanear'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginLeft: 8, padding: 4 }} onPress={() => setIsPhotoVisible(true)}>
            <Ionicons name="camera-outline" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SEARCH BAR ROW ── */}
      {isSearchOpen && (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInner}>
            <Feather name="search" size={16} color={theme.colors.text.secondary} style={{ marginRight: 8 }} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('gallery.searchPlaceholder') || 'Buscar fotos, materias, OCR...'}
              placeholderTextColor={theme.colors.text.placeholder}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.colors.text.placeholder} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── FILTER TABS ── */}
      <View style={[styles.tabRow, { alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['all', 'starred', 'ocr'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, filterTab === tab && styles.tabActive]}
              onPress={() => setFilterTab(tab)}
            >
              <Text style={[styles.tabText, filterTab === tab && styles.tabTextActive]}>
                {tab === 'all' ? (t('gallery.all') || 'Todas') :
                 tab === 'starred' ? (t('gallery.starred') || 'Favoritas') : 'OCR'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.itemCount}>{imagePhotos.length} {t('gallery.items') || 'fotos'}</Text>
          <AutoUploadIndicator size={18} />
        </View>
      </View>

      {/* ── SUBJECT CHIPS ── */}
      {subjects.length > 0 ? (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 46, flexGrow: 0, minHeight: 46 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 6, gap: 6, alignItems: 'center' }}
        >
          <TouchableOpacity
            onPress={() => setSelectedSubjectId(null)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'center',
              paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
              borderColor: selectedSubjectId === null ? theme.colors.text.primary : theme.colors.border,
              backgroundColor: selectedSubjectId === null ? theme.colors.text.primary : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: selectedSubjectId === null ? '700' : '500', color: selectedSubjectId === null ? theme.colors.white : theme.colors.text.secondary, letterSpacing: -0.1 }}>
              {t('gallery.allSubjects') || 'Todas las materias'}
            </Text>
          </TouchableOpacity>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSelectedSubjectId(selectedSubjectId === s.id ? null : s.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'center',
                paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
                borderColor: selectedSubjectId === s.id ? theme.colors.text.primary : theme.colors.border,
                backgroundColor: selectedSubjectId === s.id ? theme.colors.text.primary : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: selectedSubjectId === s.id ? '700' : '500', color: selectedSubjectId === s.id ? theme.colors.white : theme.colors.text.secondary, letterSpacing: -0.1 }}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <FlatList
        data={imagePhotos}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, paddingHorizontal: theme.spacing.lg }}
        contentContainerStyle={[styles.scroll, { flexGrow: 1, paddingHorizontal: 0 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            {/* ── STARRED ROW ── */}
            {filterTab === 'all' && starred.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>{t('gallery.starred') || 'Favoritas'}</Text>
                  <Text style={styles.sectionMeta}>{starred.length} {t('gallery.favorites') || 'fotos'}</Text>
                </View>
                <FlatList
                  horizontal
                  data={starred}
                  keyExtractor={(item) => `star-${item.id}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.starredRow}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.starredCard}
                      activeOpacity={0.85}
                      onPress={() => {
                        setViewerPhotos(starred);
                        const idx = starred.findIndex((p) => p.id === item.id);
                        setViewerIndex(idx >= 0 ? idx : 0);
                        setViewerVisible(true);
                      }}
                    >
                      <Image 
                        source={{ uri: item.local_uri }} 
                        style={styles.starredImage}
                        contentFit="cover"
                        transition={200}
                      />
                      <Text style={styles.starredSubject} numberOfLines={1}>{item.subject_name}</Text>
                      <Text style={styles.starredDate}>{formatDate(item.created_at)}</Text>
                      <TouchableOpacity
                        style={styles.starBtn}
                        onPress={() => toggleStar(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="star" size={14} color="#FFD700" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {imagePhotos.length > 0 && (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {filterTab === 'starred' ? (t('gallery.starred') || 'Favoritas') :
                   filterTab === 'ocr' ? 'Con texto OCR' :
                   (t('gallery.gallerySection') || 'Galería')}
                </Text>
                <Text style={styles.sectionMeta}>{imagePhotos.length} {t('gallery.items') || 'fotos'}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <GridItem
            item={item}
            formatDate={formatDate}
            onPress={() => {
              setViewerPhotos(imagePhotos);
              const idx = imagePhotos.findIndex((p) => p.id === item.id);
              setViewerIndex(idx >= 0 ? idx : 0);
              setViewerVisible(true);
            }}
            onStar={() => toggleStar(item)}
          />
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <EmptyState
              icon={
                filterTab === 'starred' ? 'star-outline' :
                filterTab === 'ocr' ? 'text-outline' : 'images-outline'
              }
              message={
                filterTab === 'starred' ? (t('gallery.emptyStarred') || 'No tienes fotos favoritas') :
                filterTab === 'ocr' ? 'No hay fotos con texto OCR' :
                (t('gallery.emptyGallery') || 'Tu galería está vacía')
              }
              sub={filterTab === 'all' ? (t('gallery.emptyGallerySub') || 'Toma fotos o escanea documentos para empezar') : undefined}
            />
            {filterTab === 'all' && (
              <View style={[globalStyles.row, globalStyles.mt8, { gap: 12 }]}>
                <TouchableOpacity
                  style={[globalStyles.flex1, globalStyles.rowCenter, globalStyles.centerVertical, { gap: 6, backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 12 }]}
                  onPress={() => setIsScannerVisible(true)}
                >
                  <Ionicons name="scan-outline" size={18} color={theme.colors.white} />
                  <Text style={{ color: theme.colors.white, fontWeight: '700', fontSize: theme.typography.sizes.sm }}>{t('gallery.scan') || 'Escanear'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[globalStyles.flex1, globalStyles.rowCenter, globalStyles.centerVertical, { gap: 6, backgroundColor: theme.colors.text.primary, paddingVertical: 12, borderRadius: 12 }]}
                  onPress={() => setIsPhotoVisible(true)}
                >
                  <Ionicons name="camera-outline" size={18} color={theme.colors.white} />
                  <Text style={{ color: theme.colors.white, fontWeight: '700', fontSize: theme.typography.sizes.sm }}>{t('gallery.takePhoto') || 'Tomar foto'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadPhotos(true)}
            tintColor={theme.colors.primary}
          />
        }
      />

      {/* ── LAZY MODALS — only rendered when needed ── */}
      <Suspense fallback={null}>
        {viewerVisible && (
          <ImageViewerModal
            isVisible={viewerVisible}
            photos={viewerPhotos as any}
            initialIndex={viewerIndex}
            onClose={() => setViewerVisible(false)}
            onPhotoDeleted={handlePhotoDeleted}
            onOCRSaved={handleSave}
          />
        )}
        {isScannerVisible && (
          <DocumentScannerModal
            isVisible={isScannerVisible}
            onClose={() => setIsScannerVisible(false)}
            subjects={subjects}
            onSave={handleSave}
          />
        )}
        {isPhotoVisible && (
          <PhotoCaptureModal
            isVisible={isPhotoVisible}
            onClose={() => setIsPhotoVisible(false)}
            subjects={subjects}
            onSave={handleSave}
          />
        )}
      </Suspense>
    </SafeAreaView>
  );
}
