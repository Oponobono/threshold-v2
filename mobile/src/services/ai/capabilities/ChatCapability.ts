import { aiOrchestrator } from '../AIOrchestrator';
import { getSystemPrompt, detectDeckIntent, DECK_GENERATION_INSTRUCTIONS } from '../prompts/systemPrompts';

export interface ChatParams {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  subjectContext?: string;
  temperature?: number;
  onStreamToken?: (token: string) => void;
}

export interface ChatResult {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  deckAction?: { mode: string; count: number } | null;
}

class ChatCapability {
  async chat(params: ChatParams): Promise<ChatResult> {
    const includeDeckInstructions = detectDeckIntent(params.message);
    const systemPrompt = getSystemPrompt(includeDeckInstructions);
    if (includeDeckInstructions && !systemPrompt.includes('DECK_ACTION')) {
      systemPrompt + DECK_GENERATION_INSTRUCTIONS;
    }

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (params.subjectContext) {
      messages.push({ role: 'system', content: `Contexto académico: ${params.subjectContext}` });
    }

    if (params.history) {
      for (const msg of params.history) {
        messages.push(msg);
      }
    }

    messages.push({ role: 'user', content: params.message });

    const response = await aiOrchestrator.execute({
      messages,
      temperature: params.temperature ?? 0.7,
      maxTokens: 1024,
      stream: !!params.onStreamToken,
      onStreamToken: params.onStreamToken,
    });

    const deckAction = this._parseDeckAction(response.content);
    const cleanContent = deckAction
      ? response.content.replace(/%%DECK_ACTION%%\{.*?\}%%END%%/g, '').trim()
      : response.content;

    return {
      content: cleanContent,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      deckAction,
    };
  }

  private _parseDeckAction(content: string): { mode: string; count: number } | null {
    const match = content.match(/%%DECK_ACTION%%(\{.*?\})%%END%%/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}

export const chatCapability = new ChatCapability();
