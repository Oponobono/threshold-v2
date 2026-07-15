import type { AssetService, AssetInfo } from '../../domain/document/AssetService';
import { persistentLocalAssetStore } from '../sync/asset/PersistentLocalAssetStore';

export class PersistentLocalAssetService implements AssetService {
  async store(sourceUri: string, filename: string): Promise<string> {
    const relativePath = `documents/${filename}`;
    return persistentLocalAssetStore.save(relativePath, sourceUri);
  }

  async delete(path: string): Promise<void> {
    const relativePath = this.toRelative(path);
    await persistentLocalAssetStore.delete(relativePath);
  }

  async exists(path: string): Promise<boolean> {
    const relativePath = this.toRelative(path);
    return persistentLocalAssetStore.exists(relativePath);
  }

  async get(path: string): Promise<string> {
    const relativePath = this.toRelative(path);
    return persistentLocalAssetStore.getPath(relativePath);
  }

  async hash(path: string): Promise<string> {
    const relativePath = this.toRelative(path);
    const md5 = await persistentLocalAssetStore.computeChecksum(relativePath);
    return md5 || '';
  }

  async info(path: string): Promise<AssetInfo> {
    const relativePath = this.toRelative(path);
    const exists = await persistentLocalAssetStore.exists(relativePath);
    if (!exists) return { exists: false };

    const size = await persistentLocalAssetStore.getSize(relativePath);
    const checksum = await persistentLocalAssetStore.computeChecksum(relativePath);
    return {
      exists: true,
      size,
      checksum: checksum || undefined,
    };
  }

  private toRelative(absolutePath: string): string {
    const marker = 'assets/';
    const idx = absolutePath.indexOf(marker);
    return idx >= 0 ? absolutePath.slice(idx + marker.length) : absolutePath;
  }
}
