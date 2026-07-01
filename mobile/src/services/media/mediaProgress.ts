import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'media-progress' });
const PREFIX = 'media_progress:';

export interface MediaProgress {
  mediaId: string;
  listId?: string;
  provider: 'youtube' | 'vimeo' | 'other';
  savedAt: number;
}

export function saveMediaProgress(provider: string, courseId: string, mediaId: string, listId?: string | null): void {
  try {
    const data: MediaProgress = {
      provider: provider as any,
      mediaId,
      ...(listId ? { listId } : {}),
      savedAt: Date.now(),
    };
    storage.set(`${PREFIX}${provider}_${courseId}`, JSON.stringify(data));
  } catch {}
}

export function loadMediaProgress(provider: string, courseId: string): MediaProgress | null {
  try {
    const raw = storage.getString(`${PREFIX}${provider}_${courseId}`);
    if (!raw) return null;
    return JSON.parse(raw) as MediaProgress;
  } catch {
    return null;
  }
}

export function clearMediaProgress(provider: string, courseId: string): void {
  try {
    storage.remove(`${PREFIX}${provider}_${courseId}`);
  } catch {}
}

export function clearAllMediaProgress(): void {
  try {
    const keys = storage.getAllKeys();
    for (const key of keys) {
      if (key.startsWith(PREFIX)) storage.remove(key);
    }
  } catch {}
}
