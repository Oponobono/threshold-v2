/**
 * cacheCleanupService.ts
 *
 * Políticas de retención de caché y limpieza automática.
 * Evita que la app crezca indefinidamente con datos stale,
 * archivos temporales y entradas de caché expiradas.
 *
 * Estrategias:
 *   - MMKV: evicción solo por tamaño máximo (~30MB) o edad absoluta (30 días).
 *     NUNCA se elimina caché por TTL de frescura para no romper offline-first.
 *   - AsyncStorage: limpieza de entries api_cache_ con más de 24h.
 *   - Archivos temporales (OCR, PDF): limpieza agresiva (>1h).
 *   - Logging del espacio usado para monitoreo.
 */

import { createMMKV } from 'react-native-mmkv';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MMKV_CACHE_PREFIX = 'cache:';

const MMKV_MAX_SIZE_BYTES = 30 * 1024 * 1024;
const MMKV_TRIM_TARGET_BYTES = 20 * 1024 * 1024;

const MMKV_ABSOLUTE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const CACHE_KEYS_TO_KEEP = new Set([
  'cache:profile_image_local',
  'cache:last_sync',
]);

const ASYNC_CACHE_PREFIX = 'api_cache_';
const ASYNC_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

const TEMP_FILE_MAX_AGE_MS = 1000 * 60 * 60;
const TEMP_DIRS = ['', 'Threshold/'];
const TEMP_FILE_PREFIXES = ['ocr_temp_', 'pdf_temp_'];

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

interface EntryWithSize {
  key: string;
  timestamp: number;
  rawSize: number;
}

// ─── Limpieza de MMKV (size-based + max age) ─────────────────────────────────

async function evictExpiredMmkvEntries(): Promise<{
  removed: number;
  totalSize: number;
}> {
  try {
    const storage = createMMKV();
    const allKeys = storage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (k) => k.startsWith(MMKV_CACHE_PREFIX) && !CACHE_KEYS_TO_KEEP.has(k)
    );

    if (cacheKeys.length === 0) return { removed: 0, totalSize: 0 };

    let removed = 0;
    let totalSize = 0;
    const now = Date.now();
    const entriesWithAge: EntryWithSize[] = [];

    for (const key of cacheKeys) {
      try {
        const raw = storage.getString(key);
        if (!raw) {
          storage.remove(key);
          removed++;
          continue;
        }

        const rawSize = raw.length * 2;
        totalSize += rawSize;

        const entry: CacheEntry = JSON.parse(raw);
        const age = now - entry.timestamp;

        if (age > MMKV_ABSOLUTE_MAX_AGE_MS) {
          storage.remove(key);
          removed++;
          continue;
        }

        entriesWithAge.push({ key, timestamp: entry.timestamp, rawSize });
      } catch {
        storage.remove(key);
        removed++;
      }
    }

    if (totalSize > MMKV_MAX_SIZE_BYTES && entriesWithAge.length > 0) {
      entriesWithAge.sort((a, b) => a.timestamp - b.timestamp);

      let currentSize = entriesWithAge.reduce((s, e) => s + e.rawSize, 0);

      for (const entry of entriesWithAge) {
        if (currentSize <= MMKV_TRIM_TARGET_BYTES) break;
        storage.remove(entry.key);
        currentSize -= entry.rawSize;
        removed++;
      }

      totalSize = currentSize;
    }

    if (removed > 0) {
      console.log(
        `[CacheCleanup] 🗑️ Evicted ${removed} entries from MMKV` +
          ` (now ~${(totalSize / 1024 / 1024).toFixed(1)}MB)`
      );
    } else {
      console.log(
        `[CacheCleanup] ℹ️ MMKV: ${cacheKeys.length} entries, ~${(totalSize / 1024 / 1024).toFixed(1)}MB`
      );
    }

    return { removed, totalSize };
  } catch (error) {
    console.warn('[CacheCleanup] Error evicting MMKV entries:', error);
    return { removed: 0, totalSize: 0 };
  }
}

// ─── Limpieza de AsyncStorage ────────────────────────────────────────────────

async function evictStaleAsyncStorageCache(): Promise<number> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(ASYNC_CACHE_PREFIX));

    if (cacheKeys.length === 0) return 0;

    let removed = 0;
    const now = Date.now();

    for (const key of cacheKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const age = now - (parsed.timestamp || 0);
        if (age > ASYNC_CACHE_MAX_AGE_MS) {
          await AsyncStorage.removeItem(key);
          removed++;
        }
      } catch {
        await AsyncStorage.removeItem(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(
        `[CacheCleanup] 🗑️ Removed ${removed} stale entries from AsyncStorage cache`
      );
    }
    return removed;
  } catch (error) {
    console.warn('[CacheCleanup] Error evicting AsyncStorage cache:', error);
    return 0;
  }
}

// ─── Limpieza de archivos temporales ──────────────────────────────────────────

async function cleanupTempFiles(): Promise<number> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return 0;

  let removed = 0;

  for (const subdir of TEMP_DIRS) {
    try {
      const dirPath = `${cacheDir}${subdir}`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      if (!dirInfo.exists) continue;

      const files = await FileSystem.readDirectoryAsync(dirPath);

      for (const file of files) {
        const isTempFile = TEMP_FILE_PREFIXES.some((p) => file.startsWith(p));
        if (!isTempFile) continue;

        try {
          const filePath = `${dirPath}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (!fileInfo.exists) continue;

          const fileInfoAny = fileInfo as Record<string, unknown>;
          const mtime = fileInfoAny.modificationTime;
          if (typeof mtime === 'number') {
            const age = Date.now() - mtime * 1000;
            if (age < TEMP_FILE_MAX_AGE_MS) continue;
          }

          await FileSystem.deleteAsync(filePath, { idempotent: true });
          removed++;
        } catch {}
      }
    } catch {}
  }

  if (removed > 0) {
    console.log(`[CacheCleanup] 🗑️ Removed ${removed} temp files`);
  }
  return removed;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export interface CleanupResult {
  mmkvRemoved: number;
  asyncRemoved: number;
  tempFilesRemoved: number;
  mmkvSizeBytes: number;
}

export async function performCleanup(): Promise<CleanupResult> {
  console.log('[CacheCleanup] 🔄 Starting cache cleanup...');

  const [mmkvResult, asyncRemoved, tempFilesRemoved] = await Promise.all([
    evictExpiredMmkvEntries(),
    evictStaleAsyncStorageCache(),
    cleanupTempFiles(),
  ]);

  const result: CleanupResult = {
    mmkvRemoved: mmkvResult.removed,
    asyncRemoved,
    tempFilesRemoved,
    mmkvSizeBytes: mmkvResult.totalSize,
  };

  const totalRemoved =
    result.mmkvRemoved + result.asyncRemoved + result.tempFilesRemoved;
  if (totalRemoved > 0) {
    console.log(
      `[CacheCleanup] ✅ Cleanup complete: ${totalRemoved} items removed` +
        (result.mmkvSizeBytes > 0
          ? ` (MMKV ~${(result.mmkvSizeBytes / 1024 / 1024).toFixed(1)}MB)`
          : '')
    );
  } else {
    console.log('[CacheCleanup] ✅ Cleanup complete: nothing to remove');
  }

  return result;
}

export async function getCacheStats(): Promise<{
  mmkvEntries: number;
  mmkvEstimatedSizeBytes: number;
  asyncCacheEntries: number;
}> {
  try {
    const storage = createMMKV();
    const allKeys = storage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(MMKV_CACHE_PREFIX));

    let estimatedSize = 0;
    for (const key of cacheKeys) {
      const raw = storage.getString(key);
      if (raw) estimatedSize += raw.length * 2;
    }

    const asyncAllKeys = await AsyncStorage.getAllKeys();
    const asyncCacheEntries = asyncAllKeys.filter((k) =>
      k.startsWith(ASYNC_CACHE_PREFIX)
    ).length;

    return {
      mmkvEntries: cacheKeys.length,
      mmkvEstimatedSizeBytes: estimatedSize,
      asyncCacheEntries,
    };
  } catch {
    return { mmkvEntries: 0, mmkvEstimatedSizeBytes: 0, asyncCacheEntries: 0 };
  }
}
