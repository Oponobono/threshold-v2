const { v4: uuidv4 } = require('uuid');

/**
 * AnchorCardAggregate
 * Aggregate que representa un Ancla Cognitiva lista para persistir.
 *
 * Una Ancla Cognitiva es un tipo especializado de Flashcard.
 * Taxonomía futura: FlashcardAggregate → { RecallCard, AnchorCard, ... }
 * Por ahora, AnchorCardAggregate es el modelo correcto: el dominio no
 * anticipa estructuras sin un consumidor real que lo justifique.
 *
 * UUIDs generados aquí (no en el Repository).
 * INVARIANTE: Inmutable. Object.freeze en construcción.
 */
class AnchorCardAggregate {
  /**
   * @param {{ deckId, userId, syncVersion, front, back, hint, explanation }} params
   */
  constructor({ deckId, userId, syncVersion, front, back, hint, explanation }) {
    this.id = uuidv4();
    this.deckId = deckId;
    this.userId = userId;
    this.syncVersion = syncVersion;
    this.front = front;
    this.back = back;
    this.hint = hint || null;
    this.explanation = explanation || null;
    this.itemType = 'flashcard';
    Object.freeze(this);
  }
}

module.exports = AnchorCardAggregate;
