import { aiOrchestrator } from '../AIOrchestrator';
import { getSystemPrompt } from '../prompts/systemPrompts';
import { AIDirective } from '../providers/AIProvider';

export interface ChatParams {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  subjectContext?: string;
  temperature?: number;
  provider?: string;
  onStreamToken?: (token: string) => void;
}

export interface ChatResult {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  directives?: AIDirective[];
}

class ChatCapability {
  async chat(params: ChatParams): Promise<ChatResult> {
    const systemPrompt = getSystemPrompt(false);

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
      provider: params.provider,
      onStreamToken: params.onStreamToken,
    });

    return {
      content: response.content,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      ...(response.directives && { directives: response.directives }),
    };
  }
}

export const chatCapability = new ChatCapability();
