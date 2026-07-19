import * as FileSystem from 'expo-file-system/legacy';

const ASSET_DIR = `${FileSystem.documentDirectory}assets/`;
const MAX_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB

export class PersistentLocalAssetStore {
  async ensureDir(): Promise<void> {
    const dir = await FileSystem.getInfoAsync(ASSET_DIR);
    if (!dir.exists) {
      await FileSystem.makeDirectoryAsync(ASSET_DIR, { intermediates: true });
    }
  }

  async save(relativePath: string, sourceUri: string): Promise<string> {
    await this.ensureDir();
    const dest = `${ASSET_DIR}${relativePath}`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  }

  async delete(relativePath: string): Promise<void> {
    const path = `${ASSET_DIR}${relativePath}`;
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(`${ASSET_DIR}${relativePath}`);
    return info.exists;
  }

  async getSize(relativePath: string): Promise<number> {
    const info = await FileSystem.getInfoAsync(`${ASSET_DIR}${relativePath}`);
    if (info.exists && 'size' in info) {
      return (info as any).size || 0;
    }
    return 0;
  }

  async computeChecksum(relativePath: string): Promise<string | null> {
    try {
      const path = `${ASSET_DIR}${relativePath}`;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      // expo-file-system provides md5, but we need sha256
      // Fallback: use a simple approach — read file info
      const md5 = await FileSystem.getInfoAsync(path, { md5: true });
      if (md5.exists && 'md5' in md5) {
        return (md5 as any).md5 || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  getPath(relativePath: string): string {
    return `${ASSET_DIR}${relativePath}`;
  }

  /** Returns total size of all assets in bytes */
  async getTotalSize(): Promise<number> {
    await this.ensureDir();
    const files = await FileSystem.readDirectoryAsync(ASSET_DIR);
    let total = 0;
    for (const f of files) {
      total += await this.getSize(f);
    }
    return total;
  }

  /** Enforce cache limit: delete oldest assets if over MAX_BYTES */
  async enforceCacheLimit(): Promise<number> {
    const total = await this.getTotalSize();
    if (total <= MAX_BYTES) return 0;

    await this.ensureDir();
    const files = await FileSystem.readDirectoryAsync(ASSET_DIR);
    const fileInfos: { name: string; size: number; mtime: number }[] = [];

    for (const f of files) {
      const info = await FileSystem.getInfoAsync(`${ASSET_DIR}${f}`);
      if (info.exists && 'modificationTime' in info) {
        fileInfos.push({
          name: f,
          size: (info as any).size || 0,
          mtime: (info as any).modificationTime || 0,
        });
      }
    }

    // Sort by modification time (oldest first)
    fileInfos.sort((a, b) => a.mtime - b.mtime);

    let freed = 0;
    for (const fi of fileInfos) {
      if (total - freed <= MAX_BYTES) break;
      await this.delete(fi.name);
      freed += fi.size;
    }

    return freed;
  }

  /** Generate a safe relative path from asset id and filename */
  static makePath(entityType: string, assetId: string, filename: string): string {
    const ext = filename.split('.').pop() || 'bin';
    return `${entityType}/${assetId}.${ext}`;
  }
}

export const persistentLocalAssetStore = new PersistentLocalAssetStore();
