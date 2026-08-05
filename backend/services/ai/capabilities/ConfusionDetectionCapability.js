const DeckScanEngine = require('../engines/DeckScanEngine');

/**
 * ConfusionDetectionCapability
 * Orquesta la detección de conceptos confundibles en un mazo.
 *
 * Flujo: DetectConfusionsRequest → DeckScanEngine → ConfusionSuggestionsAggregate
 *
 * La Capability no conoce SQL ni el LLM directamente.
 * No necesita syncVersion: la detección es una operación de lectura.
 */
class ConfusionDetectionCapability {
  /**
   * @param {import('../contracts/DetectConfusionsRequest')} request
   * @returns {Promise<import('../models/ConfusionSuggestionsAggregate')>}
   */
  static async handle(request) {
    if (!request.isValid()) {
      throw new Error('DetectConfusionsRequest inválido: deckId y userId son obligatorios.');
    }

    return DeckScanEngine.execute(request);
  }
}

module.exports = ConfusionDetectionCapability;
