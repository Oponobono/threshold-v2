/**
 * ConversationIntentResolver
 * Responsabilidad única: detectar si un mensaje del usuario (en su contexto de historial)
 * expresa la intención de generar un mazo de estudio.
 *
 * El resolver NO genera nada. Solo resuelve intenciones.
 * La generación es responsabilidad de quien consuma el resultado.
 */

export type ConversationIntent =
  | { type: 'generate_deck'; mode: StudyMode; count: number }
  | { type: 'chat' };

export type StudyMode = 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';

const DECK_INTENT_PATTERNS = [
  /(?:crea|genera|haz|hacer|hacer|produce|producir|arma|armar)\s+(?:un\s+)?(?:mazo|deck|flashcard|tarjetas?|preguntas?)/iu,
  /(?:estudiar|repasar|aprender)\s+(?:con\s+)?(?:flashcards?|tarjetas?|mazo|deck)/iu,
  /(?:mazo|deck)\s+(?:de\s+)?(?:estudio|repaso|aprendizaje)/iu,
  /flashcards?\s+(?:de\s+|para\s+|sobre\s+)?/iu,
  /genera.*material/iu,
  /prepara.*examen/iu,
];

const RETRY_PATTERNS =
  /(?:de\s+nuevo|otra\s+vez|nuevamente|crea|genera|haz|vuelve?|repite?|inténtalo?\s+(?:de\s+nuevo|otra\s+vez)?)/iu;

const MODE_PATTERNS: Record<StudyMode, RegExp> = {
  multiple_choice: /(?:opción\s+múltiple|selección\s+múltiple|multiple\s+choice|alternativas)/iu,
  boolean: /(?:verdadero\s+y\s+falso|verdadero\s+o\s+falso|true\s+or\s+false|v\s*\/\s*f)/iu,
  flashcard: /(?:flashcard|tarjetas?\s+simples?|anverso\s+y\s+reverso)/iu,
  mixed: /(?:mixto|variado|combinado|de\s+todo)/iu,
};

const COUNT_PATTERN = /\b(\d+)\s*(?:tarjetas?|preguntas?|ítems?|cards?|flashcards?)\b/iu;

function detectMode(text: string): StudyMode {
  for (const [mode, pattern] of Object.entries(MODE_PATTERNS)) {
    if (pattern.test(text)) return mode as StudyMode;
  }
  return 'mixed';
}

function detectCount(text: string): number {
  const match = text.match(COUNT_PATTERN);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n >= 5 && n <= 20) return n;
  }
  return 10;
}

function hasDeckIntent(text: string): boolean {
  return DECK_INTENT_PATTERNS.some(p => p.test(text));
}

/**
 * Resuelve la intención de un mensaje dado su historial de conversación.
 */
export function resolveIntent(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): ConversationIntent {
  // Intención directa en el mensaje actual
  if (hasDeckIntent(message)) {
    return { type: 'generate_deck', mode: detectMode(message), count: detectCount(message) };
  }

  // Intención de reintento: el usuario repite/reintenta y en el historial ya había intención de mazo
  const prevUserHadDeckIntent = history.some(m => m.role === 'user' && hasDeckIntent(m.content));
  if (RETRY_PATTERNS.test(message) && prevUserHadDeckIntent) {
    const prevDeckMsg = [...history].reverse().find(m => m.role === 'user' && hasDeckIntent(m.content));
    const src = prevDeckMsg?.content || message;
    return { type: 'generate_deck', mode: detectMode(src), count: detectCount(src) };
  }

  return { type: 'chat' };
}
