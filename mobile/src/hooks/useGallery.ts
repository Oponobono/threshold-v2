import { useState, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { updatePhoto } from '../services/api';
import { photoRepository } from '../services/database';
import { useDataStore } from '../store/useDataStore';
import { GalleryPhoto, FilterTab } from '../types/gallery';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export function useGallery(t: any) {
  const { subjects, loadAllData } = useDataStore();

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isPhotoVisible, setIsPhotoVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<GalleryPhoto[]>([]);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [selectedOcrText, setSelectedOcrText] = useState('');

  const loadPhotos = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      // Leer siempre desde SQLite local — la galería funciona 100% offline
      const list = await photoRepository.getAll();
      const subjectMap = new Map(subjects.map((s) => [s.id, s]));
      const enriched: GalleryPhoto[] = (list as any[]).map((item: any) => {
        const subj = subjectMap.get(item.subject_id);
        return {
          ...item,
          subject_name: subj?.name ?? t('gallery.unknownSubject'),
          subject_color: subj?.color ?? '#2F80ED',
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

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadAllData();
        loadPhotos();
      });
      return () => task.cancel();
    }, [loadAllData, loadPhotos])
  );

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
    setViewerPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleGroupDeleted = useCallback((group: GalleryPhoto[]) => {
    const ids = new Set(group.map((p) => p.id).filter(Boolean));
    setPhotos((prev) => prev.filter((p) => p.id && !ids.has(p.id)));
    setViewerPhotos((prev) => prev.filter((p) => p.id && !ids.has(p.id)));
  }, []);

  const handleSave = useCallback(() => loadPhotos(true), [loadPhotos]);

  const handleOcrPress = useCallback((ocrText: string) => {
    setSelectedOcrText(ocrText);
    setOcrModalVisible(true);
  }, []);

  const { imagePhotos, starred, totalPhotoCount } = useMemo(() => {
    const allImgs = photos.filter((p) => !p.local_uri?.endsWith('.pdf'));

    const filteredBySubjectAndSearch = allImgs.filter((p) => {
      const matchesSubject = selectedSubjectId === null || p.subject_id === selectedSubjectId;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        p.subject_name?.toLowerCase().includes(q) ||
        p.ocr_text?.toLowerCase().includes(q) ||
        p.tags?.toLowerCase().includes(q);
      return matchesSubject && matchesSearch;
    });

    const gridPhotos = filteredBySubjectAndSearch.filter((p) => {
      if (filterTab === 'starred') return p.es_favorita === 1;
      if (filterTab === 'ocr') return !!p.ocr_text;
      return true;
    });

    const groupedPhotos: GalleryPhoto[][] = [];
    const groupMap = new Map<string, GalleryPhoto[]>();

    gridPhotos.forEach(p => {
      if (p.group_id) {
        if (!groupMap.has(p.group_id)) {
          groupMap.set(p.group_id, []);
        }
        const group = groupMap.get(p.group_id)!;
        group.push(p);
      } else {
        groupedPhotos.push([p]);
      }
    });

    groupMap.forEach(group => {
      groupedPhotos.push(group);
    });

    groupedPhotos.sort((a, b) => {
      const dateA = new Date(a[0].created_at || 0).getTime();
      const dateB = new Date(b[0].created_at || 0).getTime();
      return dateB - dateA;
    });

    const starredPhotos = filteredBySubjectAndSearch.filter((p) => p.es_favorita === 1);
    const totalPhotos = groupedPhotos.reduce((sum, group) => sum + group.length, 0);

    return {
      imagePhotos: groupedPhotos,
      starred: starredPhotos,
      totalPhotoCount: totalPhotos,
    };
  }, [photos, filterTab, selectedSubjectId, searchQuery]);

  return {
    photos, isLoading, isRefreshing,
    filterTab, setFilterTab,
    selectedSubjectId, setSelectedSubjectId,
    searchQuery, setSearchQuery,
    isSearchOpen, setIsSearchOpen,
    viewerVisible, setViewerVisible,
    viewerIndex, setViewerIndex,
    isScannerVisible, setIsScannerVisible,
    isPhotoVisible, setIsPhotoVisible,
    viewerPhotos, setViewerPhotos,
    ocrModalVisible, setOcrModalVisible,
    selectedOcrText, setSelectedOcrText,
    imagePhotos, starred, totalPhotoCount,
    loadPhotos, toggleStar,
    handlePhotoDeleted, handleGroupDeleted, handleSave, handleOcrPress,
    formatDate, subjects, loadAllData,
  };
}
