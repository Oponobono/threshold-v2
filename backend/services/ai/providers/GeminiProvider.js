const geminiService = require('../../../utils/geminiService');
const secrets = require('../../../config/secrets');
const { GoogleGenAI } = require('@google/genai');
const { MODEL_DEFAULTS, applySamplingPolicy } = require('../../../utils/modelRegistry');

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

class GeminiProvider {
  static async generate(messages, systemPrompt, options = {}) {
    const { temperature = 0.15, max_tokens = 8000 } = options;
    const apiKey = secrets.GEMINI_API_KEY;
    if (!apiKey) throw new Error('[GeminiProvider] GEMINI_API_KEY no configurada');

    try {
      const genAI = new GoogleGenAI({ apiKey });
      const modelName = options.model || MODEL_DEFAULTS.gemini;
      // La politica de muestreo la decide el registry segun el modelo
      // concreto, no el llamador. Aqui se aplica y no en cada ruta, para que
      // ningun camino productiveo pueda saltarsela por descuido.
      const sampling = applySamplingPolicy(modelName, { temperature });
      
      const userContent = messages.map(m => m.content).join('\n\n');
      
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: userContent,
        config: {
          systemInstruction: systemPrompt,
          safetySettings: SAFETY_SETTINGS,
          ...sampling,
          maxOutputTokens: max_tokens,
          responseMimeType: 'application/json',
        }
      });
      
      const responseText = result.text;

      return {
        content: responseText,
        provider: 'gemini',
        model: modelName,
      };
    } catch (error) {
      throw new Error(`[GeminiProvider] ${error.message}`);
    }
  }
}

module.exports = GeminiProvider;
