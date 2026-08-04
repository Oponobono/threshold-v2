const Planner = require('../pipelines/flashcard/Planner');
const PlanEvaluator = require('../pipelines/flashcard/PlanEvaluator');
const Generator = require('../pipelines/flashcard/Generator');
const Validator = require('../pipelines/flashcard/Validator');
const DeckBuilder = require('../pipelines/flashcard/DeckBuilder');

class FlashcardEngine {
  static async execute(knowledgeModel, request, syncVersion) {
    console.log('[FlashcardEngine] Iniciando pipeline de generación');

    // 1. Planning
    const deckPlan = await Planner.plan(knowledgeModel, request);
    
    // 2. Evaluation
    const evaluationReport = PlanEvaluator.evaluate(deckPlan, knowledgeModel);

    // 3. Generation
    const generatedCards = await Generator.generate(evaluationReport, knowledgeModel, request);

    // 4. Validation
    const validatedCards = Validator.validate(generatedCards);

    // 5. Deck Building
    const aggregate = DeckBuilder.build(request, validatedCards, syncVersion);

    console.log('[FlashcardEngine] Pipeline finalizado exitosamente');
    return aggregate;
  }
}

module.exports = FlashcardEngine;
