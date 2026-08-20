const secrets = require('../../../config/secrets');

class GroqProvider {
  /**
   * Ejecuta una inferencia estructurada usando Groq
   */
  static async generate(messages, systemPrompt, options = {}) {
    const groqApiKey = secrets.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('Groq API Key no estÃ¡ configurada');
    }

    const {
      temperature = 0.15,
      max_tokens = 6000,
      model = 'llama-3.1-8b-instant',
      jsonMode = false
    } = options;

    const apiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    
    const requestBody = {
      model,
      messages: apiMessages,
      temperature,
      max_tokens,
    };
    
    if (jsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API Error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      provider: 'groq',
      model
    };
  }
}

module.exports = GroqProvider;

