import * as FileSystem from 'expo-file-system/legacy';
import type { DocumentSource } from '../../domain/document/DocumentSource';

export class AssetDocumentSource implements DocumentSource {
  readonly mimeType: string;
  readonly hash: string;
  readonly uri: string;
  private readonly _path: string;

  private constructor(path: string, mimeType: string, hash: string) {
    this._path = path;
    this.uri = path;
    this.mimeType = mimeType;
    this.hash = hash;
  }

  static async fromFile(uri: string, mimeType: string): Promise<AssetDocumentSource> {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error(`File does not exist: ${uri}`);
    }
    const hash = await computeFileHash(uri);
    return new AssetDocumentSource(uri, mimeType, hash);
  }

  static fromPath(path: string, mimeType: string, hash: string): AssetDocumentSource {
    return new AssetDocumentSource(path, mimeType, hash);
  }

  async openRead(): Promise<ArrayBuffer> {
    const base64 = await FileSystem.readAsStringAsync(this._path, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToArrayBuffer(base64);
  }

  get path(): string {
    return this._path;
  }
}

async function computeFileHash(uri: string): Promise<string> {
  try {
    const result = await FileSystem.getInfoAsync(uri, { md5: true });
    if (result.exists && 'md5' in result) {
      return (result as any).md5 || '';
    }
  } catch {}
  return '';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
