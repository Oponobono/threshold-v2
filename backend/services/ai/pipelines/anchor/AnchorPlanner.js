/**
 * AnchorPlanner
 * Stage determinístico del pipeline de generación de anclas.
 *
 * Responsabilidad única: recibir el GenerateAnchorRequest y producir una
 * AnchorSpecification normalizada. No hace SQL ni habla con el LLM.
 *
 * AnchorSpecification es un Plain Object efímero dentro del pipeline.
 * Solo el AnchorCardAggregate (producido por AnchorBuilder) trasciende el Engine.
 *
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class AnchorPlanner {
  /**
   * @param {import('../../contracts/GenerateAnchorRequest')} request
   * @returns {{ conceptA: string, conceptB: string, reason: string, provider: string }}
   */
  static plan(request) {
    const conceptA = (request.conceptA || '').trim();
    const conceptB = (request.conceptB || '').trim();
    const reason = (request.reason || 'Similitud teórica').trim();

    if (!conceptA || !conceptB) {
      throw new Error('AnchorPlanner: conceptA y conceptB son obligatorios y no pueden estar vacíos.');
    }

    return {
      conceptA,
      conceptB,
      reason,
      provider: request.provider || 'groq',
    };
  }
}

module.exports = AnchorPlanner;
