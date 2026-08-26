const FlashcardCapability = require('../services/ai/capabilities/FlashcardCapability');
const GenerateFlashcardsRequest = require('../services/ai/contracts/GenerateFlashcardsRequest');
const { resolveModelPreferenceFromRequest } = require('../utils/modelRegistry');

exports.generateFlashcards = async (req, res) => {
  try {
    const provider = req.body.provider || 'groq';

    if (provider === 'local') {
      return res.status(400).json({ error: 'El proveedor local se ejecuta en el dispositivo. No se puede resolver en el servidor.' });
    }

    const modelPreference = resolveModelPreferenceFromRequest(req, provider);

    const request = new GenerateFlashcardsRequest({
      mode: req.body.mode || 'mixed',
      count: req.body.count || 10,
      title: req.body.title || 'Mazo Generado',
      topic: req.body.topic,
      subjectId: req.body.subject_id,
      userId: req.user.id,
      provider,
      modelPreference,
      items: req.body.items || []
    });

    if (!request.isValid()) {
      return res.status(400).json({ error: 'Faltan campos requeridos (title, subject_id).' });
    }

    const aggregate = await FlashcardCapability.handle(request);
    
    res.json({
      message: 'Mazo generado exitosamente',
      deck: aggregate
    });
  } catch (err) {
    console.error('[flashcardController] Error generando mazo:', err);
    res.status(500).json({ error: err.message || 'Error interno generando flashcards' });
  }
};
