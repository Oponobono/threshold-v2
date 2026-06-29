interface PDFResult {
  text: string;
  provider: string;
  pageCount?: number;
}

class PDFCapability {
  async extract(pdfUri: string): Promise<PDFResult> {
    try {
      const { extractTextFromPdfLocal } = await import('../../localPDFService');
      const localResult = await extractTextFromPdfLocal(pdfUri);
      if (localResult && localResult.length > 20) {
        return { text: localResult, provider: 'native' };
      }
    } catch { /* fall through */ }

    try {
      const { fetchWithFallback } = await import('../../api/client');
      const formData = new FormData();
      formData.append('file', { uri: pdfUri, type: 'application/pdf', name: 'doc.pdf' } as any);
      const response = await fetchWithFallback('/pdf-extract', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        return { text: data.text || '', provider: 'cloud', pageCount: data.pages };
      }
    } catch { /* fall through */ }

    return { text: '', provider: 'none' };
  }
}

export const pdfCapability = new PDFCapability();
