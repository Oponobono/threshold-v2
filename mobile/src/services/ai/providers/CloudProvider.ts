import { AIProvider, AIRequest, AIResponse } from './AIProvider';
import { fetchWithFallback } from '../../api/client';
import { extractDirectives } from '../core/ResponseInterpreter';

export class CloudProvider implements AIProvider {
  readonly name = 'cloud';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetchWithFallback('/ai/model-info', { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(req: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    const body: Record<string, any> = {
      messages: req.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: req.temperature ?? 0.7,
      maxTokens: req.maxTokens ?? 1024,
      provider: req.provider || 'groq',
    };

    if (req.stream) {
      body.stream = true;
    }

    const response = await fetchWithFallback(`/ai/chat-proxy?provider=${req.provider || 'groq'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Cloud AI error' }));
      const customError: any = new Error(err.error || `HTTP ${response.status}`);
      customError.details = err.details;
      throw customError;
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    
    const rawContent = data.response || data.content || '';
    const { cleanContent, directives } = extractDirectives(rawContent);

    return {
      content: cleanContent,
      provider: 'cloud',
      model: data.model || 'groq',
      latencyMs,
      ...(directives.length > 0 && { directives }),
    };
  }
}
