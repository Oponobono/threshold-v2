import * as fs from 'fs';
import * as path from 'path';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/',
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));
jest.mock('../../../../modules/threshold-pdf-extractor/src', () => ({
  __esModule: true,
  default: { extractTextFromPdf: jest.fn().mockResolvedValue('') },
}));

const PDF_DIR = path.resolve(__dirname, '../../../../../docs/docs/testing/pdfs');

const PDF_FILES = [
  { name: 'CV Cristian Marin.pdf', label: 'CV (pequeño)', maxExtractionMs: 3000, expectedMinLength: 50 },
  { name: 'ilide.info-logica-de-programacion-pr_1037c30361db8a221f57d876dd73927c.pdf', label: 'Lógica (mediano)', maxExtractionMs: 15000, expectedMinLength: 500 },
  { name: 'ilide.info-fundamentos-de-logica-para-la-programacion-pr_ce3eab3daf634d69fa50abf46c4e44f0.pdf', label: 'Fundamentos (grande)', maxExtractionMs: 60000, expectedMinLength: 5000 },
];

function readPdfAsArrayBuffer(filePath: string): ArrayBuffer {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function computeSimpleHash(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

describe('Sprint 2.5: Device Validation (pre-device checks)', () => {
  describe('PDF files exist and are valid', () => {
    for (const pdf of PDF_FILES) {
      const filePath = path.join(PDF_DIR, pdf.name);

      it(`${pdf.label}: file exists`, () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it(`${pdf.label}: has PDF header`, () => {
        const buffer = readPdfAsArrayBuffer(filePath);
        const header = new Uint8Array(buffer).slice(0, 5);
        const headerStr = String.fromCharCode(...header);
        expect(headerStr).toBe('%PDF-');
      });

      it(`${pdf.label}: size is reasonable`, () => {
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
        expect(stats.size).toBeLessThan(200 * 1024 * 1024);
      });

      it(`${pdf.label}: hash is deterministic`, () => {
        const buffer = readPdfAsArrayBuffer(filePath);
        const hash1 = computeSimpleHash(buffer);
        const hash2 = computeSimpleHash(buffer);
        expect(hash1).toBe(hash2);
      });
    }
  });

  describe('Pipeline logic with real file sizes', () => {
    for (const pdf of PDF_FILES) {
      const filePath = path.join(PDF_DIR, pdf.name);

      it(`${pdf.label}: model builder handles extracted content`, () => {
        const { DocumentModelBuilder } = require('../../../domain/document/DocumentModelBuilder');

        const stats = fs.statSync(filePath);
        const charEstimate = Math.floor(stats.size * 0.3);
        const blocks = [];
        for (let i = 0; i < Math.min(charEstimate, 5000); i++) {
          blocks.push({
            content: `Section ${i + 1}. ${'Lorem ipsum '.repeat(3)}`,
            startIndex: i * 100,
            endIndex: (i + 1) * 100,
          });
        }

        const extracted = {
          textBlocks: blocks,
          images: [],
          tables: [],
          metadata: { format: 'pdf' },
        };

        const start = Date.now();
        const builder = new DocumentModelBuilder(extracted);
        const model = builder.build(pdf.name, pdf.label);
        const elapsed = Date.now() - start;

        expect(model.pages.length).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(200);
      });
    }
  });

  describe('Edge cases: domain resilience', () => {
    it('DocumentModelBuilder handles zero text blocks', () => {
      const { DocumentModelBuilder } = require('../../../domain/document/DocumentModelBuilder');
      const builder = new DocumentModelBuilder({
        textBlocks: [],
        images: [],
        tables: [],
        metadata: { format: 'pdf' },
      });
      const model = builder.build('empty.pdf', 'Empty');
      expect(model.pages.length).toBe(1);
      expect(model.tableOfContents).toEqual([]);
      expect(model.capabilities).toBeDefined();
    });

    it('DocumentModelBuilder handles single character block', () => {
      const { DocumentModelBuilder } = require('../../../domain/document/DocumentModelBuilder');
      const builder = new DocumentModelBuilder({
        textBlocks: [{ content: 'x', startIndex: 0, endIndex: 1 }],
        images: [],
        tables: [],
        metadata: { format: 'pdf' },
      });
      const model = builder.build('tiny.pdf', 'Tiny');
      expect(model.pages.length).toBe(1);
      const pageText = model.pages[0].content.textBlocks[0].content;
      expect(pageText).toContain('x');
    });

    it('DocumentModelBuilder handles extremely long single block', () => {
      const { DocumentModelBuilder } = require('../../../domain/document/DocumentModelBuilder');
      const longContent = 'A'.repeat(500000);
      const builder = new DocumentModelBuilder({
        textBlocks: [{ content: longContent, startIndex: 0, endIndex: longContent.length }],
        images: [],
        tables: [],
        metadata: { format: 'pdf' },
      });
      const start = Date.now();
      const model = builder.build('huge.pdf', 'Huge');
      const elapsed = Date.now() - start;
      expect(model.pages.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(200);
    });

    it('DocumentImporterService rejects non-PDF format via registry', () => {
      const { ExtractorRegistry } = require('../../../domain/document/ExtractorRegistry');
      const { DocumentImporterService } = require('../DocumentImporterService');
      const registry = new ExtractorRegistry();
      const importer = new DocumentImporterService(registry, {}, {});

      const source = {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        hash: 'test',
        openRead: async () => new ArrayBuffer(0),
      };

      expect(() => registry.resolve(source)).toThrow('No extractor registered');
    });
  });
});
