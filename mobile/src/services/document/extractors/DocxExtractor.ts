import type { DocumentExtractor } from '../../../domain/document/DocumentExtractor';
import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type { ExtractedDocument } from '../../../domain/document/ExtractedDocument';
import type { TextBlock } from '../../../domain/document/types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

export class DocxExtractor implements DocumentExtractor {
  readonly id = 'docx-extractor';
  readonly version = 1;

  supports(source: DocumentSource): boolean {
    const mt = source.mimeType?.toLowerCase() || '';
    return mt === DOCX_MIME || mt === DOC_MIME;
  }

  async extractDocument(source: DocumentSource): Promise<ExtractedDocument> {
    const data = await source.openRead();
    const buffer = data instanceof ArrayBuffer ? data : await streamToArrayBuffer(data);

    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer as any });

    const text = result.value || '';
    const textBlocks: TextBlock[] = text
      ? [{ content: text, startIndex: 0, endIndex: text.length }]
      : [];

    return {
      textBlocks,
      images: [],
      tables: [],
      metadata: { format: 'docx' },
    };
  }
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
