import type { DocumentExtractor } from '../../../domain/document/DocumentExtractor';
import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type { ExtractedDocument } from '../../../domain/document/ExtractedDocument';
import type { TextBlock, TableBlock } from '../../../domain/document/types';

export interface SpreadsheetSheet {
  readonly name: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface SpreadsheetMetadata {
  readonly format: 'xlsx' | 'csv';
  readonly sheetNames: readonly string[];
  readonly sheets: readonly SpreadsheetSheet[];
  readonly title?: string;
}

export class XlsxExtractor implements DocumentExtractor {
  readonly id = 'xlsx-extractor';
  readonly version = 1;

  supports(source: DocumentSource): boolean {
    const mt = source.mimeType?.toLowerCase() || '';
    return (
      mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mt === 'application/vnd.ms-excel.sheet.macroenabled.12' ||
      mt === 'application/vnd.ms-excel' ||
      mt === 'text/csv' ||
      mt === 'application/csv'
    );
  }

  async extractDocument(source: DocumentSource): Promise<ExtractedDocument> {
    const XLSX = await importXlsx();

    const data = await source.openRead();
    const buffer = data instanceof ArrayBuffer ? data : await streamToArrayBuffer(data);

    const workbook = XLSX.read(buffer, { type: 'array' });

    const sheets: SpreadsheetSheet[] = [];
    const tableBlocks: TableBlock[] = [];
    const textBlocks: TextBlock[] = [];
    let globalIndex = 0;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Convert sheet to array-of-arrays (values only, no formulas)
      const aoa: string[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false, // always get formatted string values
      });

      if (aoa.length === 0) continue;

      // Determine headers from the first non-empty row
      const headerRow = aoa[0]?.map(cell => String(cell ?? '')) ?? [];
      const dataRows = aoa.slice(1).map(row =>
        headerRow.map((_, colIdx) => String(row[colIdx] ?? '')),
      );

      const sheet: SpreadsheetSheet = {
        name: sheetName,
        headers: headerRow,
        rows: dataRows,
      };
      sheets.push(sheet);

      // TableBlock for domain consumers (AI, search, indexing)
      tableBlocks.push({ headers: headerRow, rows: dataRows });

      // TextBlocks: each row becomes a searchable text block
      for (const row of [headerRow, ...dataRows]) {
        const content = row.filter(Boolean).join(' | ');
        if (!content.trim()) continue;
        const start = globalIndex;
        const end = start + content.length;
        textBlocks.push({ content, startIndex: start, endIndex: end });
        globalIndex = end + 1;
      }
    }

    const meta: SpreadsheetMetadata = {
      format: source.mimeType === 'text/csv' || source.mimeType === 'application/csv' ? 'csv' : 'xlsx',
      sheetNames: workbook.SheetNames,
      sheets,
    };

    return {
      textBlocks,
      images: [],
      tables: tableBlocks,
      metadata: {
        format: meta.format,
        ...(meta as any), // carry full spreadsheet metadata through to the renderer
      },
    };
  }
}

// Lazy import to avoid loading SheetJS at module init time
async function importXlsx(): Promise<typeof import('xlsx')> {
  return require('xlsx');
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
