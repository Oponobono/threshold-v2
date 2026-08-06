import { resolveIntent, ConversationIntent } from '../ConversationIntentResolver';

function intent(msg: string, history: { role: 'user' | 'assistant'; content: string }[] = []): ConversationIntent {
  return resolveIntent(msg, history);
}

describe('ConversationIntentResolver', () => {
  describe('Intención directa de generación de mazo', () => {
    it('detecta "podrias crear un mazo sobre..." (mensaje que originó el bug)', () => {
      const result = intent('podrias crear un mazo sobre los aspectos fundamentales del proyecto integrador?');
      expect(result.type).toBe('generate_deck');
    });

    it('detecta "podrías generar flashcards" con acento', () => {
      const result = intent('¿podrías generar flashcards de biología?');
      expect(result.type).toBe('generate_deck');
    });

    it('detecta "puedes crear un mazo de repaso"', () => {
      const result = intent('puedes crear un mazo de repaso para el parcial?');
      expect(result.type).toBe('generate_deck');
    });

    it('detecta "me puedes preparar un examen de opción múltiple" e infiere el modo', () => {
      const result = intent('me puedes preparar un examen de opción múltiple?');
      expect(result.type).toBe('generate_deck');
      if (result.type === 'generate_deck') {
        expect(result.mode).toBe('multiple_choice');
      }
    });

    it('detecta "puedes hacerme un mazo" (forma enclítica)', () => {
      const result = intent('puedes hacerme un mazo de repaso?');
      expect(result.type).toBe('generate_deck');
    });

    it('detecta "crea un mazo de 10 tarjetas" y extrae el conteo', () => {
      const result = intent('crea un mazo de 10 tarjetas para estudiar');
      expect(result.type).toBe('generate_deck');
      if (result.type === 'generate_deck') {
        expect(result.count).toBe(10);
      }
    });

    it('detecta "necesito preguntas para estudiar"', () => {
      const result = intent('necesito preguntas para estudiar');
      expect(result.type).toBe('generate_deck');
    });

    it('detecta "verdadero o falso" como modo boolean', () => {
      const result = intent('hazme un cuestionario de verdadero o falso');
      expect(result.type).toBe('generate_deck');
      if (result.type === 'generate_deck') {
        expect(result.mode).toBe('boolean');
      }
    });

    it('detecta "genera 5 flashcards" como modo flashcard', () => {
      const result = intent('genera 5 flashcards de la primera unidad');
      expect(result.type).toBe('generate_deck');
      if (result.type === 'generate_deck') {
        expect(result.mode).toBe('flashcard');
        expect(result.count).toBe(5);
      }
    });
  });

  describe('Exclusiones (NO es una solicitud de generación)', () => {
    it('no genera cuando pregunta por el precio de un mazo de cartas', () => {
      expect(intent('¿cuánto cuesta un mazo de cartas?').type).toBe('chat');
    });

    it('no genera cuando pide explicación sobre un mazo', () => {
      expect(intent('explícame cómo funciona un mazo de repaso').type).toBe('chat');
    });

    it('no genera cuando referencia un documento para examen', () => {
      expect(intent('este documento es para el examen del viernes').type).toBe('chat');
    });

    it('no genera en una conversación genérica', () => {
      expect(intent('hola Zyren, ¿qué tal?').type).toBe('chat');
    });

    it('no genera en una pregunta conceptual sobre flashcards', () => {
      expect(intent('¿qué es una flashcard?').type).toBe('chat');
    });
  });

  describe('Reintentos con historial', () => {
    const deckHistory = [
      { role: 'user' as const, content: 'crea un mazo sobre el proyecto integrador' },
      { role: 'assistant' as const, content: 'Claro, aquí tienes tu mazo.' },
    ];

    it('detecta "hazlo de nuevo" cuando antes había intención de mazo', () => {
      const result = intent('hazlo de nuevo', deckHistory);
      expect(result.type).toBe('generate_deck');
    });

    it('detecta "otro mazo" cuando antes había intención de mazo', () => {
      const result = intent('otro mazo', deckHistory);
      expect(result.type).toBe('generate_deck');
    });

    it('no genera en un reintento sin historial previo de mazo', () => {
      expect(intent('hazlo de nuevo').type).toBe('chat');
    });
  });
});
