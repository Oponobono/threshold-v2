interface OCRResult {
  text: string;
  provider: string;
  confidence?: number;
}

class OCRCappability {
  async extractFromImage(imageUri: string): Promise<OCRResult> {
    try {
      const { extractTextFromImageLocal } = await import('../../localOCRService');
      const localResult = await extractTextFromImageLocal(imageUri);
      if (localResult && localResult.length > 10) {
        return { text: localResult, provider: 'mlkit', confidence: 0.9 };
      }
    } catch { /* fall through */ }

    try {
      const { fetchWithFallback } = await import('../../api/client');
      const formData = new FormData();
      formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'ocr.jpg' } as any);
      const response = await fetchWithFallback('/ocr', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        return { text: data.text || '', provider: 'cloud', confidence: 0.95 };
      }
    } catch { /* fall through */ }

    return { text: '', provider: 'none', confidence: 0 };
  }
}

export const ocrCapability = new OCRCappability();
