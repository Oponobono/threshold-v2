const { db } = require('../../../../db');

/**
 * DeckCardsLoader
 * Stage determinístico del pipeline de detección de confusiones.
 *
 * Responsabilidad única: cargar filas crudas de flashcards desde la base de datos.
 * No contiene lógica de dominio. No habla con el LLM.
 *
 * Análogo al rol de "fuente" en KnowledgeEngine, pero especializado para decks.
 * DeckKnowledgeBuilder transforma estas filas en un DeckKnowledgeModel.
 *
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class DeckCardsLoader {
  /**
   * Carga las tarjetas atómicas de un mazo desde la DB.
   * @param {string|number} deckId
   * @returns {Promise<Array<{id: string, front: string, back: string}>>}
   * @throws {Error} Si hay menos de 2 tarjetas disponibles.
   */
  static async load(deckId) {
    const cards = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, front, back FROM flashcards
         WHERE deck_id = ? AND item_type = 'flashcard' AND is_atomic = 1 AND deleted_at IS NULL`,
        [deckId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    if (cards.length < 2) {
      throw new Error(`El mazo ${deckId} tiene menos de 2 tarjetas atómicas. Se necesitan al menos 2 para detectar confusiones.`);
    }

    return cards;
  }
}

module.exports = DeckCardsLoader;
