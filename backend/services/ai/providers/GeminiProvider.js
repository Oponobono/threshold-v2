const geminiService = require('../../../utils/geminiService');
const secrets = require('../../../config/secrets');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        systemInstruction: systemPrompt,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          temperature,
          maxOutputTokens: max_tokens,
          responseMimeType: 'application/json',
        },
      });

      const userContent = messages.map(m => m.content).join('\n\n');
      const result = await model.generateContent(userContent);
      const responseText = result.response.text();

      return {
        content: responseText,
        provider: 'gemini',
        model: 'gemini-3.6-flash',
      };
    } catch (error) {
      throw new Error(`[GeminiProvider] ${error.message}`);
    }
  }
}

module.exports = GeminiProvider;
