/**
 * ConversationIntentResolver
 * Responsabilidad única: detectar si un mensaje del usuario (en su contexto de historial)
 * expresa la intención de generar un mazo de estudio.
 *
 * El resolver NO genera nada. Solo resuelve intenciones.
 * La generación es responsabilidad de quien consuma el resultado.
 */

export type ConversationIntent =
  | { type: 'generate_deck'; mode: StudyMode; count: number; topic?: string }
  | { type: 'chat' };

export type StudyMode = 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';

const DECK_EXCLUSION_PATTERNS = [
  /(?:cuánto|cuanto|cuál es el precio|precio|costo|vale)\s+(?:un\s+)?(?:mazo|deck)\s+(?:de\s+)?(?:cartas|poker|yu-gi-oh|magic)/iu,
  /(?:este|ese|el)\s+(?:documento|archivo|pdf|texto)\s+es\s+para\s+(?:el\s+)?(?:examen|prueba|test)/iu,
  /(?:mazo\s+(?:de\s+)?cartas|deck\s+(?:de\s+)?(?:magic|yu-gi-oh|pokemon))/iu,
  /(?:cuéntame|explícame|qué\s+es|cómo\s+funciona|cuáles\s+son)\s+[^.]*(?:mazo|deck|flashcard|tarjeta)/iu,
];

const DECK_INTENT_PATTERNS = [
  // Verbos modales + infinitivo: "podrías crear un mazo", "me puedes generar flashcards",
  // "quisiera hacer un mazo", "puedes hacerme un mazo"
  /(?:podr(?:í|i)as?|puedes|puedo|quisiera|quería|me\s+(?:puedes|puede|harías|harias|haces|hace))\s+(?:crear|crearme|generar|generarme|hacer|hacerme|preparar|prepararme|armar|armarme|producir|producirme|elaborar|elaborarme)\s+(?:un\s+|una\s+|unos\s+|unas\s+)?(?:mazo|deck|flashcard|tarjetas?|preguntas?|examen|quiz|cuestionario|material(?:\s+de)?\s+repaso)/iu,
  // Verbos directos de generación: "crea un mazo", "genera 10 preguntas", "prepárame un examen"
  /(?:crea|crear|cree|genera|generar|genere|genérame|generame|haz|hacer|haga|hazme|prepara|preparar|prepare|prepárame|preparame|arma|armar|produce|producir|elabora|elaborar|dame|proporciona|necesito|quiero)\s+(?:un\s+|una\s+|unos\s+|unas\s+)?(?:\d+\s+)?(?:mazo|mazos|deck|decks|flashcard|flashcards|tarjetas?|preguntas?|examen|quiz|cuestionario|prueba|evaluación|material(?:\s+de)?\s+repaso)/iu,
  /(?:estudiar|repasar|aprender)\s+(?:con\s+)?(?:flashcards?|tarjetas?|mazo|deck)/iu,
  /(?:mazo|deck)\s+(?:de\s+)?(?:estudio|repaso|aprendizaje)/iu,
  /flashcards?\s+(?:de\s+|para\s+|sobre\s+)?/iu,
  /(?:genera|generar|crea|crear|prepara|preparar)\s+(?:material|contenido|apuntes)/iu,
  /prepara.*examen/iu,
  // "necesito/quiero/dame X flashcards/preguntas/examen"
  /(?:necesito|quiero|dame|proporciona)\s+(?:un\s+|una\s+|unos\s+|unas\s+)?(?:\d+\s+)?(?:mazo|flashcard|tarjetas?|preguntas?|examen|cuestionario)/iu,
  // "para practicar/estudiar/repasar"
  /para\s+(?:practicar|entrenar|repasar|estudiar|prepararme|preparar(?:me)?(?:\s+para)?)/iu,
];

const RETRY_PATTERNS =
  /(?:de\s+nuevo|otra\s+vez|nuevamente|de\s+vuelta|vuelve?|repite?|inténtalo?|intentalo|crea(?:lo)?|genera(?:lo)?|haz(?:lo)?|(?:otro|otra|nuevo|nueva)\s+(?:mazo|deck|flashcard|tarjetas?|preguntas?))/iu;

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
  const msg = text.toLowerCase();
  if (DECK_EXCLUSION_PATTERNS.some(p => p.test(msg))) return false;
  return DECK_INTENT_PATTERNS.some(p => p.test(msg));
}

/**
 * Extrae el tema específico (topic) del mensaje del usuario de forma heurística.
 * Útil para que el título del mazo no sea el mensaje entero (ej. "crea un mazo sobre X" -> "X").
 */
function extractTopic(text: string): string | undefined {
  // 1. Patrón explícito: "sobre [tema]"
  let match = text.match(/sobre\s+(.+?)(?:\.|$)/i);
  if (match) return match[1].trim();

  // 2. Patrón de posesión: "mazo de [tema]", "tarjetas de [tema]"
  match = text.match(/(?:mazo|deck|flashcards?|tarjetas?|preguntas?|examen|quiz)\s+de\s+(.+?)(?:\.|$)/i);
  if (match) {
    let t = match[1].trim();
    // Evita falsos positivos como "mazo de 10" (cuando el número no fue atrapado por detectCount)
    if (/^\d+$/.test(t)) return undefined;
    // Limpia "10 tarjetas de X" si quedó atascado
    t = t.replace(/^\d+\s+(?:tarjetas?|preguntas?|flashcards?|ítems?)\s+de\s+/i, '');
    return t.trim();
  }
  
  return undefined;
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
    return { 
      type: 'generate_deck', 
      mode: detectMode(message), 
      count: detectCount(message),
      topic: extractTopic(message)
    };
  }

  // Intención de reintento: el usuario repite/reintenta y en el historial ya había intención de mazo
  const prevUserHadDeckIntent = history.some(m => m.role === 'user' && hasDeckIntent(m.content));
  if (RETRY_PATTERNS.test(message) && prevUserHadDeckIntent) {
    const prevDeckMsg = [...history].reverse().find(m => m.role === 'user' && hasDeckIntent(m.content));
    const src = prevDeckMsg?.content || message;
    return { 
      type: 'generate_deck', 
      mode: detectMode(src), 
      count: detectCount(src),
      topic: extractTopic(src)
    };
  }

  return { type: 'chat' };
}
