const FlashcardCapability = require('../services/ai/capabilities/FlashcardCapability');
const GenerateFlashcardsRequest = require('../services/ai/contracts/GenerateFlashcardsRequest');

exports.generateFlashcards = async (req, res) => {
  try {
    const request = new GenerateFlashcardsRequest({
      mode: req.body.mode || 'mixed',
      count: req.body.count || 10,
      title: req.body.title || 'Mazo Generado',
      topic: req.body.topic,
      subjectId: req.body.subject_id,
      userId: req.user.id,
      provider: req.body.provider || 'groq',
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
