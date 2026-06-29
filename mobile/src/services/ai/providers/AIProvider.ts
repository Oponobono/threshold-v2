export interface AIRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onStreamToken?: (token: string) => void;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  cached?: boolean;
}

export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  chat(req: AIRequest): Promise<AIResponse>;
}
