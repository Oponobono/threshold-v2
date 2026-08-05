const InferenceRouter = require('../../providers/InferenceRouter');

/**
 * ConfusionDetector
 * Único Stage con LLM en el pipeline de detección de confusiones.
 *
 * Responsabilidad: detectar pares de conceptos confundibles usando un modelo
 * de Psicología Educativa. Recibe un DeckKnowledgeModel y devuelve un
 * array crudo de sugerencias. El SuggestionsBuilder construirá el Aggregate.
 *
 * Regla 5: el LLM se accede exclusivamente via InferenceRouter.
 * Regla 6: solo este Stage hace llamadas de red al LLM en este pipeline.
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class ConfusionDetector {
  /**
   * @param {import('../../models/DeckKnowledgeModel')} deckKnowledgeModel
   * @param {import('../../contracts/DetectConfusionsRequest')} request
   * @returns {Promise<Array<{conceptA, conceptB, reason, cardIds}>>}
   */
  static async detect(deckKnowledgeModel, request) {
    const ModelClass = InferenceRouter.getReasoningModel(request.provider);

    const systemPrompt = `Eres un experto en Psicología Educativa y Diseño Instruccional.
Tu tarea es analizar un set de flashcards y detectar conceptos que sean "confundibles" entre sí (similitud semántica o estructural).
El objetivo es identificar pares de conceptos para los cuales se debería generar una "Tarjeta de Diferenciación" explícita que contraste ambos términos.

Reglas:
1. Encuentra máximo 3 pares de conceptos altamente confundibles.
2. Si no hay ninguno verdaderamente confundible, devuelve un array vacío [].
3. Responde ÚNICAMENTE con un JSON array válido.

Formato esperado:
[
  {
    "conceptA": "Nombre del Concepto 1",
    "conceptB": "Nombre del Concepto 2",
    "reason": "Explicación breve de por qué el estudiante podría confundirlos",
    "cardIds": ["ID_1", "ID_2"]
  }
]`;

    try {
      const response = await ModelClass.generate(
        [{ role: 'user', content: `Analiza estas tarjetas:\n${deckKnowledgeModel.toJSON()}` }],
        systemPrompt,
        { temperature: 0.1, max_tokens: 1024 }
      );

      const raw = response.content.trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        console.warn('[ConfusionDetector] El LLM no devolvió un array JSON válido. Retornando vacío.');
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[ConfusionDetector] Error al detectar confusiones:', err.message);
      return [];
    }
  }
}

module.exports = ConfusionDetector;
