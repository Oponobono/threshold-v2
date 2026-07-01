import { Linking } from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { loadMediaProgress, saveMediaProgress } from './mediaProgress';

export type MediaProvider = 'youtube' | 'vimeo' | 'other';

export const MediaPlaybackService = {
  /** Analiza la URL y decide si el servicio de medios puede manejarla in-app */
  async handleUrl(url: string, options?: { subjectId?: string | null, courseId?: string | null, onVideoEnd?: () => void }): Promise<boolean> {
    // 1. Es YouTube?
    const { videoId: ytVideoId, listId: ytListId } = this.parseYouTubeUrl(url);
    if (ytVideoId || ytListId) {
      await this.playMedia('youtube', ytVideoId, ytListId, options);
      return true; // handled in-app
    }
    
    // Aquí se podrían agregar parseos para Vimeo, Udemy, etc. en un futuro
    // if (isVimeoUrl(url)) ...

    return false; // not handled
  },

  async playMedia(provider: MediaProvider, extractedMediaId: string | null, extractedListId: string | null, options: any) {
    let finalMediaId = extractedMediaId;
    let finalListId = extractedListId;

    // Intentar recuperar el progreso si tenemos courseId
    if (options?.courseId) {
      const saved = loadMediaProgress(provider, options.courseId);
      if (saved?.mediaId) {
        finalMediaId = saved.mediaId;
        finalListId = extractedListId ?? saved.listId ?? null;
        console.log(`[MediaService] Retomando progreso guardado para ${provider}: mediaId=${saved.mediaId}`);
      }
    }

    if (finalMediaId || finalListId) {
      usePlayerStore.getState().playMedia({
        provider,
        mediaId: finalMediaId,
        listId: finalListId,
        subjectId: options?.subjectId,
        courseId: options?.courseId,
        onVideoEnd: options?.onVideoEnd,
      });
      console.log(`[MediaService] Abriendo reproductor in-app para ${provider}: mediaId=${finalMediaId} list=${finalListId}`);
    } else {
       console.log(`[MediaService] URL sin identificadores suficientes para ${provider}, omitiendo.`);
    }
  },

  /** Llamado por el componente UI cuando el video actual cambia (ej. avance en playlist) */
  onMediaChanged(provider: MediaProvider, courseId: string, newMediaId: string, listId?: string | null) {
     usePlayerStore.getState().setCurrentMediaId(newMediaId);
     saveMediaProgress(provider, courseId, newMediaId, listId);
  },

  /** Llamado por el componente UI cuando el usuario quiere abrir el video actual en la app nativa/web */
  async openExternally(provider: MediaProvider, mediaId: string | null, listId: string | null) {
    if (provider === 'youtube') {
      if (!mediaId && !listId) return;
      const nativeUrl = mediaId ? `vnd.youtube:${mediaId}` : `vnd.youtube://www.youtube.com/playlist?list=${listId}`;
      const webUrl = mediaId 
        ? `https://www.youtube.com/watch?v=${mediaId}${listId ? `&list=${listId}` : ''}`
        : `https://www.youtube.com/playlist?list=${listId}`;
      
      try {
        const canOpen = await Linking.canOpenURL(nativeUrl);
        await Linking.openURL(canOpen ? nativeUrl : webUrl);
      } catch {
        await Linking.openURL(webUrl);
      }
    }
    // Lógica para otros providers...
  },

  parseYouTubeUrl(url: string): { videoId: string | null; listId: string | null } {
    const videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    const listMatch  = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return {
      videoId: videoMatch?.[1] ?? null,
      listId:  listMatch?.[1]  ?? null,
    };
  }
};
