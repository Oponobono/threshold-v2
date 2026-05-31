import { NativeModule, requireNativeModule } from 'expo';
import type { ThresholdPdfExtractorModuleType } from './ThresholdPdfExtractor.types';

declare class ThresholdPdfExtractorModule extends NativeModule<{}> {
  extractTextFromPdf(filePath: string): Promise<string>;
  audioToWav(audioPath: string): Promise<string>;
}

export default requireNativeModule<ThresholdPdfExtractorModule>('ThresholdPdfExtractor');
