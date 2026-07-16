import type { DocumentExtractor } from '../../../domain/document/DocumentExtractor';
import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type { ExtractedDocument } from '../../../domain/document/ExtractedDocument';

export class TextDocumentExtractor implements DocumentExtractor {
  readonly id = 'text-extractor';
  readonly version = 1;

  supports(source: DocumentSource): boolean {
    const mt = source.mimeType?.toLowerCase() || '';
    return mt === 'text/plain' || mt === 'application/json';
  }

  async extractDocument(source: DocumentSource): Promise<ExtractedDocument> {
    const data = await source.openRead();
    let text = '';
    
    if (typeof data === 'string') {
      text = data;
    } else {
      const buffer = data instanceof ArrayBuffer ? data : await streamToArrayBuffer(data);
      const decoder = new TextDecoder('utf-8');
      text = decoder.decode(buffer);
    }

    const isJson = source.mimeType === 'application/json';
    const textBlocks = [];

    if (isJson) {
      // JSON is a single block to prevent syntax highlighting issues when paginating
      let formattedText = text;
      try {
        const obj = JSON.parse(text);
        formattedText = JSON.stringify(obj, null, 2);
      } catch (e) {
        // Not a valid JSON or already formatted
      }
      textBlocks.push({ content: formattedText, startIndex: 0, endIndex: formattedText.length });
    } else {
      // TXT/MD: split by paragraphs (empty lines)
      const paragraphs = text.split(/\n\s*\n/);
      let currentIdx = 0;
      for (const p of paragraphs) {
        if (p.trim().length > 0) {
          const start = text.indexOf(p, currentIdx);
          const end = start + p.length;
          textBlocks.push({ content: p, startIndex: start, endIndex: end });
          currentIdx = end;
        }
      }
    }

    return {
      textBlocks,
      images: [],
      tables: [],
      metadata: { format: isJson ? 'json' : 'txt' },
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
