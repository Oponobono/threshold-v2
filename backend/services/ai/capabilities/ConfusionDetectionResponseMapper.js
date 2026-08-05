/**
 * ConfusionDetectionResponseMapper
 * Traduce un ConfusionSuggestionsAggregate al DTO HTTP.
 *
 * Regla 9: el Aggregate pertenece al dominio. La respuesta HTTP pertenece a la API.
 * Este Mapper es el puente entre ambas capas.
 * El Engine y el Repository nunca ven este Mapper.
 */
class ConfusionDetectionResponseMapper {
  /**
   * @param {import('../models/ConfusionSuggestionsAggregate')} aggregate
   * @returns {{ suggestions: Array<{ id, conceptA, conceptB, reason, confidence, cardIds }> }}
   */
  static toResponse(aggregate) {
    return {
      suggestions: aggregate.suggestions.map(s => ({
        id: s.id,
        conceptA: s.conceptA,
        conceptB: s.conceptB,
        reason: s.reason,
        confidence: s.confidence,
        cardIds: s.cardIds,
      })),
    };
  }
}

module.exports = ConfusionDetectionResponseMapper;
