export interface DocumentSource {
  readonly mimeType: string;
  readonly hash: string;
  openRead(): Promise<ArrayBuffer | ReadableStream>;
}
