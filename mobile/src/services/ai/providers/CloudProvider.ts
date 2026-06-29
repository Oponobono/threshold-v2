import { AIProvider, AIRequest, AIResponse } from './AIProvider';
import { fetchWithFallback } from '../../api/client';

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
    };

    if (req.stream) {
      body.stream = true;
    }

    const response = await fetchWithFallback('/ai/chat-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Cloud AI error' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    return {
      content: data.response || data.content || '',
      provider: 'cloud',
      model: data.model || 'groq',
      latencyMs,
    };
  }
}
