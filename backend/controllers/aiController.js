/**
 * Chat con el tutor IA usando contexto de la materia (Groq)
 */
exports.aiChat = async (req, res) => {
  const { context_text, messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Falta el array de mensajes.' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ error: 'Groq API Key no está configurada' });
  }

  const systemMessage = {
    role: 'system',
    content: `Eres "Threshold AI", un tutor académico personal experto y paciente. 
Tu objetivo es responder a las preguntas del estudiante basándote PRINCIPALMENTE en el siguiente material de sus clases (transcripciones, apuntes, documentos).

REGLAS:
1. Usa el contexto proporcionado para fundamentar tus respuestas.
2. Si la respuesta a la pregunta no se encuentra en el contexto, puedes usar tu conocimiento general para ayudar al estudiante, pero debes aclarar que esa información extra no proviene de sus apuntes.
3. Sé didáctico, claro y estructurado (usa viñetas si es necesario).
4. Mantén un tono alentador y profesional.

--- CONTEXTO DE LA MATERIA ---
${context_text || 'El estudiante no proporcionó contexto específico para esta consulta.'}
------------------------------`
  };

  const apiMessages = [systemMessage, ...messages];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: apiMessages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: 'Error al llamar a Groq API', details: errorData });
    }

    const groqData = await response.json();
    const reply = groqData.choices[0].message;

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Error en el chat de IA', details: err.message });
  }
};
