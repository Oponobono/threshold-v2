/**
 * DeckKnowledgeModel
 * Value Object que representa el conocimiento de un mazo de flashcards.
 *
 * Es el análogo de KnowledgeModel pero especializado para decks:
 * en lugar de consolidar fuentes heterogéneas (fotos, audios, documentos),
 * consolida las tarjetas de un mazo en una estructura lista para el LLM.
 *
 * INVARIANTE: DeckKnowledgeModel es inmutable. Object.freeze en construcción.
 */
class DeckKnowledgeModel {
  /**
   * @param {string} deckId
   * @param {Array<{id: string, front: string, back: string}>} cards
   */
  constructor(deckId, cards) {
    this._deckId = deckId;
    this._cards = cards;
    this._metadata = Object.freeze({
      deckId,
      cardCount: cards.length,
      buildTimestamp: Date.now(),
    });
    Object.freeze(this._cards);
    Object.freeze(this);
  }

  get deckId() {
    return this._deckId;
  }

  /** Tarjetas del mazo como array plano. Listo para serializar e inyectar en el LLM. */
  get cards() {
    return this._cards;
  }

  get metadata() {
    return this._metadata;
  }

  /** JSON serializado del mazo, listo para incluir en el prompt. */
  toJSON() {
    return JSON.stringify(this._cards.map(c => ({ id: c.id, front: c.front, back: c.back })));
  }
}

module.exports = DeckKnowledgeModel;
