class PlanEvaluator {
  static evaluate(deckPlan, knowledgeModel) {
    // En un futuro, puede evaluar redundancia, dificultad y cobertura.
    // Por ahora, simplemente valida y retorna el plan.
    return { isApproved: true, plan: deckPlan };
  }
}

module.exports = PlanEvaluator;
