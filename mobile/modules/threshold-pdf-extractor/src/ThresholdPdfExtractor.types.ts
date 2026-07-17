export interface ThresholdPdfExtractorModuleType {
  extractTextFromPdf(filePath: string): Promise<string>;
  renderPdfPages(filePath: string, dpi?: number): Promise<string[]>;
  audioToWav(audioPath: string): Promise<string>;
}
