/**
 * AnchorValidator
 * Stage determinístico del pipeline de generación de anclas.
 *
 * Responsabilidad única: validar que el AnchorDraft producido por
 * AnchorContentGenerator tiene los campos mínimos necesarios (front y back).
 * No hace SQL ni habla con el LLM.
 *
 * Regla 10: este Stage nunca invoca otro Stage directamente.
 */
class AnchorValidator {
  /**
   * @param {{ front: string, back: string, hint: string|null, explanation: string|null }} draft
   * @returns {{ front: string, back: string, hint: string|null, explanation: string|null }}
   * @throws {Error} Si front o back están vacíos.
   */
  static validate(draft) {
    const front = (draft.front || '').trim();
    const back = (draft.back || '').trim();

    if (!front) {
      throw new Error('AnchorValidator: el campo "front" no puede estar vacío. La IA no generó una pregunta válida.');
    }

    if (!back) {
      throw new Error('AnchorValidator: el campo "back" no puede estar vacío. La IA no generó una respuesta válida.');
    }

    return {
      front,
      back,
      hint: draft.hint || null,
      explanation: draft.explanation || null,
    };
  }
}

module.exports = AnchorValidator;
