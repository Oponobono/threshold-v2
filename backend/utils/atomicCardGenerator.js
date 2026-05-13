/**
 * atomicCardGenerator.js
 *
 * Fragmenta tarjetas complejas en "micro-tarjetas" atómicas.
 * Base científica: Cognitive Load Theory (Sweller)
 *
 * Principio: Es mejor repasar 5 tarjetas simples que una compleja.
 * El cerebro procesa mejor información atomizada.
 */

/**
 * Detecta si una tarjeta es demasiado densa
 * Criterios: > 100 palabras O múltiples puntos O complejidad sintáctica
 * 
 * @param {Object} card
 *   - front: Pregunta
 *   - back: Respuesta
 * @returns {Object} { isDense, wordCount, complexity, recommendation }
 */
function analyzeCardDensity(card) {
  const { front = '', back = '' } = card;
  
  const totalText = (front + ' ' + back).toLowerCase();
  const wordCount = totalText.split(/\s+/).length;
  
  // Análisis de complejidad
  const complexity = {
    hasMultipleColons: (totalText.match(/:/g) || []).length,
    hasMultipleSemicolons: (totalText.match(/;/g) || []).length,
    hasParentheses: (totalText.match(/[()]/g) || []).length,
    hasManyCommas: (totalText.match(/,/g) || []).length,
    hasFormulas: /[\+\-\*\/=\\]/g.test(totalText),
    hasCode: /[\[\]\{\}]/g.test(totalText),
  };

  const complexityScore = 
    complexity.hasMultipleColons * 2 +
    complexity.hasMultipleSemicolons * 2 +
    complexity.hasParentheses +
    complexity.hasManyCommas +
    (complexity.hasFormulas ? 3 : 0) +
    (complexity.hasCode ? 3 : 0);

  const isDense = wordCount > 100 || complexityScore > 5;

  return {
    isDense,
    wordCount,
    complexityScore,
    complexity,
    recommendation: isDense ? 'FRAGMENT_INTO_ATOMIC' : 'OK',
  };
}

/**
 * Fragmenta una tarjeta densa en micro-tarjetas atómicas
 * Usa la IA (Gemini/Groq) para hacer la fragmentación inteligente
 * 
 * Estrategia:
 * 1. Si tiene múltiples partes (1., 2., 3.), crear una tarjeta por parte
 * 2. Si tiene ejemplos separados, crear tarjeta de concepto + tarjetas de ejemplos
 * 3. Si tiene pasos (procedimental), crear tarjeta por paso
 */
function fragmentCard(card) {
  const { front = '', back = '' } = card;

  // Estrategia 1: Detectar listas numeradas
  const numberedItems = back.match(/^\d+\.\s+.+$/gm);
  if (numberedItems && numberedItems.length > 2) {
    return fragmentByNumbers(front, numberedItems);
  }

  // Estrategia 2: Detectar párrafos separados
  const paragraphs = back.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length > 2) {
    return fragmentByParagraphs(front, paragraphs);
  }

  // Estrategia 3: Detectar pasos procedimentales
  const stepPattern = /(?:paso|step|etapa)\s+\d+/gi;
  const hasSteps = stepPattern.test(back);
  if (hasSteps) {
    return fragmentBySteps(front, back);
  }

  // Si no hay patrón claro, retornar la original
  return [{ front, back, isAtomic: true, atomicIndex: 0 }];
}

/**
 * Fragmenta por items numerados
 */
function fragmentByNumbers(front, numberedItems) {
  const atomicCards = [];

  // Primera tarjeta: concepto general
  atomicCards.push({
    front: `Concepto: ${front}`,
    back: `Se divide en ${numberedItems.length} partes principales. Repasa los puntos específicos.`,
    isAtomic: true,
    atomicIndex: 0,
  });

  // Una tarjeta por item
  numberedItems.forEach((item, index) => {
    atomicCards.push({
      front: `${front} - Punto ${index + 1}`,
      back: item.replace(/^\d+\.\s+/, '').trim(),
      isAtomic: true,
      atomicIndex: index + 1,
    });
  });

  return atomicCards;
}

/**
 * Fragmenta por párrafos
 */
function fragmentByParagraphs(front, paragraphs) {
  const atomicCards = [];

  paragraphs.forEach((para, index) => {
    if (para.trim().length === 0) return;

    atomicCards.push({
      front: `${front} (Parte ${index + 1})`,
      back: para.trim(),
      isAtomic: true,
      atomicIndex: index,
    });
  });

  return atomicCards;
}

/**
 * Fragmenta por pasos procedimentales
 */
function fragmentBySteps(front, back) {
  const stepPattern = /(?:paso|step|etapa)\s+\d+[:\s]+([^]*?)(?=(?:paso|step|etapa)\s+\d+|$)/gi;
  const steps = [];
  let match;

  while ((match = stepPattern.exec(back)) !== null) {
    steps.push(match[1].trim());
  }

  const atomicCards = [];

  steps.forEach((step, index) => {
    atomicCards.push({
      front: `${front} - Paso ${index + 1}`,
      back: step,
      isAtomic: true,
      atomicIndex: index,
    });
  });

  return atomicCards.length > 0 ? atomicCards : [{ front, back, isAtomic: true, atomicIndex: 0 }];
}

/**
 * Detecta conceptos similares en la BD que podrían confundirse
 * Ejemplo: Schrödinger vs Heisenberg, Integral vs Derivada
 * 
 * Si detecta conceptos similares, genera una "tarjeta de comparación"
 * 
 * @param {Array} existingCards - Tarjetas ya en la BD
 * @param {Object} newCard - Tarjeta nueva a añadir
 * @returns {Object} { shouldCreateComparison, comparison }
 */
function detectConfusableConceptsAndCreateComparison(existingCards, newCard) {
  const keywords = extractKeywords(newCard.front + ' ' + newCard.back);
  
  const confusable = existingCards.filter(card => {
    const cardKeywords = extractKeywords(card.front + ' ' + card.back);
    const overlap = keywords.filter(k => cardKeywords.includes(k)).length;
    return overlap >= 2; // Al menos 2 palabras clave en común
  });

  if (confusable.length > 0) {
    return {
      shouldCreateComparison: true,
      comparisons: confusable.map(existingCard => ({
        newConcept: newCard.front,
        existingConcept: existingCard.front,
        suggestedComparison: `¿Cuál es la diferencia entre "${newCard.front}" y "${existingCard.front}"?`,
        suggestedAnswer: `Necesita ser redactado por el educador, pero debe cubrir:
- Definición de ${newCard.front}
- Definición de ${existingCard.front}
- Diferencias clave
- Cuándo se aplica cada uno`,
      })),
    };
  }

  return { shouldCreateComparison: false, comparisons: [] };
}

/**
 * Extrae palabras clave principales (sustantivos, verbos importantes)
 * Muy simplificado, en producción usar librería NLP
 */
function extractKeywords(text) {
  const stopwords = new Set([
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'estar', 
    'es', 'son', 'se', 'para', 'con', 'por', 'o', 'una', 'más', 'del',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'is', 'are'
  ]);

  return text
    .toLowerCase()
    .match(/\b\w+\b/g)
    .filter(word => word.length > 3 && !stopwords.has(word))
    .slice(0, 5); // Top 5 palabras
}

module.exports = {
  analyzeCardDensity,
  fragmentCard,
  detectConfusableConceptsAndCreateComparison,
};
