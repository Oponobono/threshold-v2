import { registerWebModule, NativeModule } from 'expo';

class ThresholdPdfExtractorModule extends NativeModule<{}> {
  async extractTextFromPdf(filePath: string): Promise<string> {
    throw new Error('PDF extraction is not available on web.');
  }

  async renderPdfPages(filePath: string, dpi?: number): Promise<string[]> {
    throw new Error('PDF rendering is not available on web.');
  }

  async audioToWav(audioPath: string): Promise<string> {
    throw new Error('Audio conversion is not available on web.');
  }
}

export default registerWebModule(ThresholdPdfExtractorModule, 'ThresholdPdfExtractorModule');
