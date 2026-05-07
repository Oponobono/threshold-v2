const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Chatea con Zyren usando contexto
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
 *               session_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Respuesta de Zyren
 */
router.post('/ai/chat', aiController.aiChat);

/**
 * @swagger
 * /api/ai/chat/history/{userId}/{subjectId}:
 *   get:
 *     summary: Obtiene el historial de chat de una materia
 *     tags: [AI]
 */
router.get('/ai/chat/history/:userId/:subjectId', aiController.getChatHistory);

/**
 * @swagger
 * /api/ai/chat/clear/{userId}/{subjectId}:
 *   post:
 *     summary: Limpia el historial de chat (crea nueva sesión)
 *     tags: [AI]
 */
router.post('/ai/chat/clear/:userId/:subjectId', aiController.clearChatHistory);

/**
 * @swagger
 * /api/ai/build-context:
 *   post:
 *     summary: Construye un contexto de texto a partir de múltiples recursos seleccionados
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     type:
 *                       type: string
 *                     label:
 *                       type: string
 *     responses:
 *       200:
 *         description: Contexto construido exitosamente
 */
router.post('/ai/build-context', aiController.buildContext);

/**
 * @swagger
 * /api/ai/generate-flashcards:
 *   post:
 *     summary: Genera flashcards (pregunta/respuesta) desde un texto de contexto académico usando Groq LLaMA
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - context_text
 *             properties:
 *               context_text:
 *                 type: string
 *               count:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Array de flashcards generadas
 */
router.post('/ai/generate-flashcards', aiController.generateFlashcards);

module.exports = router;
