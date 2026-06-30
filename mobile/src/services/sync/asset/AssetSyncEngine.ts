import { AssetUploadManager } from './AssetUploadManager';
import { AssetDownloadManager } from './AssetDownloadManager';
import { AssetDownloadJob, AssetState } from './types';
import { persistentLocalAssetStore, PersistentLocalAssetStore } from './PersistentLocalAssetStore';
import { syncDebugger } from '../SyncDebugger';

export class AssetSyncEngine {
  readonly uploader = new AssetUploadManager();
  readonly downloader = new AssetDownloadManager();

  /** Called after initial/delta sync metadata is saved to SQLite.
   *  Schedules downloads for assets that have cloud_url but no local file. */
  async schedulePendingDownloads(entityType: string, items: any[]): Promise<void> {
    const now = Date.now();
    for (const item of items) {
      if (!item.cloud_url) continue;
      if (item.asset_state === 'SYNCED' || item.asset_state === 'LOCAL_ONLY') continue;

      const localPath = PersistentLocalAssetStore.makePath(entityType, item.id, item.filename || 'file.bin');

      const job: AssetDownloadJob = {
        assetId: item.id,
        entityType: entityType as any,
        cloudUrl: item.cloud_url,
        localPath,
        expectedSize: item.file_size,
        expectedChecksum: item.checksum,
        priority: 1, // background by default
        createdAt: now,
        retries: 0,
      };

      this.downloader.enqueue(job);
    }
  }

  /** Called when an asset is viewed — escalates download priority */
  requestPriorityDownload(entityType: string, assetId: string, cloudUrl: string, filename: string, fileSize?: number, checksum?: string): void {
    const localPath = PersistentLocalAssetStore.makePath(entityType, assetId, filename || 'file.bin');
    this.downloader.enqueue({
      assetId,
      entityType: entityType as any,
      cloudUrl,
      localPath,
      expectedSize: fileSize,
      expectedChecksum: checksum,
      priority: 10, // visible = highest priority
      createdAt: Date.now(),
      retries: 0,
    });
  }

  /** Called after creating a new local asset */
  async scheduleUpload(entityType: string, assetId: string, localPath: string, mimeType: string, filename: string): Promise<void> {
    this.uploader.enqueue(entityType, assetId, localPath, mimeType, filename);
  }

  async enforceCacheLimit(): Promise<number> {
    return persistentLocalAssetStore.enforceCacheLimit();
  }

  /** Get the local path for an asset, downloading if needed */
  async getLocalPath(entityType: string, assetId: string, cloudUrl: string, filename: string, fileSize?: number, checksum?: string): Promise<string | null> {
    const localPath = PersistentLocalAssetStore.makePath(entityType, assetId, filename || 'file.bin');
    const exists = await persistentLocalAssetStore.exists(localPath);
    if (exists) {
      return persistentLocalAssetStore.getPath(localPath);
    }
    // Not available locally — trigger priority download
    this.requestPriorityDownload(entityType, assetId, cloudUrl, filename, fileSize, checksum);
    return null;
  }
}

export const assetSyncEngine = new AssetSyncEngine();
