const { v4: uuidv4 } = require('uuid');

/**
 * ConfusionSuggestionsAggregate
 * Aggregate que contiene las sugerencias de confusión detectadas en un mazo.
 *
 * Cada sugerencia incluye un id propio y un campo confidence para soportar
 * scoring futuro (hoy fijo en 0.7; expandible sin romper el contrato).
 *
 * INVARIANTE: Inmutable. Object.freeze en construcción.
 */
class ConfusionSuggestionsAggregate {
  /**
   * @param {string} deckId
   * @param {Array<{conceptA, conceptB, reason, cardIds, confidence?}>} rawSuggestions
   */
  constructor(deckId, rawSuggestions) {
    this.deckId = deckId;
    this.suggestions = rawSuggestions.map(s => Object.freeze({
      id: uuidv4(),
      conceptA: s.conceptA || '',
      conceptB: s.conceptB || '',
      reason: s.reason || '',
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.7,
      cardIds: Array.isArray(s.cardIds) ? s.cardIds : [],
    }));
    Object.freeze(this.suggestions);
    Object.freeze(this);
  }
}

module.exports = ConfusionSuggestionsAggregate;
