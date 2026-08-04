const DeckPlan = require('../../models/DeckPlan');

/**
 * Planner
 * Determina la estrategia de generación (modo, cantidad).
 * Es un módulo determinístico: NO hace llamadas al LLM.
 * El Generator tiene la extracción de conceptos embebida en su system prompt.
 */
class Planner {
  static async plan(knowledgeModel, request) {
    return new DeckPlan({
      mode: request.mode,
      count: request.count,
      concepts: [],
    });
  }
}

module.exports = Planner;

