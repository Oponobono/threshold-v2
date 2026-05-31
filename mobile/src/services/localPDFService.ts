import * as FileSystem from 'expo-file-system/legacy';
import ThresholdPdfExtractor from '../../modules/threshold-pdf-extractor/src';

const TEMP_PREFIX = 'threshold_pdf_';

export async function extractTextFromPdfLocal(base64Pdf: string): Promise<string> {
  const tempUri = `${FileSystem.cacheDirectory}${TEMP_PREFIX}${Date.now()}.pdf`;

  await FileSystem.writeAsStringAsync(tempUri, base64Pdf, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    const text = await ThresholdPdfExtractor.extractTextFromPdf(tempUri);
    return text || '';
  } finally {
    FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
  }
}

export async function extractTextFromPdfLocalFromUri(pdfUri: string): Promise<string> {
  const text = await ThresholdPdfExtractor.extractTextFromPdf(pdfUri);
  return text || '';
}
