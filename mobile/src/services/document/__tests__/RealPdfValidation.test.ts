import * as fs from 'fs';
import * as path from 'path';

const PDF_DIR = path.resolve(__dirname, '../../../../../docs/docs/testing/pdfs');

const PDF_FILES = [
  { name: 'CV Cristian Marin.pdf', label: 'CV (pequeño)' },
  { name: 'ilide.info-logica-de-programacion-pr_1037c30361db8a221f57d876dd73927c.pdf', label: 'Lógica (mediano)' },
  { name: 'ilide.info-fundamentos-de-logica-para-la-programacion-pr_ce3eab3daf634d69fa50abf46c4e44f0.pdf', label: 'Fundamentos (grande)' },
];

function readPdfAsArrayBuffer(filePath: string): ArrayBuffer {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function computeHash(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

describe('Validation: real PDFs (Node.js)', () => {
  for (const pdf of PDF_FILES) {
    const filePath = path.join(PDF_DIR, pdf.name);

    describe(`${pdf.label}: ${pdf.name}`, () => {
      it('file exists and is readable', () => {
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
      });

      it('can be read as ArrayBuffer', () => {
        const buffer = readPdfAsArrayBuffer(filePath);
        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(buffer.byteLength).toBeGreaterThan(0);
      });

      it('has PDF magic bytes', () => {
        const buffer = readPdfAsArrayBuffer(filePath);
        const bytes = new Uint8Array(buffer);
        const header = String.fromCharCode(...bytes.slice(0, 5));
        expect(header).toBe('%PDF-');
      });

      it('hash is deterministic', () => {
        const buffer1 = readPdfAsArrayBuffer(filePath);
        const buffer2 = readPdfAsArrayBuffer(filePath);
        expect(computeHash(buffer1)).toBe(computeHash(buffer2));
      });

      it('different files have different hashes', () => {
        const buffer = readPdfAsArrayBuffer(filePath);
        const hash = computeHash(buffer);
        const otherPdfs = PDF_FILES.filter(f => f.name !== pdf.name);
        for (const other of otherPdfs) {
          const otherBuffer = readPdfAsArrayBuffer(path.join(PDF_DIR, other.name));
          const otherHash = computeHash(otherBuffer);
          expect(hash).not.toBe(otherHash);
        }
      });
    });
  }

  describe('pipeline integration: DocumentModelBuilder with real content', () => {
    it('builds model from extracted text blocks', () => {
      const { DocumentModelBuilder } = require('../../../domain/document/DocumentModelBuilder');
      const { DocumentCapabilities } = require('../../../domain/document/DocumentCapabilities');
      const { DocumentAction } = require('../../../domain/document/DocumentAction');

      const extracted = {
        textBlocks: [
          { content: '1. Introducción\nEste documento cubre los fundamentos.', startIndex: 0, endIndex: 50 },
          { content: '2. Desarrollo\nAquí se explican los conceptos.', startIndex: 50, endIndex: 95 },
        ],
        images: [{ id: 'img-1', mimeType: 'image/png', width: 800, height: 600 }],
        tables: [{ headers: ['Concepto', 'Definición'], rows: [['Variable', 'Almacena datos']] }],
        metadata: { format: 'pdf', title: 'Test', pageCount: 2 },
      };

      const builder = new DocumentModelBuilder(extracted);
      const model = builder.build('test-1', 'Documento de Prueba');

      expect(model.documentId).toBe('test-1');
      expect(model.title).toBe('Documento de Prueba');
      expect(model.pages.length).toBeGreaterThanOrEqual(1);
      expect(model.tableOfContents.length).toBe(2);
      expect(model.tableOfContents[0].title).toBe('1. Introducción');
      expect(model.capabilities.supports(DocumentAction.Search)).toBe(true);
      expect(model.capabilities.supports(DocumentAction.AskAI)).toBe(true);
    });

    it('handles large content (simulating 300-page PDF)', () => {
      const { DocumentModelBuilder } = require('../../../domain/document/DocumentModelBuilder');

      const blocks = [];
      for (let i = 0; i < 1000; i++) {
        blocks.push({
          content: `Section ${i + 1}. ${'Lorem ipsum dolor sit amet. '.repeat(5)}`,
          startIndex: i * 200,
          endIndex: (i + 1) * 200,
        });
      }

      const extracted = {
        textBlocks: blocks,
        images: [],
        tables: [],
        metadata: { format: 'pdf', pageCount: 300 },
      };

      const start = Date.now();
      const builder = new DocumentModelBuilder(extracted);
      const model = builder.build('test-large', 'Documento Grande');
      const elapsed = Date.now() - start;

      expect(model.pages.length).toBeGreaterThan(10);
      expect(elapsed).toBeLessThan(100);
    });
  });
});
