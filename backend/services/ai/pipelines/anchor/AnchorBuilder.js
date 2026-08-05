const AnchorCardAggregate = require('../../models/AnchorCardAggregate');

/**
 * AnchorBuilder
 * Stage determinístico del pipeline de generación de anclas.
 *
 * Responsabilidad única: construir un AnchorCardAggregate a partir del
 * AnchorDraft validado, el request original y la syncVersion obtenida por la Capability.
 * No hace SQL ni habla con el LLM.
 *
 * El Aggregate es el límite del dominio (Regla 9).
 * Su construcción ocurre aquí, no en el Repository.
 *
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class AnchorBuilder {
  /**
   * @param {import('../../contracts/GenerateAnchorRequest')} request
   * @param {{ front: string, back: string, hint: string|null, explanation: string|null }} validDraft
   * @param {number} syncVersion
   * @returns {AnchorCardAggregate}
   */
  static build(request, validDraft, syncVersion) {
    return new AnchorCardAggregate({
      deckId: request.deckId,
      userId: request.userId,
      syncVersion,
      front: validDraft.front,
      back: validDraft.back,
      hint: validDraft.hint,
      explanation: validDraft.explanation,
    });
  }
}

module.exports = AnchorBuilder;
