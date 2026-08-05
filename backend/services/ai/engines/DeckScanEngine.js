const DeckCardsLoader = require('../pipelines/anchor/DeckCardsLoader');
const DeckKnowledgeBuilder = require('../pipelines/anchor/DeckKnowledgeBuilder');
const ConfusionDetector = require('../pipelines/anchor/ConfusionDetector');
const SuggestionsBuilder = require('../pipelines/anchor/SuggestionsBuilder');

/**
 * DeckScanEngine
 * Orquesta el pipeline de detección de confusiones en un mazo.
 *
 * Patrón:
 *   DeckCardsLoader   → filas crudas
 *   DeckKnowledgeBuilder → DeckKnowledgeModel
 *   ConfusionDetector → sugerencias crudas del LLM
 *   SuggestionsBuilder → ConfusionSuggestionsAggregate
 *
 * El Engine es el único punto de orquestación (Regla 10).
 * Ningún Stage llama a otro Stage directamente.
 */
class DeckScanEngine {
  /**
   * @param {import('../contracts/DetectConfusionsRequest')} request
   * @returns {Promise<import('../models/ConfusionSuggestionsAggregate')>}
   */
  static async execute(request) {
    console.log('[DeckScanEngine] Iniciando pipeline de detección para mazo:', request.deckId);

    const rawCards = await DeckCardsLoader.load(request.deckId);
    const model = DeckKnowledgeBuilder.build(request.deckId, rawCards);
    const rawSuggestions = await ConfusionDetector.detect(model, request);
    const aggregate = SuggestionsBuilder.build(request.deckId, rawSuggestions);

    console.log(`[DeckScanEngine] Pipeline finalizado: ${aggregate.suggestions.length} sugerencia(s) detectada(s).`);
    return aggregate;
  }
}

module.exports = DeckScanEngine;
