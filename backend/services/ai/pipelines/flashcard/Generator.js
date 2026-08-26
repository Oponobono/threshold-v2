const InferenceRouter = require('../../providers/InferenceRouter');
const FlashcardResponseParser = require('./FlashcardResponseParser');

/**
 * Generator
 * Convierte un KnowledgeModel + DeckPlan en las tarjetas finales.
 * Usa los mismos prompts de producción que el legacy aiController.generateStudyMaterial.
 */
class Generator {
  static async generate(evaluationReport, knowledgeModel, request) {
    const { plan } = evaluationReport;
    const ModelClass = InferenceRouter.getGenerationModel(request.provider);
    const { mode, count } = plan;

    const modeInstructions = {
      flashcard: `Genera exactamente ${count} FLASHCARDS.
- Front: Pregunta conceptual desafiante.
- Back: Respuesta precisa y técnica (máximo 2-3 oraciones).
- Hint: Pista que active el recuerdo (ej. "Considera el factor Z"), no letras iniciales.
- Explanation: Profundiza en el concepto con el "por qué" fundamental o un ejemplo.
- Direction: Si el concepto se puede aprender en ambos sentidos (vocabulario, idiomas, anatomía) usa "bidirectional". De lo contrario, "forward".
Esquema: { "type": "flashcard", "data": { "front": "...", "back": "..." }, "hint": "...", "explanation": "...", "direction": "forward" }`,

      multiple_choice: `Genera exactamente ${count} PREGUNTAS DE SELECCIÓN MÚLTIPLE.
- Opciones: Exactamente 4 opciones con contenido semántico ÚNICO y diferenciado.
- Distractores: Deben nacer de un error de razonamiento específico.
- Explanation: Explica la validez de la correcta y la falla lógica de los distractores.
Esquema: { "type": "multiple_choice", "data": { "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": N }, "hint": "...", "explanation": "..." }`,

      boolean: `Genera exactamente ${count} PREGUNTAS DE VERDADERO O FALSO.
- Question: Afirmación con matices técnicos que desafíe la comprensión obvia.
- Explanation: Justifica la veracidad/falsedad con un argumento sólido.
Esquema: { "type": "boolean", "data": { "question": "...", "correctAnswer": true }, "hint": "...", "explanation": "..." }`,

      mixed: `Genera exactamente ${count} ÍTEMS MIXTOS (40% Flashcard, 40% Selección Múltiple, 20% V/F).
Usa estrictamente estos esquemas:
1. Flashcard: { "type": "flashcard", "data": { "front": "...", "back": "..." }, "hint": "...", "explanation": "...", "direction": "forward" }
2. Selección Múltiple: { "type": "multiple_choice", "data": { "question": "...", "options": ["A","B","C","D"], "correctIndex": N }, "hint": "...", "explanation": "..." }
3. Verdadero/Falso: { "type": "boolean", "data": { "question": "...", "correctAnswer": true }, "hint": "...", "explanation": "..." }`,
    };

    const systemPrompt = `Eres Zyren, experto en pedagogía universitaria y diseño instruccional. Tu misión es transformar contenido en material de ALTO RENDIMIENTO.

REGLAS DE ORO:
1. RIGOR: Usa terminología técnica precisa del texto.
2. NO CIRCULARIDAD: La explicación JAMÁS debe ser una paráfrasis de la pregunta. Debe explicar el "por qué" fundamental.
3. PISTAS ESTRATÉGICAS: El 'hint' debe ser un andamiaje cognitivo (ruta de pensamiento), no una respuesta parcial.
4. DISTRACTORES DE CALIDAD: Cada opción incorrecta debe nacer de un error de razonamiento específico.
5. FORMATO DE CÓDIGO: Si el tema involucra programación o comandos, usa bloques de código Markdown dentro de los campos.

${modeInstructions[mode] || modeInstructions.mixed}
${FlashcardResponseParser.TOPIC_FORMAT_INSTRUCTION}
${FlashcardResponseParser.TOPIC_PROMPT_INSTRUCTION}`;

    const userContent = !knowledgeModel.IsEmpty
      ? `Genera el material de estudio basado en este contenido académico:\n\n${knowledgeModel.truncate(8000)}`
      : `Genera el material de estudio sobre el tema solicitado.`;

    // Un token = aprox 3-4 caracteres.
    // Calculamos los tokens de entrada para no exceder el límite duro de 8000 TPM de la API gratuita.
    const estimatedInputTokens = Math.ceil((userContent.length + systemPrompt.length) / 3.5);
    const safeMaxTokens = Math.max(1500, 8000 - estimatedInputTokens - 200); // 200 de margen
    const generationOptions = { temperature: 0.15, max_tokens: safeMaxTokens, allowReasoningModels: false };

    try {
      const response = await ModelClass.generate(
        [{ role: 'user', content: userContent }],
        systemPrompt,
        generationOptions
      );

      const raw = response.content.trim();
      try {
        return FlashcardResponseParser.parseTopicAndCards(raw);
      } catch (parseErr) {
        console.error(`[Generator] Parse falló (model=${response.model}, provider=${response.provider}, tokens=${safeMaxTokens}): ${parseErr.message}`);
        throw parseErr;
      }
    } catch (err) {
      console.error('[Generator] Error con proveedor:', err.message);
      throw err;
    }
  }
}

module.exports = Generator;
