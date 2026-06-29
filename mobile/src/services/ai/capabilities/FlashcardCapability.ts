import { aiOrchestrator } from '../AIOrchestrator';

export interface FlashcardGenParams {
  text: string;
  count?: number;
  mode?: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';
  temperature?: number;
}

export interface GeneratedCard {
  front: string;
  back: string;
  direction?: 'forward' | 'backward' | 'bidirectional';
  source_context?: string;
}

class FlashcardCapability {
  async generate(params: FlashcardGenParams): Promise<GeneratedCard[]> {
    const mode = params.mode || 'flashcard';
    const count = params.count || 10;

    const systemPrompt = `Eres un generador de flashcards académicas. 
Genera exactamente ${count} tarjetas de estudio en formato "${mode}" sobre el texto proporcionado.

REGLAS:
- Cada tarjeta debe tener un "front" (pregunta/concepto) y un "back" (respuesta/definición).
- Los campos "direction" indica si la tarjeta es "forward", "backward" o "bidirectional".
- El campo "source_context" debe contener la frase exacta del texto original que inspiró la tarjeta.
- Responde SOLO con un array JSON válido. Nada más.

Formato:
[
  {
    "front": "¿Qué es X?",
    "back": "X es...",
    "direction": "forward",
    "source_context": "Frase del texto original..."
  }
]`;

    const response = await aiOrchestrator.execute({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: params.text },
      ],
      temperature: params.temperature ?? 0.3,
      maxTokens: 4096,
    });

    return this._parseCards(response.content);
  }

  private _parseCards(content: string): GeneratedCard[] {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }
}

export const flashcardCapability = new FlashcardCapability();
