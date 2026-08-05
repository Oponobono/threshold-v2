const DeckKnowledgeModel = require('../../models/DeckKnowledgeModel');

/**
 * DeckKnowledgeBuilder
 * Stage determinístico del pipeline de detección de confusiones.
 *
 * Responsabilidad única: transformar filas crudas de DB en un DeckKnowledgeModel.
 * Es el análogo de KnowledgeEngine.consolidate() pero especializado para decks:
 *   Sources → KnowledgeEngine → KnowledgeModel
 *   DB rows → DeckKnowledgeBuilder → DeckKnowledgeModel
 *
 * No hace SQL. No habla con el LLM.
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class DeckKnowledgeBuilder {
  /**
   * Construye un DeckKnowledgeModel a partir de filas crudas.
   * @param {string|number} deckId
   * @param {Array<{id: string, front: string, back: string}>} rawCards
   * @returns {DeckKnowledgeModel}
   */
  static build(deckId, rawCards) {
    const cards = rawCards.map(row => ({
      id: String(row.id),
      front: (row.front || '').trim(),
      back: (row.back || '').trim(),
    }));

    return new DeckKnowledgeModel(String(deckId), cards);
  }
}

module.exports = DeckKnowledgeBuilder;
