/**
 * intentionDetector.js
 * 
 * Detecta intenciones del usuario para generar mazos de estudio.
 * Diferencia entre solicitudes legítimas de flashcards vs conversaciones generales.
 * 
 * CASOS A DIFERENCIA:
 * ✅ "crea un mazo de flashcards" → GENERAR MAZO
 * ✅ "quiero 10 preguntas para estudiar" → GENERAR MAZO
 * ✅ "examen de verdadero/falso" → GENERAR MAZO
 * ❌ "cuanto cuesta un mazo de cartas" → NO GENERAR
 * ❌ "el documento es para el examen del viernes" → NO GENERAR (solo referencia)
 * ✅ "necesito tarjetas de estudio" → GENERAR MAZO
 */

/**
 * Patrones que indican solicitud de generación de mazo
 */
const DECK_GENERATION_PATTERNS = [
  // Palabras clave en español
  /(?:generar?|crear?|hacer?)\s+(?:un\s+)?(?:mazo|mazos|deck|decks|flashcard|flashcards|tarjetas?|preguntas|examen|quiz|cuestionario|prueba|evaluación|material\s+(?:de\s+)?repaso)/i,
  
  // "de estudio/repaso"
  /(?:tarjetas?|preguntas|ejercicios?|material)\s+(?:de\s+)?(?:estudio|repaso|práctica|evaluación)/i,
  
  // "necesito X para estudiar"
  /(?:necesito|quiero|dame|dame|proporciona)\s+(?:un\s+)?(?:mazo|flashcard|tarjetas?|preguntas|examen)/i,
  
  // Cantidad + tipo de contenido
  /(\d+|varios|varios|muchas?)\s+(?:flashcard|tarjetas?|preguntas|ítems?|ejercicios?|casos)/i,
  
  // Tipo de preguntas específico
  /(?:verdadero|falso|opción\s+múltiple|respuesta\s+corta|ensayo|desarrollo)/i,
  
  // "Tipo de preguntas: X"
  /tipos?\s+(?:de\s+)?(?:preguntas|ejercicios|ítems)/i,
  
  // "para practicar"
  /para\s+(?:practicar|entrenar|repasar|estudiar|prepararme|preparar(?:me)?(?:\s+para)?)/i,
];

/**
 * Patrones que EXCLUYEN de generación de mazo
 * (contexto es diferente, no es una solicitud real)
 */
const EXCLUSION_PATTERNS = [
  // Preguntar por precio/costo de algo físico
  /(?:cuánto|cuanto|cuál es el precio|precio|costo|vale)\s+(?:un\s+)?(?:mazo|deck)\s+(?:de\s+)?(?:cartas|poker|yu-gi-oh|magic)/i,
  
  // Referencia a examen sin pedir generación
  /(?:este|ese|el)\s+(?:documento|archivo|pdf|texto)\s+es\s+para\s+(?:el\s+)?(?:examen|prueba|test)/i,
  
  // Hablando sobre mazos de cartas (juegos)
  /(?:mazo\s+(?:de\s+)?cartas|deck\s+(?:de\s+)?(?:magic|yu-gi-oh|pokemon))/i,
  
  // No pide generar, solo pregunta sobre algo
  /(?:cuéntame|explícame|qué\s+es|cómo\s+funciona|cuáles\s+son)\s+[^.]*(?:mazo|deck|flashcard|tarjeta)/i,
];

/**
 * Detecta si el usuario está pidiendo generar un mazo de estudio
 * 
 * @param {string} userMessage - Mensaje del usuario
 * @returns {Object} { shouldGenerate: boolean, mode?: string, reason?: string }
 */
function detectDeckGenerationIntent(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return { shouldGenerate: false, reason: 'Mensaje vacío' };
  }

  const msg = userMessage.toLowerCase().trim();

  // Primero: verificar EXCLUSIONES (tiene prioridad)
  for (const pattern of EXCLUSION_PATTERNS) {
    if (pattern.test(msg)) {
      return { 
        shouldGenerate: false, 
        reason: `Coincidió patrón de exclusión: ${pattern.source}` 
      };
    }
  }

  // Segundo: verificar PATRONES DE GENERACIÓN
  for (const pattern of DECK_GENERATION_PATTERNS) {
    if (pattern.test(msg)) {
      // Inferir modo según palabras clave
      const mode = inferDeckMode(msg);
      return { 
        shouldGenerate: true, 
        mode,
        reason: `Detectada solicitud de mazo (modo: ${mode})` 
      };
    }
  }

  return { shouldGenerate: false, reason: 'No coincidió ningún patrón de generación' };
}

/**
 * Infiere el modo de mazo según palabras clave en el mensaje
 * 
 * @param {string} msg - Mensaje en minúsculas
 * @returns {string} 'flashcard', 'multiple_choice', 'boolean', o 'mixed' (default)
 */
function inferDeckMode(msg) {
  // Verdadero/Falso
  if (/(?:verdadero|falso|v\/f|vf|boolean|true\/false)/i.test(msg)) {
    return 'boolean';
  }

  // Opción Múltiple
  if (/(?:opción\s+múltiple|múltiple|selección|alternativas?|choices?|4\s+opciones?|a\s+b\s+c\s+d)/i.test(msg)) {
    return 'multiple_choice';
  }

  // Flashcards / Tarjetas
  if (/(?:flashcard|tarjetas?|front\/back|frente\/reverso)/i.test(msg)) {
    return 'flashcard';
  }

  // Default: mezcla (mejor para estudio balanceado)
  return 'mixed';
}

/**
 * Extrae la cantidad de ítems solicitados del mensaje
 * 
 * @param {string} userMessage
 * @returns {number} Entre 5 y 20 (default: 10)
 */
function extractRequestedCount(userMessage) {
  if (!userMessage) return 10;

  const msg = userMessage.toLowerCase();

  // Buscar números explícitos
  const numberMatch = msg.match(/(\d+)\s+(?:flashcard|tarjetas?|preguntas|ítems?|ejercicios?)/i);
  if (numberMatch && numberMatch[1]) {
    const count = parseInt(numberMatch[1], 10);
    if (count >= 5 && count <= 20) return count;
    if (count > 20) return 20; // Cap máximo
    if (count < 5) return 5;   // Mínimo
  }

  // Palabras clave de cantidad
  if (/(?:varias?|varios?|muchas?|bastante?)/i.test(msg)) return 15;
  if (/(?:pocas?|pocos?|algunos?)/i.test(msg)) return 8;

  // Default
  return 10;
}

/**
 * Construye el bloque %%DECK_ACTION%% que Zyren debe agregar a su respuesta
 * 
 * @param {string} mode - 'flashcard', 'multiple_choice', 'boolean', 'mixed'
 * @param {number} count - Cantidad de ítems (5-20)
 * @returns {string} Bloque con formato exacto
 */
function buildDeckActionBlock(mode, count) {
  return `%%DECK_ACTION%%{"mode":"${mode}","count":${count}}%%END%%`;
}

/**
 * Parsea el bloque %%DECK_ACTION%% de la respuesta de Zyren
 * 
 * @param {string} response - Respuesta completa del asistente
 * @returns {Object} { deckAction: {...}, hasAction: boolean, cleanResponse: string }
 */
function parseDeckActionBlock(response) {
  if (!response) return { hasAction: false, deckAction: null, cleanResponse: response };

  const pattern = /%%DECK_ACTION%%(.+?)%%END%%/;
  const match = response.match(pattern);

  if (!match || !match[1]) {
    return { hasAction: false, deckAction: null, cleanResponse: response };
  }

  try {
    const deckAction = JSON.parse(match[1]);
    const cleanResponse = response.replace(pattern, '').trim();
    
    // Validar estructura
    if (!deckAction.mode || !deckAction.count) {
      throw new Error('Estructura incompleta');
    }

    return { 
      hasAction: true, 
      deckAction,
      cleanResponse
    };
  } catch (err) {
    console.warn('[IntentionDetector] Error parseando DECK_ACTION:', err.message);
    return { hasAction: false, deckAction: null, cleanResponse: response };
  }
}

module.exports = {
  detectDeckGenerationIntent,
  inferDeckMode,
  extractRequestedCount,
  buildDeckActionBlock,
  parseDeckActionBlock,
};
