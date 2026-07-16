import type { DocumentExtractor } from '../../../domain/document/DocumentExtractor';
import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type { ExtractedDocument } from '../../../domain/document/ExtractedDocument';
import type { TextBlock } from '../../../domain/document/types';
import { OpenXmlArchive } from '../../../utils/OpenXmlArchive';

export interface PptxSlide {
  readonly index: number;
  readonly title?: string;
  readonly blocks: readonly string[];
  readonly notes?: string; // preparado para Fase 2 (notesSlide*.xml)
}

export interface PptxMetadata {
  readonly format: 'pptx';
  readonly slides: readonly PptxSlide[];
  readonly slideCount: number;
  readonly title?: string;
}

export class PptxExtractor implements DocumentExtractor {
  readonly id = 'pptx-extractor';
  readonly version = 2; // bumped: invalida la caché MMKV de extracciones previas

  supports(source: DocumentSource): boolean {
    const mt = source.mimeType?.toLowerCase() || '';
    return (
      mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mt === 'application/vnd.ms-powerpoint'
    );
  }

  async extractDocument(source: DocumentSource): Promise<ExtractedDocument> {
    const data = await source.openRead();
    const buffer = data instanceof ArrayBuffer ? data : await streamToArrayBuffer(data);

    const archive = new OpenXmlArchive();
    await archive.load(buffer);

    const textBlocks: TextBlock[] = [];
    const slides: PptxSlide[] = [];
    let globalIndex = 0;

    const slideFiles = archive.listFiles(/^ppt\/slides\/slide\d+\.xml$/);

    for (let i = 0; i < slideFiles.length; i++) {
      const slidePath = slideFiles[i];
      const slideXml = await archive.readText(slidePath);
      const slideBlocks: string[] = [];
      let slideTitle: string | undefined = undefined;

      // Usamos [^<]* (en lugar de .*?) para que la captura NO cruce etiquetas hermanas.
      // Esto evita que el resultado contenga fragmentos XML en lugar de texto puro.
      for (const text of extractTextNodes(slideXml)) {
        if (!text) continue;
        slideBlocks.push(text);
        if (!slideTitle && text.length > 2) slideTitle = text;

        const start = globalIndex;
        const end = start + text.length;
        textBlocks.push({ content: text, startIndex: start, endIndex: end });
        globalIndex = end + 1;
      }

      slides.push({
        index: i + 1,
        title: slideTitle || `Diapositiva ${i + 1}`,
        blocks: slideBlocks,
        notes: undefined,
      });
    }

    archive.destroy();

    const meta: PptxMetadata = {
      format: 'pptx',
      slides,
      slideCount: slides.length,
    };

    return {
      textBlocks,
      images: [],
      tables: [],
      metadata: { ...meta },
    };
  }
}

// ── Text extraction ───────────────────────────────────────────────────────────

/**
 * Extrae texto de los nodos <a:t> en un fragmento de XML de diapositiva OOXML.
 *
 * Regla de diseño: usa [^<]* (nunca .*?) para el contenido capturado.
 * Esto garantiza que la captura NO atraviesa etiquetas XML vecinas,
 * evitando que aparezca XML en bruto en los resultados.
 *
 * Limitación intencional: no interpreta posiciones, estilos, SmartArt,
 * tablas complejas ni animaciones. Solo responde: "¿qué texto hay aquí?"
 */
function extractTextNodes(xml: string): string[] {
  const results: string[] = [];
  // [^<]* ← solo captura caracteres que no son '<', garantizando texto plano
  const re = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml)) !== null) {
    const raw = match[1];
    if (!raw) continue;

    const decoded = decodeXmlEntities(raw).trim();
    if (decoded) results.push(decoded);
  }

  return results;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ── Stream helper ─────────────────────────────────────────────────────────────

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
