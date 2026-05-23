const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

/**
 * @swagger
 * /api/track-guest:
 *   post:
 *     summary: Registra o actualiza la visita de un dispositivo invitado
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_id
 *             properties:
 *               device_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Visita registrada
 */
router.post('/track-guest', analyticsController.trackGuest);

// Learning Engineering Analytics
router.get('/analytics/mastery/:userId/:subjectId', analyticsController.getMastery);
router.get('/analytics/predictions/:userId', analyticsController.getReviewPredictions);
router.get('/analytics/report/:userId', analyticsController.generateReport);
router.get('/analytics/global/gpa/:userId', analyticsController.getGlobalGPAAnalytics);

/**
 * @swagger
 * /api/analytics/user-stats/{userId}:
 *   get:
 *     summary: Obtiene estadísticas globales del usuario
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Estadísticas globales incluye mastery, decks, cards, actividad reciente
 *       400:
 *         description: userId requerido
 */
router.get('/analytics/user-stats/:userId', analyticsController.getUserStats);

/**
 * @swagger
 * /api/analytics/deck-stats/{deckId}/{userId}:
 *   get:
 *     summary: Obtiene estadísticas detalladas de un mazo
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estadísticas del mazo con tarjetas difíciles y tendencia
 *       400:
 *         description: Parámetros requeridos
 */
router.get('/analytics/deck-stats/:deckId/:userId', analyticsController.getDeckStats);

/**
 * @swagger
 * /api/analytics/progress-trends/{userId}:
 *   get:
 *     summary: Obtiene tendencia de progreso temporal del usuario
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Número de días a analizar (7-365)
 *     responses:
 *       200:
 *         description: Tendencia diaria, timeline de tarjetas, progreso por sujeto
 *       400:
 *         description: userId requerido
 */
router.get('/analytics/progress-trends/:userId', analyticsController.getProgressTrends);

module.exports = router;
