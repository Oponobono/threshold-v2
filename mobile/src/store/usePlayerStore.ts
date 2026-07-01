import { create } from 'zustand';

interface PlayerState {
  provider: 'youtube' | 'vimeo' | 'other' | null;
  mediaId: string | null;
  listId: string | null;
  subjectId: string | null;
  courseId: string | null;
  mediaTitle: string | null;
  isVisible: boolean;
  isPlaying: boolean;
  onVideoEnd?: () => void;
  playMedia: (params: {
    provider: 'youtube' | 'vimeo' | 'other';
    mediaId?: string | null;
    listId?: string | null;
    subjectId?: string | null;
    courseId?: string | null;
    onVideoEnd?: () => void;
  }) => void;
  setCurrentMediaId: (mediaId: string) => void;
  closePlayer: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setMediaTitle: (title: string) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  provider: null,
  mediaId: null,
  listId: null,
  subjectId: null,
  courseId: null,
  mediaTitle: null,
  isVisible: false,
  isPlaying: false,
  onVideoEnd: undefined,
  playMedia: ({ provider, mediaId = null, listId = null, subjectId = null, courseId = null, onVideoEnd }) =>
    set({ provider, mediaId, listId, subjectId, courseId, onVideoEnd, isVisible: true, isPlaying: true, mediaTitle: null }),
  setCurrentMediaId: (mediaId) => set({ mediaId, mediaTitle: null }),
  closePlayer: () => set({ isVisible: false, provider: null, mediaId: null, listId: null, subjectId: null, courseId: null, mediaTitle: null, onVideoEnd: undefined, isPlaying: false }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setMediaTitle: (title) => set({ mediaTitle: title }),
}));
