import { syncService } from '../../database/SyncService';
import { persistentLocalAssetStore } from './PersistentLocalAssetStore';
import { UPLOAD_RETRY_MAX, MAX_CONCURRENT_UPLOADS } from './types';
import { syncDebugger } from '../SyncDebugger';
import { fetchWithFallback } from '../../api/client';

interface PendingUpload {
  entityType: string;
  assetId: string;
  localPath: string;
  mimeType: string;
  filename: string;
  retries: number;
}

export class AssetUploadManager {
  private queue: PendingUpload[] = [];
  private active = 0;
  private processing = false;

  get queueLength(): number { return this.queue.length; }
  get activeCount(): number { return this.active; }

  enqueue(entityType: string, assetId: string, localPath: string, mimeType: string, filename: string): void {
    this.queue.push({ entityType, assetId, localPath, mimeType, filename, retries: 0 });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.active < MAX_CONCURRENT_UPLOADS) {
      const job = this.queue.shift()!;
      this.active++;
      this.upload(job).finally(() => {
        this.active--;
        this.processQueue();
      });
    }

    this.processing = false;
  }

  private async upload(job: PendingUpload): Promise<void> {
    const traceId = `upload_${job.assetId}`;
    try {
      syncDebugger.log(traceId, null, null, 'UPLOAD_START', `Uploading ${job.entityType}/${job.assetId}`, undefined, job.entityType, job.assetId);

      const formData = new FormData();
      formData.append('file', {
        uri: job.localPath,
        name: job.filename,
        type: job.mimeType,
      } as any);

      const response = await fetchWithFallback(`/upload/${job.entityType}`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!response.ok) throw new Error(`Upload failed: HTTP ${response.status}`);

      const result = await response.json();
      // The upload endpoint returns { url, id } — update the metadata record
      await syncService.enqueueUpdate(job.entityType, job.assetId, {
        cloud_url: result.url,
        checksum: result.checksum,
        asset_state: 'SYNCED',
      });

      syncDebugger.log(traceId, null, null, 'UPLOAD_FINISH', `Uploaded ${job.entityType}/${job.assetId}`, { url: result.url }, job.entityType, job.assetId);
    } catch (error: any) {
      job.retries++;
      syncDebugger.logError(traceId, null, 'UPLOAD_FAILED', `Upload failed for ${job.entityType}/${job.assetId}`, error, job.entityType, job.assetId);

      if (job.retries < UPLOAD_RETRY_MAX) {
        this.queue.push(job);
        setTimeout(() => this.processQueue(), Math.min(1000 * Math.pow(2, job.retries), 30000));
      } else {
        await syncService.enqueueUpdate(job.entityType, job.assetId, {
          asset_state: 'FAILED',
          last_error: error.message,
        });
      }
    }
  }
}
