import { create } from 'zustand';

interface PlayerState {
  videoId: string | null;
  subjectId: string | null;
  courseId: string | null;
  videoTitle: string | null;       // populated via YouTube oEmbed after load
  isVisible: boolean;
  isPlaying: boolean;
  /** Called automatically when the video reaches 'ended' state */
  onVideoEnd?: () => void;
  playVideo: (params: {
    videoId: string;
    subjectId?: string | null;
    courseId?: string | null;
    onVideoEnd?: () => void;
  }) => void;
  closePlayer: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setVideoTitle: (title: string) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  videoId: null,
  subjectId: null,
  courseId: null,
  videoTitle: null,
  isVisible: false,
  isPlaying: false,
  onVideoEnd: undefined,
  playVideo: ({ videoId, subjectId = null, courseId = null, onVideoEnd }) =>
    set({ videoId, subjectId, courseId, onVideoEnd, isVisible: true, isPlaying: true, videoTitle: null }),
  closePlayer: () => set({ isVisible: false, videoId: null, subjectId: null, courseId: null, videoTitle: null, onVideoEnd: undefined, isPlaying: false }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setVideoTitle: (title) => set({ videoTitle: title }),
}));
