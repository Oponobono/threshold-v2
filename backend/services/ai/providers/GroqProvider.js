const secrets = require('../../../config/secrets');
const { MODEL_DEFAULTS, GROQ_PRIORITY_LIST } = require('../../../utils/modelRegistry');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function isModelNotFoundError(errorData) {
  const msg = errorData?.error?.message || '';
  return errorData?.error?.code === 'model_not_found'
    || msg.includes('does not exist')
    || msg.includes('not found')
    || msg.includes('decommissioned');
}

class GroqProvider {
  /**
   * Ejecuta una inferencia estructurada usando Groq.
   * Si el modelo solicitado no existe, hace retry sobre GROQ_PRIORITY_LIST.
   */
  static async generate(messages, systemPrompt, options = {}) {
    const groqApiKey = secrets.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('Groq API Key no está configurada');
    }

    const {
      temperature = 0.15,
      max_tokens = 3000,
      model = MODEL_DEFAULTS.groq,
      jsonMode = false
    } = options;

    const apiMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    const buildBody = (candidateModel) => {
      const body = {
        model: candidateModel,
        messages: apiMessages,
        temperature,
        max_tokens,
      };
      if (jsonMode) body.response_format = { type: 'json_object' };
      return body;
    };

    // Construir secuencia: modelo solicitado primero, luego el resto de la priority list
    const toTry = [model, ...GROQ_PRIORITY_LIST.filter(m => m !== model)];

    let lastError = null;
    for (const candidate of toTry) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildBody(candidate)),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (isModelNotFoundError(errorData)) {
            console.warn(`[GroqProvider] Modelo ${candidate} no disponible, probando siguiente...`);
            lastError = new Error(`Groq API Error: ${JSON.stringify(errorData)}`);
            continue;
          }
          throw new Error(`Groq API Error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return {
          content: data.choices[0].message.content,
          provider: 'groq',
          model: candidate,
        };
      } catch (err) {
        // Si ya fue lanzado por nosotros o es un error de red real, propagarlo
        if (err.message?.startsWith('Groq API Error') && isModelNotFoundError(JSON.parse(err.message.replace('Groq API Error: ', '') || '{}'))) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('[GroqProvider] Todos los modelos Groq fallaron.');
  }
}

module.exports = GroqProvider;
