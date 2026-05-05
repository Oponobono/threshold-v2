const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Chatea con el tutor IA usando contexto
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context_text:
 *                 type: string
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Respuesta del tutor
 */
router.post('/ai/chat', aiController.aiChat);

module.exports = router;
