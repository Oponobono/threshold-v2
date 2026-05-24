import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getYouTubeVideos, createYouTubeVideo, deleteYouTubeVideo, YouTubeVideo } from '../services/api';
import { useAudioRecorder } from './useAudioRecorder';
import { SubjectSection, GridMediaItem } from '../components/RecordingsGrid';
import { cacheService } from '../services/cacheService';

/**
 * Hook para manejar la lógica de la pantalla de Grabaciones y Multimedia.
 * Combina las grabaciones de audio locales con los videos de YouTube,
 * y aplica filtros, búsquedas y ordenamientos.
 */
export const useRecordingsManager = () => {
  const { t } = useTranslation();
  
  // ── Audio recordings
  const audioContext = useAudioRecorder();
  const { recordings, deleteRecordingConfirmed, loadRecordings } = audioContext;

  // ── YouTube videos
  const [youTubeVideos, setYouTubeVideos] = useState<YouTubeVideo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isAddingYouTubeVideo, setIsAddingYouTubeVideo] = useState(false);

  // ── Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'recording' | 'video'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const loadYouTubeVideos = useCallback(async () => {
    setIsLoadingVideos(true);
    try {
      const videos = await getYouTubeVideos();
      setYouTubeVideos(videos);
      // Guardar en caché para usar como fallback si hay error después
      await cacheService.saveYouTubeVideos(videos);
      console.log(`[useRecordingsManager] ✅ Cargados ${videos.length} videos de YouTube`);
    } catch (e) {
      console.warn('[useRecordingsManager] ⚠️ Error loading YouTube videos:', e);
      // Intentar cargar desde caché como fallback
      try {
        const cachedVideos: YouTubeVideo[] | null = await cacheService.loadYouTubeVideos() as YouTubeVideo[] | null;
        if (cachedVideos && cachedVideos.length > 0) {
          console.log(`[useRecordingsManager] ✅ Cargados ${cachedVideos.length} videos desde caché`);
          setYouTubeVideos(cachedVideos);
        }
      } catch (cacheError) {
        console.warn('[useRecordingsManager] Cache load failed:', cacheError);
      }
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  const handleAddYoutube = async (youtubeUrl: string) => {
    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl) throw new Error('Por favor, ingresa un enlace de YouTube.');
    if (!trimmedUrl.includes('youtube.com') && !trimmedUrl.includes('youtu.be')) {
      throw new Error('Por favor, ingresa un enlace válido de YouTube (youtube.com o youtu.be).');
    }
    
    setIsAddingYouTubeVideo(true);
    try {
      let videoId = '';
      if (trimmedUrl.includes('youtube.com/watch?v=')) {
        videoId = trimmedUrl.split('v=')[1]?.split('&')[0]?.trim() || '';
      } else if (trimmedUrl.includes('youtu.be/')) {
        videoId = trimmedUrl.split('youtu.be/')[1]?.split('?')[0]?.split('#')[0]?.trim() || '';
      }

      if (!videoId || videoId.length < 10) {
        throw new Error('No se pudo extraer un ID de video válido.');
      }

      let videoTitle = 'Video de YouTube';
      let thumbnailUrl = '';
      try {
        const metadataRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        if (metadataRes.ok) {
          const metadata = await metadataRes.json();
          if (metadata.title) videoTitle = metadata.title;
          if (metadata.thumbnail_url) thumbnailUrl = metadata.thumbnail_url;
        }
      } catch (err) {
        console.warn('Error fetching video metadata:', err);
      }

      await createYouTubeVideo({
        youtube_url: trimmedUrl,
        video_id: videoId,
        title: videoTitle,
        thumbnail_url: thumbnailUrl,
        subject_id: null,
      });

      // Recargar videos para que el nuevo aparezca
      await loadYouTubeVideos();
    } finally {
      setIsAddingYouTubeVideo(false);
    }
  };

  const handleDeleteItem = useCallback(
    (id: string) => {
      const video = youTubeVideos.find((v) => v.id?.toString() === id);
      if (video) {
        deleteYouTubeVideo(video.id!)
          .catch((e) => {
            console.warn('[useRecordingsManager] Error deleting video:', e);
            alert('Error al eliminar el video');
          })
          .finally(() => {
            console.log('[useRecordingsManager] Video eliminado, recargando lista...');
            loadYouTubeVideos();
          });
        return;
      }
      const rec = recordings.find((r) => (r.id_string || r.id?.toString()) === id);
      if (rec) {
        deleteRecordingConfirmed(rec.id_string || rec.id || 0, rec.uri);
      }
    },
    [youTubeVideos, recordings, deleteRecordingConfirmed, loadYouTubeVideos]
  );

  const sections: SubjectSection[] = useMemo(() => {
    const UNCLASSIFIED = t('dashboard.audioRecorderModal.unclassified') || 'Sin clasificar';
    const bySubject = new Map<string, SubjectSection>();
    const q = searchQuery.trim().toLowerCase();

    const getOrCreate = (name: string, color?: string): SubjectSection => {
      if (!bySubject.has(name)) {
        bySubject.set(name, { subjectName: name, subjectColor: color, items: [] });
      }
      return bySubject.get(name)!;
    };

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const ONE_WEEK_MS = 7 * ONE_DAY_MS;
    const ONE_MONTH_MS = 30 * ONE_DAY_MS;

    const passesDateFilter = (dateString?: string) => {
      if (dateFilter === 'all') return true;
      if (!dateString) return true;
      const time = new Date(dateString).getTime();
      if (isNaN(time)) return true;
      const diff = now - time;
      if (dateFilter === 'today') return diff <= ONE_DAY_MS;
      if (dateFilter === 'week') return diff <= ONE_WEEK_MS;
      if (dateFilter === 'month') return diff <= ONE_MONTH_MS;
      return true;
    };

    if (activeFilter !== 'video') {
      recordings.forEach((rec) => {
        if (q && !rec.name?.toLowerCase().includes(q) && !(rec.subject_name || '').toLowerCase().includes(q)) return;
        if (!passesDateFilter(rec.created_at || rec.date)) return;
        const subjectName = rec.subject_name || UNCLASSIFIED;
        const section = getOrCreate(subjectName, rec.subject_color || undefined);
        
        // DEBUG: Log recording color
        if (process.env.NODE_ENV !== 'production' && rec.name) {
          console.log(`[useRecordingsManager] Recording "${rec.name}": subject_color="${rec.subject_color}" (id=${rec.id}, subject_id=${rec.subject_id})`);
        }
        
        // Garantizar que siempre hay un ID válido (nunca vacío)
        // Fallback: id_string → id → local_uri filename → uri
        const recordingId = 
          rec.id_string || 
          rec.id?.toString() || 
          (rec.uri ? rec.uri.split('/').pop()?.replace(/\.m4a$/, '') : '') ||
          (rec.local_uri ? rec.local_uri.split('/').pop()?.replace(/\.m4a$/, '') : '') ||
          '';
        
        section.items.push({
          id: recordingId,
          name: rec.name || 'Grabación',
          type: 'recording',
          date: rec.date,
          created_at: rec.created_at,
          subject_name: rec.subject_name,
          subject_color: rec.subject_color || undefined,
          uri: rec.uri,
          duration: rec.duration ?? undefined,
          missingFile: (rec as any).missingFile,
        });
      });
    }

    if (activeFilter !== 'recording') {
      youTubeVideos.forEach((video) => {
        const title = video.title || 'Video de YouTube';
        if (q && !title.toLowerCase().includes(q) && !(video.subject_name || '').toLowerCase().includes(q)) return;
        if (!passesDateFilter(video.created_at)) return;
        const subjectName = video.subject_name || UNCLASSIFIED;
        const section = getOrCreate(subjectName, undefined);
        section.items.push({
          id: video.id?.toString() || '',
          name: title,
          type: 'video',
          date: video.created_at ? new Date(video.created_at).toLocaleString() : 'Fecha desconocida',
          created_at: video.created_at,
          subject_name: video.subject_name,
          thumbnail_url: video.thumbnail_url || undefined,
          video_id: video.video_id,
        });
      });
    }

    return Array.from(bySubject.values())
      .filter((s) => s.items.length > 0)
      .map((section) => {
        section.items.sort((a, b) => {
          const timeA = new Date(a.created_at || a.date).getTime();
          const timeB = new Date(b.created_at || b.date).getTime();
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });
        return section;
      })
      .sort((a, b) => {
        if (a.subjectName === UNCLASSIFIED) return 1;
        if (b.subjectName === UNCLASSIFIED) return -1;
        return a.subjectName.localeCompare(b.subjectName);
      });
  }, [recordings, youTubeVideos, t, searchQuery, activeFilter, sortOrder, dateFilter]);

  return {
    audioContext,
    youTubeVideos,
    isLoadingVideos,
    isAddingYouTubeVideo,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    sortOrder,
    setSortOrder,
    dateFilter,
    setDateFilter,
    sections,
    loadYouTubeVideos,
    loadRecordings,
    handleAddYoutube,
    handleDeleteItem
  };
};
