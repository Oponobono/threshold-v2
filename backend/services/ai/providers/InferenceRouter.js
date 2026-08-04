const GeminiProvider = require('./GeminiProvider');
const GroqProvider = require('./GroqProvider');

/**
 * InferenceRouter
 * Responsabilidad: Enruta peticiones de inferencia hacia el modelo adecuado según su rol
 * (Razonamiento, Generación, Visión, Transcripción, Chat).
 * Es la única capa que sabe que existen Gemini, Llama o Groq.
 */
class InferenceRouter {
  
  /**
   * Obtiene un modelo optimizado para tareas de planificación y razonamiento profundo.
   */
  static getReasoningModel(preferredProvider = 'groq') {
    if (preferredProvider === 'gemini') {
      return GeminiProvider;
    }
    // Default a Groq (Llama-3.3-70b)
    return GroqProvider;
  }

  /**
   * Obtiene un modelo optimizado para generar contenido estructurado rápidamente.
   */
  static getGenerationModel(preferredProvider = 'groq') {
    if (preferredProvider === 'gemini') {
      return GeminiProvider;
    }
    return GroqProvider;
  }

  /**
   * Obtiene un modelo optimizado para interactuar de forma fluida y conversacional.
   */
  static getChatModel(preferredProvider = 'groq') {
    if (preferredProvider === 'gemini') {
      return GeminiProvider;
    }
    return GroqProvider;
  }
}

module.exports = InferenceRouter;
