import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { updatePhoto } from '../services/api';
import { photoRepository } from '../services/database';
import { useDataStore } from '../store/useDataStore';
import { GalleryPhoto, FilterTab } from '../types/gallery';
import type { Course } from '../services/api/types';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

function enrichPhotos(rawPhotos: any[], subjects: any[], t: any): GalleryPhoto[] {
  const subjectMap = new Map(subjects.map((s: any) => [s.id, s]));
  return rawPhotos.map((item: any) => {
    const subj = subjectMap.get(item.subject_id);
    return {
      ...item,
      subject_name: subj?.name ?? t('gallery.unknownSubject'),
      subject_color: subj?.color ?? '#2F80ED',
    };
  });
}

export function useGallery(t: any) {
  const storeSubjects = useDataStore(s => s.subjects);
  const storePhotos = useDataStore(s => s.photos);
  const storeCourses = useDataStore(s => s.courses);
  const { loadAllData } = useDataStore();

  const subjects = storeSubjects;

  const [photos, setPhotos] = useState<GalleryPhoto[]>(() => enrichPhotos(storePhotos, storeSubjects, t));
  const [isLoading, setIsLoading] = useState(storePhotos.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterOcr, setFilterOcr] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>(storeCourses as Course[]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isPhotoVisible, setIsPhotoVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<GalleryPhoto[]>([]);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [selectedOcrText, setSelectedOcrText] = useState('');

  const hadInitialDataRef = useRef(storePhotos.length > 0);

  useEffect(() => {
    if (storePhotos.length > 0) {
      setPhotos(enrichPhotos(storePhotos, storeSubjects, t));
    }
  }, [storePhotos, storeSubjects, t]);

  useEffect(() => {
    if (storeCourses.length > 0 && courses.length === 0) {
      setCourses(storeCourses as Course[]);
    }
  }, [storeCourses]);

  const loadPhotos = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const list = await photoRepository.getAll();
      const enriched = enrichPhotos(list as any[], subjects, t);
      setPhotos(enriched);
    } catch (err) {
      console.warn('[GalleryScreen] loadPhotos error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [subjects, t]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
      loadAllData();
      if (!hadInitialDataRef.current) {
        loadPhotos();
      }
      hadInitialDataRef.current = false;
    });
    return () => task.cancel();
  }, [loadAllData, loadPhotos]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadPhotos(true);
      });
      return () => task.cancel();
    }, [loadPhotos])
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

  const handlePhotoDeleted = useCallback((id: string) => {
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

    const subjectIdsInCourse = selectedCourseId
      ? new Set(subjects.filter(s => (s as any).course_id === selectedCourseId).map(s => s.id))
      : null;

    const filteredBySubjectAndSearch = allImgs.filter((p) => {
      if (subjectIdsInCourse && !subjectIdsInCourse.has(p.subject_id)) return false;
      const matchesSubject = selectedSubjectId === null || p.subject_id === selectedSubjectId;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        p.subject_name?.toLowerCase().includes(q) ||
        p.ocr_text?.toLowerCase().includes(q) ||
        p.tags?.toLowerCase().includes(q);
      return matchesSubject && matchesSearch;
    });

    const gridPhotos = filteredBySubjectAndSearch.filter((p) => {
      let include = true;
      if (filterStarred && p.es_favorita !== 1) include = false;
      if (filterOcr && !p.ocr_text) include = false;
      return include;
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
  }, [photos, filterStarred, filterOcr, selectedSubjectId, selectedCourseId, searchQuery, subjects]);

  const { availableCourseIds, availableSubjectIds } = useMemo(() => {
    const subjectIds = new Set<string>();
    const courseIds = new Set<string>();
    photos.forEach((p) => {
      if (p.subject_id) {
        subjectIds.add(p.subject_id);
        const subj = subjects.find((s: any) => s.id === p.subject_id);
        if (subj && (subj as any).course_id) courseIds.add((subj as any).course_id);
      }
    });
    return { availableCourseIds: courseIds, availableSubjectIds: subjectIds };
  }, [photos, subjects]);

  return {
    photos, isLoading, isRefreshing,
    isReady,
    filterStarred, setFilterStarred,
    filterOcr, setFilterOcr,
    selectedSubjectId, setSelectedSubjectId,
    selectedCourseId, setSelectedCourseId,
    courses,
    subjectsForCourse: selectedCourseId
      ? subjects.filter(s => (s as any).course_id === selectedCourseId)
      : subjects,
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
    availableCourseIds,
    availableSubjectIds,
  };
}
