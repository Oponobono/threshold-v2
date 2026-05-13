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

module.exports = router;
