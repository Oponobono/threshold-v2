import { Paths, File, Directory } from 'expo-file-system';
import { cacheService } from './cacheService';

const PROFILE_IMAGE_DIR_NAME = 'profile_images';

const getDir = (): Directory => {
  return new Directory(Paths.cache, PROFILE_IMAGE_DIR_NAME);
};

const getLocalPath = (url: string): string => {
  const hash = url.split('/').pop()?.split('?')[0] || 'profile.jpg';
  return new File(getDir(), hash).uri;
};

export const downloadProfileImage = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) {
    cacheService.clearKey('cache:profile_image_local');
    return null;
  }

  const existingLocal = cacheService.getLocalProfileImage();
  if (existingLocal) {
    const info = Paths.info(existingLocal);
    if (info?.exists) {
      const cachedTime = cacheService.getLocalProfileImageTimestamp();
      const isStale = cachedTime && Date.now() - cachedTime > 7 * 24 * 60 * 60 * 1000;
      if (!isStale) return existingLocal;
      // stale: re-download below
    }
  }

  try {
    const dir = getDir();
    await dir.create({ intermediates: true });

    const hash = url.split('/').pop()?.split('?')[0] || 'profile.jpg';
    const destination = new File(dir, hash);
    const result = await File.downloadFileAsync(url, destination);
    if (result.uri) {
      cacheService.saveLocalProfileImage(result.uri);
      return result.uri;
    }
  } catch (e) {
    const fallbackLocal = cacheService.getLocalProfileImage();
    if (fallbackLocal) {
      const info = Paths.info(fallbackLocal);
      if (info?.exists) return fallbackLocal;
    }
  }

  return null;
};

export const clearProfileImageCache = async () => {
  cacheService.clearKey('cache:profile_image_local');
  try {
    const dir = getDir();
    await dir.delete();
  } catch (e) {
    // ignore if doesn't exist
  }
};
