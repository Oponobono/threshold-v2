const AnchorPlanner = require('../pipelines/anchor/AnchorPlanner');
const AnchorContentGenerator = require('../pipelines/anchor/AnchorContentGenerator');
const AnchorValidator = require('../pipelines/anchor/AnchorValidator');
const AnchorBuilder = require('../pipelines/anchor/AnchorBuilder');

/**
 * AnchorEngine
 * Orquesta el pipeline de generación de anclas cognitivas.
 *
 * Patrón:
 *   AnchorPlanner          → AnchorSpecification  (determinístico)
 *   AnchorContentGenerator → AnchorDraft          (LLM)
 *   AnchorValidator        → AnchorDraft validado  (determinístico)
 *   AnchorBuilder          → AnchorCardAggregate   (determinístico)
 *
 * El Engine es el único punto de orquestación (Regla 10).
 * Ningún Stage llama a otro Stage directamente.
 */
class AnchorEngine {
  /**
   * @param {import('../contracts/GenerateAnchorRequest')} request
   * @param {number} syncVersion
   * @returns {Promise<import('../models/AnchorCardAggregate')>}
   */
  static async execute(request, syncVersion) {
    console.log('[AnchorEngine] Iniciando pipeline de generación de ancla cognitiva.');

    const spec = AnchorPlanner.plan(request);
    const draft = await AnchorContentGenerator.generate(spec);
    const validDraft = AnchorValidator.validate(draft);
    const aggregate = AnchorBuilder.build(request, validDraft, syncVersion);

    console.log('[AnchorEngine] Pipeline finalizado exitosamente. Ancla ID:', aggregate.id);
    return aggregate;
  }
}

module.exports = AnchorEngine;
