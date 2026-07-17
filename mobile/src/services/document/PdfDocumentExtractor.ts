import type { DocumentExtractor } from '../../domain/document/DocumentExtractor';
import type { DocumentSource } from '../../domain/document/DocumentSource';
import type { ExtractedDocument } from '../../domain/document/ExtractedDocument';
import * as FileSystem from 'expo-file-system/legacy';
import { getPdfText } from '../pdfTextProvider';

export class PdfDocumentExtractor implements DocumentExtractor {
  readonly id = 'pdf-extractor';
  readonly version = 1;

  supports(source: DocumentSource): boolean {
    return source.mimeType === 'application/pdf';
  }

  async extractDocument(source: DocumentSource): Promise<ExtractedDocument> {
    const data = await source.openRead();
    const buffer = data instanceof ArrayBuffer ? data : await streamToArrayBuffer(data);
    const text = await this.extractTextFromBuffer(buffer);

    const textBlocks = text
      ? [{ content: text, startIndex: 0, endIndex: text.length }]
      : [];

    return {
      textBlocks,
      images: [],
      tables: [],
      metadata: { format: 'pdf' },
    };
  }

  private async extractTextFromBuffer(buffer: ArrayBuffer): Promise<string> {
    try {
      const base64 = arrayBufferToBase64(buffer);
      const tempUri = `${FileSystem.cacheDirectory}pdf_extract_${Date.now()}.pdf`;

      await FileSystem.writeAsStringAsync(tempUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      try {
        const result = await getPdfText(tempUri);
        return result.text;
      } finally {
        FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
      }
    } catch {
      return '';
    }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function streamToArrayBuffer(stream: ReadableStream): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}
