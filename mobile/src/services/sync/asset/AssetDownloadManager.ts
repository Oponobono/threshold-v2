import * as FileSystem from 'expo-file-system/legacy';
import { persistentLocalAssetStore } from './PersistentLocalAssetStore';
import { AssetDownloadJob, ASSET_PRIORITY, MAX_CONCURRENT_DOWNLOADS, DOWNLOAD_RETRY_MAX } from './types';
import { syncDebugger } from '../SyncDebugger';

export class AssetDownloadManager {
  private queue: AssetDownloadJob[] = [];
  private active = 0;
  private processing = false;

  get queueLength(): number { return this.queue.length; }
  get activeCount(): number { return this.active; }

  enqueue(job: AssetDownloadJob): void {
    const existing = this.queue.find(j => j.assetId === job.assetId);
    if (existing) {
      existing.priority = Math.max(existing.priority, job.priority);
      return;
    }
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.active < MAX_CONCURRENT_DOWNLOADS) {
      const job = this.queue.shift()!;
      this.active++;
      this.download(job).finally(() => {
        this.active--;
        this.processQueue();
      });
    }

    this.processing = false;
  }

  private async download(job: AssetDownloadJob): Promise<void> {
    const traceId = `dl_${job.assetId}`;
    try {
      syncDebugger.log(traceId, null, null, 'DOWNLOAD_START', `Downloading ${job.entityType}/${job.assetId}`, undefined, job.entityType, job.assetId);

      // Check if file already exists and is complete
      const exists = await persistentLocalAssetStore.exists(job.localPath);
      if (exists) {
        const localSize = await persistentLocalAssetStore.getSize(job.localPath);
        if (!job.expectedSize || localSize >= job.expectedSize) {
          // Verify checksum if available
          if (job.expectedChecksum) {
            const localChecksum = await persistentLocalAssetStore.computeChecksum(job.localPath);
            if (localChecksum === job.expectedChecksum) {
              syncDebugger.log(traceId, null, null, 'CHECKSUM_OK', `Asset ${job.assetId} checksum verified`, undefined, job.entityType, job.assetId);
              return;
            }
            // Checksum mismatch — delete and redownload
            syncDebugger.log(traceId, null, null, 'CHECKSUM_FAILED', `Asset ${job.assetId} checksum mismatch, re-downloading`, undefined, job.entityType, job.assetId);
            await persistentLocalAssetStore.delete(job.localPath);
          } else {
            return; // No checksum to verify, assume OK
          }
        }
        // Incomplete file — delete and redownload
        await persistentLocalAssetStore.delete(job.localPath);
      }

      // Download using expo-file-system
      const destPath = persistentLocalAssetStore.getPath(job.localPath);
      const downloadResumable = FileSystem.createDownloadResumable(
        job.cloudUrl,
        destPath,
        {},
        (progress) => {
          const pct = progress.totalBytesExpectedToWrite > 0
            ? Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100)
            : 0;
          // Notify progress — could be used by an event
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result) throw new Error('Download returned no result');

      // Verify checksum after download
      if (job.expectedChecksum) {
        const checksum = await persistentLocalAssetStore.computeChecksum(job.localPath);
        if (checksum !== job.expectedChecksum) {
          await persistentLocalAssetStore.delete(job.localPath);
          throw new Error(`Checksum mismatch: expected ${job.expectedChecksum}, got ${checksum}`);
        }
        syncDebugger.log(traceId, null, null, 'CHECKSUM_OK', `Asset ${job.assetId} checksum verified after download`, undefined, job.entityType, job.assetId);
      }

      syncDebugger.log(traceId, null, null, 'DOWNLOAD_FINISH', `Downloaded ${job.entityType}/${job.assetId}`, undefined, job.entityType, job.assetId);
    } catch (error: any) {
      job.retries++;
      syncDebugger.logError(traceId, null, 'DOWNLOAD_FAILED', `Download failed for ${job.entityType}/${job.assetId}`, error, job.entityType, job.assetId);

      if (job.retries < DOWNLOAD_RETRY_MAX) {
        this.queue.push(job);
        setTimeout(() => this.processQueue(), Math.min(1000 * Math.pow(2, job.retries), 30000));
      }
    }
  }
}
