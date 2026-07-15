export interface AssetInfo {
  readonly exists: boolean;
  readonly size?: number;
  readonly checksum?: string;
  readonly mimeType?: string;
}

export interface AssetService {
  store(sourceUri: string, filename: string): Promise<string>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  get(path: string): Promise<string>;
  hash(path: string): Promise<string>;
  info(path: string): Promise<AssetInfo>;
}
