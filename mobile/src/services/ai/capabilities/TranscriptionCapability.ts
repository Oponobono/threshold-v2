interface TranscriptionResult {
  text: string;
  provider: string;
  segments?: { start: number; end: number; text: string }[];
}

class TranscriptionCapability {
  async transcribe(audioUri: string): Promise<TranscriptionResult> {
    try {
      const { transcribeWithFallback } = await import('../../../utils/groqHelpers');
      const localResult = await transcribeWithFallback(audioUri);
      if (localResult && localResult.length > 10) {
        return { text: localResult, provider: 'whisper_local' };
      }
    } catch { /* fall through */ }

    try {
      const { transcribeWithWhisper } = await import('../../../utils/groqHelpers');
      const apiKey = '';
      const cloudResult = await transcribeWithWhisper(audioUri, apiKey);
      if (cloudResult) {
        return { text: cloudResult, provider: 'whisper_cloud' };
      }
    } catch { /* fall through */ }

    return { text: '', provider: 'none' };
  }
}

export const transcriptionCapability = new TranscriptionCapability();
