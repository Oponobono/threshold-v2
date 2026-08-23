/**
 * FlashcardResponseParser
 *
 * Contrato interno único para todos los motores de generación de flashcards:
 * { topic, cards }.
 *
 * El topic es dato de dominio: lo produce el motor que comprende el contenido.
 * Esta pieza define CÓMO pedirlo al LLM y CÓMO validar/parsear la respuesta,
 * para que ningún motor introduzca criterios divergentes de extracción del tema.
 *
 * Compatible con los formatos históricos:
 * - { "topic": "...", "cards": [...] }      (contrato canónico)
 * - { "items": [...] }                       (flashcardsController Groq)
 * - { "flashcards": [...] }                  (variante antigua)
 * - [ ... ]                                  (array pelado, Generator legacy)
 */
const TOPIC_PROMPT_INSTRUCTION = `\n\nTEMA CENTRAL: Identifica el tema central del contenido y repórtalo en el campo "topic": un sustantivo o frase corta de 2 a 6 palabras, sin negritas, sin comillas ni markdown, escrita en el idioma del contenido. Es el concepto que un estudiante usaría para agrupar este mazo.`;

const TOPIC_FORMAT_INSTRUCTION = `\nResponde ÚNICAMENTE con un objeto JSON válido con esta estructura:
{
  "topic": "Tema central del contenido (2-6 palabras)",
  "cards": [ ...ítems generados... ]
}
No agregues texto introductorio ni conclusiones.`;

function normalizeTopic(topic) {
  if (typeof topic !== 'string') return null;
  const cleaned = topic
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.toLowerCase() === 'zyren') return null;
  return cleaned.length > 60 ? cleaned.slice(0, 60) : cleaned;
}

function extractCards(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.cards)) return parsed.cards;
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.flashcards)) {
      return parsed.flashcards.map((c) => ({
        type: 'flashcard',
        data: { front: c.question || c.front, back: c.answer || c.back },
      }));
    }
  }
  return null;
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function hasNestedCardArray(parsed) {
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    && (Array.isArray(parsed.cards) || Array.isArray(parsed.items) || Array.isArray(parsed.flashcards));
}

function extractJsonFromMarkdown(text) {
  // Busca un bloque de código markdown (con o sin etiqueta 'json')
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (blockMatch) {
    return blockMatch[1].trim();
  }
  return text.trim();
}

function parseTopicAndCards(raw) {
  let parsed = null;

  if (raw && typeof raw === 'object') {
    parsed = raw;
  } else if (typeof raw === 'string') {
    // 1. Limpiar bloques markdown primero para descartar texto conversacional exterior
    const cleanedRaw = extractJsonFromMarkdown(raw);

    // 2. Intentar parsear el string limpio completo
    parsed = tryParse(cleanedRaw);

    // 3. Si falla, intentar extraer el primer/último bracket u objeto (fallback histórico)
    if (!parsed) {
      const firstBrace = cleanedRaw.indexOf('{');
      const lastBrace = cleanedRaw.lastIndexOf('}');
      const objectCandidate = (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) 
        ? cleanedRaw.substring(firstBrace, lastBrace + 1) 
        : null;

      const firstBracket = cleanedRaw.indexOf('[');
      const lastBracket = cleanedRaw.lastIndexOf(']');
      const arrayCandidate = (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket)
        ? cleanedRaw.substring(firstBracket, lastBracket + 1)
        : null;

      const parsedObject = objectCandidate ? tryParse(objectCandidate) : undefined;
      const parsedArray = arrayCandidate ? tryParse(arrayCandidate) : undefined;

      // Canónico: objeto con cards/items/flashcards (conserva el topic).
      if (hasNestedCardArray(parsedObject)) {
        parsed = parsedObject;
      } else if (parsedArray && Array.isArray(parsedArray)) {
        parsed = parsedArray;
      }
    }
  }

  const cards = extractCards(parsed);
  if (!Array.isArray(cards)) {
    throw new Error(`No se pudo extraer el array de tarjetas de la respuesta del modelo. Respuesta cruda: ${raw.substring(0, 500)}...`);
  }

  const topic = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? normalizeTopic(parsed.topic)
    : null;

  return { topic, cards };
}

module.exports = {
  TOPIC_PROMPT_INSTRUCTION,
  TOPIC_FORMAT_INSTRUCTION,
  normalizeTopic,
  parseTopicAndCards,
};
