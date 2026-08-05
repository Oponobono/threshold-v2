const ConfusionDetectionCapability = require('../services/ai/capabilities/ConfusionDetectionCapability');
const AnchorCapability = require('../services/ai/capabilities/AnchorCapability');
const ConfusionDetectionResponseMapper = require('../services/ai/capabilities/ConfusionDetectionResponseMapper');
const AnchorResponseMapper = require('../services/ai/capabilities/AnchorResponseMapper');
const DetectConfusionsRequest = require('../services/ai/contracts/DetectConfusionsRequest');
const GenerateAnchorRequest = require('../services/ai/contracts/GenerateAnchorRequest');

/**
 * anchorController
 * Controller delgado para las operaciones de Anclas Cognitivas.
 *
 * Responsabilidades:
 *   - Extraer parámetros del request HTTP.
 *   - Construir el contrato de entrada correcto.
 *   - Delegar a la Capability.
 *   - Traducir el Aggregate a DTO via Mapper (Regla 9).
 *   - Manejar errores HTTP.
 *
 * Este controller nunca contiene lógica de dominio.
 */

/**
 * GET /api/ai/capabilities/anchor/detect/:deckId
 * Detecta conceptos confundibles en un mazo (Learning Engineering).
 */
exports.detectConfusions = async (req, res) => {
  try {
    const deckId = req.params.deckId;
    const userId = req.user?.id;

    const request = new DetectConfusionsRequest({ deckId, userId });
    const aggregate = await ConfusionDetectionCapability.handle(request);

    res.json(ConfusionDetectionResponseMapper.toResponse(aggregate));
  } catch (error) {
    const status = error.message?.includes('menos de 2 tarjetas') ? 400 : 500;
    console.error('[anchorController] detectConfusions error:', error.message);
    res.status(status).json({ error: error.message || 'Error al analizar el mazo.' });
  }
};

/**
 * POST /api/ai/capabilities/anchor/generate
 * Genera un Ancla Cognitiva y la persiste en el mazo.
 */
exports.generateAnchor = async (req, res) => {
  try {
    const { deckId, conceptA, conceptB, reason, provider } = req.body;
    const userId = req.user?.id;

    const request = new GenerateAnchorRequest({ deckId, userId, conceptA, conceptB, reason, provider });
    const aggregate = await AnchorCapability.handle(request);

    res.status(201).json(AnchorResponseMapper.toResponse(aggregate));
  } catch (error) {
    const status = error.message?.includes('inválido') || error.message?.includes('vacío') ? 400 : 500;
    console.error('[anchorController] generateAnchor error:', error.message);
    res.status(status).json({ error: error.message || 'Error al generar el ancla cognitiva.' });
  }
};
