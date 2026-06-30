export type AssetState =
  | 'LOCAL_ONLY'
  | 'QUEUED_UPLOAD'
  | 'TRANSFERRING'
  | 'SYNCED'
  | 'FAILED'
  | 'CORRUPTED'
  | 'DELETED';

export type TransferType = 'upload' | 'download';

export interface AssetMetadata {
  id: string;
  user_id: string;
  subject_id?: string;
  filename: string;
  mime_type?: string;
  file_size?: number;
  checksum?: string;
  cloud_url?: string;
  local_path?: string;
  asset_state: AssetState;
  transfer_type?: TransferType;
  transfer_progress?: number;
  last_error?: string;
  last_verified?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  sync_version?: number;
}

export interface AssetDownloadJob {
  assetId: string;
  entityType: 'photo' | 'audio-recording' | 'scanned-document';
  cloudUrl: string;
  localPath: string;
  expectedSize?: number;
  expectedChecksum?: string;
  priority: number;
  createdAt: number;
  retries: number;
}

export interface AssetUploadJob {
  assetId: string;
  entityType: 'photo' | 'audio-recording' | 'scanned-document';
  localPath: string;
  mimeType: string;
  filename: string;
  retries: number;
}

export const ASSET_PRIORITY = {
  VISIBLE: 10,
  RECENT: 5,
  SUBJECT: 3,
  BACKGROUND: 1,
} as const;

export const MAX_CONCURRENT_DOWNLOADS = 3;
export const MAX_CONCURRENT_UPLOADS = 2;
export const DOWNLOAD_RETRY_MAX = 5;
export const UPLOAD_RETRY_MAX = 5;
export const ASSET_CACHE_MAX_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB
