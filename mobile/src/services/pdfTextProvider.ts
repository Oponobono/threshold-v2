import * as FileSystem from 'expo-file-system/legacy';
import ThresholdPdfExtractor from '../../modules/threshold-pdf-extractor/src';
import { extractTextFromImageLocalFromUri } from './localOCRService';

const DEFAULT_DPI = 200;
const MAX_OCR_PAGES = 50;
const PAGE_CLEANUP_DELAY_MS = 100;

export interface PdfTextResult {
  text: string;
  source: 'native' | 'ocr' | 'none';
  pageCount?: number;
}

export async function getPdfText(pdfUri: string): Promise<PdfTextResult> {
  const nativeText = await ThresholdPdfExtractor.extractTextFromPdf(pdfUri);
  if (nativeText && nativeText.trim().length > 0) {
    return { text: nativeText, source: 'native' };
  }

  let pageUris: string[] = [];
  try {
    pageUris = await ThresholdPdfExtractor.renderPdfPages(pdfUri, DEFAULT_DPI);
  } catch {
    return { text: '', source: 'none' };
  }

  if (pageUris.length === 0) {
    return { text: '', source: 'none' };
  }

  const pagesToOcr = pageUris.slice(0, MAX_OCR_PAGES);
  const ocrResults: string[] = [];

  for (const pageUri of pagesToOcr) {
    try {
      const pageText = await extractTextFromImageLocalFromUri(pageUri);
      if (pageText && pageText.trim().length > 0) {
        ocrResults.push(pageText.trim());
      }
    } finally {
      scheduleCleanup(pageUri);
    }
  }

  if (pageUris.length > MAX_OCR_PAGES) {
    for (const uri of pageUris.slice(MAX_OCR_PAGES)) {
      scheduleCleanup(uri);
    }
  }

  const text = ocrResults.join('\n\n');
  return {
    text,
    source: text.length > 0 ? 'ocr' : 'none',
    pageCount: pageUris.length,
  };
}

function scheduleCleanup(uri: string) {
  setTimeout(() => {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, PAGE_CLEANUP_DELAY_MS);
}
