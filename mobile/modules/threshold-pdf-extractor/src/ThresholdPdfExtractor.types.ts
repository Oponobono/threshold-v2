export interface ThresholdPdfExtractorModuleType {
  extractTextFromPdf(filePath: string): Promise<string>;
  audioToWav(audioPath: string): Promise<string>;
}
