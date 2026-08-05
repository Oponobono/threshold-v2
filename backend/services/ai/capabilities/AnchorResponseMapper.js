/**
 * AnchorResponseMapper
 * Traduce un AnchorCardAggregate al DTO HTTP.
 *
 * Regla 9: el Aggregate pertenece al dominio. La respuesta HTTP pertenece a la API.
 * Este Mapper es el puente entre ambas capas.
 * El Engine y el Repository nunca ven este Mapper.
 *
 * El DTO incluye el id para que el cliente móvil pueda persistir localmente
 * con el mismo UUID, garantizando idempotencia en la capa Local-First.
 */
class AnchorResponseMapper {
  /**
   * @param {import('../models/AnchorCardAggregate')} aggregate
   * @returns {{ id, deckId, front, back, hint, explanation, itemType }}
   */
  static toResponse(aggregate) {
    return {
      id: aggregate.id,
      deckId: aggregate.deckId,
      front: aggregate.front,
      back: aggregate.back,
      hint: aggregate.hint,
      explanation: aggregate.explanation,
      itemType: aggregate.itemType,
    };
  }
}

module.exports = AnchorResponseMapper;
