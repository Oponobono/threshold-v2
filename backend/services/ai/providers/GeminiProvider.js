const geminiService = require('../../../utils/geminiService');

class GeminiProvider {
  /**
   * Ejecuta una inferencia estructurada usando Gemini
   */
  static async generate(messages, systemPrompt, options = {}) {
    const { processAcademicChat } = geminiService;
    
    // Convertir el formato del sistema a la abstracción de processAcademicChat
    try {
      const result = await processAcademicChat(
        '', // contextText ya embebido o manejado externamente
        messages,
        systemPrompt
      );

      return {
        content: result.content,
        provider: 'gemini',
        model: 'gemini-1.5-pro' // u otro configurado en el SDK
      };
    } catch (error) {
      throw new Error(`[GeminiProvider] ${error.message}`);
    }
  }
}

module.exports = GeminiProvider;
