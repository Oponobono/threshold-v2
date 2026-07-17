export interface DocumentSource {
  readonly mimeType: string;
  readonly hash: string;
  readonly uri?: string;
  openRead(): Promise<ArrayBuffer | ReadableStream>;
}
