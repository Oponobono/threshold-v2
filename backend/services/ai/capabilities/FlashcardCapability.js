const KnowledgeEngine = require('../knowledge/KnowledgeEngine');
const FlashcardEngine = require('../engines/FlashcardEngine');
const FlashcardDeckRepository = require('../../../database/repositories/FlashcardDeckRepository');
const { incrementSyncCounterOnly } = require('../../../helpers/syncVersion');

class FlashcardCapability {
  static async handle(request) {
    if (!request.isValid()) {
      throw new Error('Petición GenerateFlashcardsRequest inválida.');
    }

    // 1. Consolidar conocimiento
    const knowledgeModel = await KnowledgeEngine.consolidate(request.items);

    // 2. Obtener nueva syncVersion
    const syncVersion = await new Promise((resolve, reject) => {
      incrementSyncCounterOnly((err, v) => err ? reject(err) : resolve(v));
    });

    // 3. Ejecutar Engine (Pipeline)
    const aggregate = await FlashcardEngine.execute(knowledgeModel, request, syncVersion);

    // 4. Persistir
    await FlashcardDeckRepository.saveAggregate(aggregate);

    return aggregate;
  }
}

module.exports = FlashcardCapability;

