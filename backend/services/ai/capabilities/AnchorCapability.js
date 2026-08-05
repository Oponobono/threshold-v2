const AnchorEngine = require('../engines/AnchorEngine');
const FlashcardDeckRepository = require('../../../database/repositories/FlashcardDeckRepository');
const { incrementSyncCounterOnly } = require('../../../helpers/syncVersion');

/**
 * AnchorCapability
 * Orquesta la generación y persistencia de un Ancla Cognitiva.
 *
 * Flujo:
 *   1. Validar el request.
 *   2. Obtener la syncVersion global.
 *   3. Ejecutar AnchorEngine (pipeline completo → AnchorCardAggregate).
 *   4. Persistir via FlashcardDeckRepository.addAnchorCard().
 *   5. Retornar el Aggregate (el Controller lo traduce a DTO via Mapper).
 *
 * La Capability no conoce SQL ni el LLM directamente.
 * La syncVersion se obtiene aquí — igual que en FlashcardCapability.
 */
class AnchorCapability {
  /**
   * @param {import('../contracts/GenerateAnchorRequest')} request
   * @returns {Promise<import('../models/AnchorCardAggregate')>}
   */
  static async handle(request) {
    if (!request.isValid()) {
      throw new Error('GenerateAnchorRequest inválido: deckId, userId, conceptA y conceptB son obligatorios.');
    }

    const syncVersion = await new Promise((resolve, reject) => {
      incrementSyncCounterOnly((err, v) => err ? reject(err) : resolve(v));
    });

    const aggregate = await AnchorEngine.execute(request, syncVersion);
    await FlashcardDeckRepository.addAnchorCard(aggregate);

    return aggregate;
  }
}

module.exports = AnchorCapability;
