const ConfusionSuggestionsAggregate = require('../../models/ConfusionSuggestionsAggregate');

/**
 * SuggestionsBuilder
 * Stage determinístico del pipeline de detección de confusiones.
 *
 * Responsabilidad única: construir un ConfusionSuggestionsAggregate a partir
 * del array crudo devuelto por ConfusionDetector. Añade id y confidence a
 * cada sugerencia sin depender del LLM.
 *
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class SuggestionsBuilder {
  /**
   * @param {string|number} deckId
   * @param {Array<{conceptA, conceptB, reason, cardIds, confidence?}>} rawSuggestions
   * @returns {ConfusionSuggestionsAggregate}
   */
  static build(deckId, rawSuggestions) {
    const valid = Array.isArray(rawSuggestions)
      ? rawSuggestions.filter(s => s.conceptA && s.conceptB)
      : [];

    return new ConfusionSuggestionsAggregate(String(deckId), valid);
  }
}

module.exports = SuggestionsBuilder;
