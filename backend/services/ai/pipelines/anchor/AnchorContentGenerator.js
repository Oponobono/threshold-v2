const InferenceRouter = require('../../providers/InferenceRouter');

/**
 * AnchorContentGenerator
 * Único Stage con LLM en el pipeline de generación de anclas.
 *
 * Responsabilidad: generar contenido pedagógico de contraste (Contrastive Learning)
 * para un par de conceptos confundibles. Devuelve un AnchorDraft.
 *
 * El nombre refleja que genera CONTENIDO pedagógico, no directamente una tarjeta.
 * Mañana existirán AnalogyContentGenerator, MnemonicContentGenerator, etc.
 * Todos generan contenido; ninguno genera directamente un Aggregate.
 *
 * Regla 5: el LLM se accede exclusivamente via InferenceRouter.
 * Regla 6: solo este Stage hace llamadas de red al LLM en este pipeline.
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class AnchorContentGenerator {
  /**
   * @param {{ conceptA: string, conceptB: string, reason: string, provider: string }} spec
   * @returns {Promise<{ front: string, back: string, hint: string|null, explanation: string|null }>}
   */
  static async generate(spec) {
    const ModelClass = InferenceRouter.getGenerationModel(spec.provider);

    const systemPrompt = `Eres un experto en Pedagogía Universitaria.
Te daré dos conceptos que los estudiantes suelen confundir y la razón.
Tu tarea es generar UNA sola flashcard de diferenciación (Contrastive Learning).

- Front: Debe plantear un escenario o pregunta que requiera diferenciar explícitamente entre [Concepto A] y [Concepto B]. (Ej: "¿Cuál es la diferencia clave entre X y Y en el contexto de Z?")
- Back: Respuesta precisa que contraste ambos de manera directa y fácil de recordar.
- Hint: Una regla mnemotécnica o sugerencia rápida para diferenciarlos.
- Explanation: Profundización técnica de por qué son distintos.

Formato requerido EXACTO (JSON Object):
{
  "type": "flashcard",
  "data": { "front": "...", "back": "..." },
  "hint": "...",
  "explanation": "..."
}`;

    const userContent = `Concepto A: ${spec.conceptA}\nConcepto B: ${spec.conceptB}\nRazón de confusión común: ${spec.reason}`;

    try {
      const response = await ModelClass.generate(
        [{ role: 'user', content: userContent }],
        systemPrompt,
        { temperature: 0.3, max_tokens: 1024 }
      );

      const raw = response.content.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('El LLM no devolvió un JSON Object válido.');
      }

      const item = JSON.parse(jsonMatch[0]);

      // Parseo robusto con fallbacks para distintas convenciones de naming del LLM
      const itemData = item.data || item || {};
      const front =
        itemData.front || itemData.question || itemData.pregunta ||
        item.front || item.question || item.pregunta || '';
      const back =
        itemData.back || itemData.answer || itemData.respuesta ||
        item.back || item.answer || item.respuesta || '';

      return {
        front,
        back,
        hint: item.hint || null,
        explanation: item.explanation || null,
      };
    } catch (err) {
      console.error('[AnchorContentGenerator] Error generando contenido:', err.message);
      throw new Error(`AnchorContentGenerator: falló la generación de contenido. ${err.message}`);
    }
  }
}

module.exports = AnchorContentGenerator;
