import { type AIModelPreference } from '../../../store/useAISettingsStore';

export interface AIRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  provider?: string;
  modelPreference?: AIModelPreference;
  onStreamToken?: (token: string, accumulated?: string, reasoning?: string) => void;
}

export type AIDirective = {
  version: number;
  type: string;
  [key: string]: any;
};

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  cached?: boolean;
  directives?: AIDirective[];
}

export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  chat(req: AIRequest): Promise<AIResponse>;
}
