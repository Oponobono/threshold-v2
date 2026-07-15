/**
 * Sprint 2.5 — Device Validation
 *
 * Ejecutar en dispositivo/emulator. Mide el pipeline completo con PDFs reales.
 *
 * Usage:
 *   import { runDeviceValidation } from './validation';
 *   const report = await runDeviceValidation();
 *   console.log(JSON.stringify(report, null, 2));
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import ThresholdPdfExtractor from '../../../modules/threshold-pdf-extractor/src';
import { DocumentModelBuilder } from '../../domain/document/DocumentModelBuilder';

// ─── Types ──────────────────────────────────────────────────────────

interface PdfValidationResult {
  file: string;
  sizeBytes: number;
  sizeMB: number;
  exists: boolean;
  // Extraction
  extractionMs: number;
  textLength: number;
  firstChars: string;
  lastChars: string;
  hasUnicode: boolean;
  lineBreakCount: number;
  // Model
  modelBuildMs: number;
  modelPages: number;
  modelTocEntries: number;
  // Memory
  heapBeforeMB: number;
  heapAfterMB: number;
  heapDeltaMB: number;
  // Status
  success: boolean;
  error?: string;
  warnings: string[];
}

interface DeviceValidationReport {
  platform: string;
  timestamp: string;
  results: PdfValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgExtractionMs: number;
    maxHeapDeltaMB: number;
  };
}

// ─── PDFs de prueba ──────────────────────────────────────────────────

const PDF_TEST_FILES = [
  {
    name: 'CV Cristian Marin.pdf',
    label: 'CV (pequeño)',
    maxExtractionMs: 3000,
    expectedMinLength: 50,
  },
  {
    name: 'ilide.info-logica-de-programacion-pr_1037c30361db8a221f57d876dd73927c.pdf',
    label: 'Lógica (mediano)',
    maxExtractionMs: 15000,
    expectedMinLength: 500,
  },
  {
    name: 'ilide.info-fundamentos-de-logica-para-la-programacion-pr_ce3eab3daf634d69fa50abf46c4e44f0.pdf',
    label: 'Fundamentos (grande)',
    maxExtractionMs: 60000,
    expectedMinLength: 5000,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function getHeapMB(): number {
  if (global.performance && (performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
  }
  return 0;
}

function detectWarnings(text: string, extractionMs: number, config: typeof PDF_TEST_FILES[0]): string[] {
  const warnings: string[] = [];

  if (extractionMs > config.maxExtractionMs) {
    warnings.push(`Extraction exceeded ${config.maxExtractionMs}ms target (${extractionMs}ms)`);
  }
  if (text.length < config.expectedMinLength) {
    warnings.push(`Text too short: ${text.length} chars (expected >= ${config.expectedMinLength})`);
  }
  if (text.includes('\uFFFD')) {
    warnings.push('Replacement character (U+FFFD) detected — encoding issue');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    warnings.push('Control characters detected in extracted text');
  }
  if (text.length > 0 && text.trim().length === 0) {
    warnings.push('Extracted text is all whitespace');
  }

  return warnings;
}

// ─── Main ────────────────────────────────────────────────────────────

export async function runDeviceValidation(): Promise<DeviceValidationReport> {
  const results: PdfValidationResult[] = [];

  for (const config of PDF_TEST_FILES) {
    const filePath = `${FileSystem.documentDirectory}../../../../docs/docs/testing/pdfs/${config.name}`;
    const result: PdfValidationResult = {
      file: config.name,
      sizeBytes: 0,
      sizeMB: 0,
      exists: false,
      extractionMs: 0,
      textLength: 0,
      firstChars: '',
      lastChars: '',
      hasUnicode: false,
      lineBreakCount: 0,
      modelBuildMs: 0,
      modelPages: 0,
      modelTocEntries: 0,
      heapBeforeMB: 0,
      heapAfterMB: 0,
      heapDeltaMB: 0,
      success: false,
      warnings: [],
    };

    try {
      // File check
      const info = await FileSystem.getInfoAsync(filePath);
      if (!info.exists || !('size' in info)) {
        result.error = 'File not found or not readable';
        results.push(result);
        continue;
      }
      result.exists = true;
      result.sizeBytes = (info as any).size || 0;
      result.sizeMB = result.sizeBytes / (1024 * 1024);

      // Memory before
      result.heapBeforeMB = getHeapMB();

      // Extract
      const extractStart = Date.now();
      const text = await ThresholdPdfExtractor.extractTextFromPdf(filePath);
      result.extractionMs = Date.now() - extractStart;
      result.textLength = (text || '').length;

      // Memory after extraction
      result.heapAfterMB = getHeapMB();
      result.heapDeltaMB = result.heapAfterMB - result.heapBeforeMB;

      // Text analysis
      if (text) {
        result.firstChars = text.slice(0, 100);
        result.lastChars = text.slice(-100);
        result.hasUnicode = /[^\x00-\x7F]/.test(text);
        result.lineBreakCount = (text.match(/\n/g) || []).length;
      }

      // Model build
      const blocks = text
        ? [{ content: text, startIndex: 0, endIndex: text.length }]
        : [];
      const extracted = {
        textBlocks: blocks,
        images: [],
        tables: [],
        metadata: { format: 'pdf' },
      };

      const buildStart = Date.now();
      const builder = new DocumentModelBuilder(extracted);
      const model = builder.build(config.name, config.name);
      result.modelBuildMs = Date.now() - buildStart;
      result.modelPages = model.pages.length;
      result.modelTocEntries = model.tableOfContents.length;

      // Warnings
      result.warnings = detectWarnings(text || '', result.extractionMs, config);

      result.success = true;
    } catch (e: any) {
      result.error = e.message || String(e);
    }

    results.push(result);
  }

  // Summary
  const passed = results.filter(r => r.success && r.warnings.length === 0).length;
  const failed = results.length - passed;
  const extractionTimes = results.filter(r => r.success).map(r => r.extractionMs);
  const avgExtractionMs = extractionTimes.length > 0
    ? extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length
    : 0;
  const maxHeapDelta = Math.max(...results.map(r => r.heapDeltaMB), 0);

  return {
    platform: Platform.OS,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      avgExtractionMs: Math.round(avgExtractionMs),
      maxHeapDeltaMB: Math.round(maxHeapDelta * 100) / 100,
    },
  };
}
