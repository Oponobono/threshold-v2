const secrets = require('../../../config/secrets');
const { MODEL_DEFAULTS, GROQ_PRIORITY_LIST } = require('../../../utils/modelRegistry');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Modelos que INLINEAN su razonamiento como bloques <think> dentro de
 * `content`, lo que rompe el parsing de JSON estructurado.
 *
 * Verificado contra Groq el 2026-09: los openai/gpt-oss NO deben entrar aquí.
 * Devuelven el razonamiento en un campo `reasoning` aparte y `content` llega
 * limpio, así que encaja en jsonMode sin necesidad de excluirlo. Medido con
 * response_format=json_object: content = {"ciudad":"Madrid"}.
 *
 * Los IDs que hubo aquí (qwen3.6, deepseek-r1-*) están retired en Groq (404 /
 * 400 model_decommissioned), así que se han retirado en lugar de dejarlos
 * como configuracion muerta. Si algún día entra un modelo que sí inlina
 * <think>, se declara aquí por su ID exacto.
 */
const REASONING_MODELS = new Set();

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
   * @param {Object} options
   * @param {boolean} [options.allowReasoningModels=false] - Si es false, excluye modelos de razonamiento
   *   (qwen, deepseek-r1, etc.) del ciclo de retry. Actívalo solo si la tarea puede procesar <think>.
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
      jsonMode = false,
      allowReasoningModels = false,
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

    // Construir secuencia: modelo solicitado primero, luego modelos estándar.
    // Modelos de razonamiento (<think>) solo se incluyen si allowReasoningModels=true;
    // cuando es false (default para generación estructurado), se excluyen porque
    // sus bloques <think> consumen tokens y producen JSON truncado/inparseable.
    const standardFallbacks = GROQ_PRIORITY_LIST.filter(m => m !== model && !REASONING_MODELS.has(m));
    const reasoningFallbacks = allowReasoningModels
      ? GROQ_PRIORITY_LIST.filter(m => m !== model && REASONING_MODELS.has(m))
      : [];
    const toTry = [model, ...standardFallbacks, ...reasoningFallbacks];

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
        if (err.message?.startsWith('Groq API Error')) {
          try {
            const parsed = JSON.parse(err.message.replace('Groq API Error: ', ''));
            if (isModelNotFoundError(parsed)) {
              lastError = err;
              continue;
            }
          } catch (_) { /* no es JSON parseable, propagar */ }
        }
        throw err;
      }
    }

    throw lastError || new Error('[GroqProvider] Todos los modelos Groq fallaron.');
  }
}

module.exports = GroqProvider;
