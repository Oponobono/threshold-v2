import { Paths, File, Directory } from 'expo-file-system';
import { storageService } from './storageService';

const PROFILE_IMAGE_DIR_NAME = 'profile_images';
const PROFILE_IMAGE_KEY = 'app:profile_image_local';
const PROFILE_IMAGE_TIMESTAMP_KEY = 'app:profile_image_timestamp';

const getDir = (): Directory => {
  return new Directory(Paths.cache, PROFILE_IMAGE_DIR_NAME);
};

export const downloadProfileImage = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) {
    await storageService.removeLocal(PROFILE_IMAGE_KEY);
    await storageService.removeLocal(PROFILE_IMAGE_TIMESTAMP_KEY);
    return null;
  }

  const existingLocal = await storageService.getLocal(PROFILE_IMAGE_KEY);
  if (existingLocal) {
    const info = Paths.info(existingLocal);
    if (info?.exists) {
      const cachedTimeRaw = await storageService.getLocal(PROFILE_IMAGE_TIMESTAMP_KEY);
      const cachedTime = cachedTimeRaw ? parseInt(cachedTimeRaw, 10) : null;
      const isStale = cachedTime && Date.now() - cachedTime > 7 * 24 * 60 * 60 * 1000;
      if (!isStale) return existingLocal;
    }
  }

  try {
    const dir = getDir();
    await dir.create({ intermediates: true });

    const hash = url.split('/').pop()?.split('?')[0] || 'profile.jpg';
    const destination = new File(dir, hash);
    const result = await File.downloadFileAsync(url, destination);
    if (result.uri) {
      await storageService.saveLocal(PROFILE_IMAGE_KEY, result.uri);
      await storageService.saveLocal(PROFILE_IMAGE_TIMESTAMP_KEY, Date.now().toString());
      return result.uri;
    }
  } catch (e) {
    const fallbackLocal = await storageService.getLocal(PROFILE_IMAGE_KEY);
    if (fallbackLocal) {
      const info = Paths.info(fallbackLocal);
      if (info?.exists) return fallbackLocal;
    }
  }

  return null;
};

export const getLocalProfileImageUri = async (): Promise<string | null> => {
  return storageService.getLocal(PROFILE_IMAGE_KEY);
};

export const clearProfileImageCache = async () => {
  await storageService.removeLocal(PROFILE_IMAGE_KEY);
  await storageService.removeLocal(PROFILE_IMAGE_TIMESTAMP_KEY);
  try {
    const dir = getDir();
    await dir.delete();
  } catch (e) {
    // ignore if doesn't exist
  }
};
