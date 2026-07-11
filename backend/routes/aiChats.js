const express = require('express');
const router = express.Router();
const aiChatsController = require('../controllers/aiChatsController');

/**
 * @swagger
 * /api/ai-chats/{userId}:
 *   get:
 *     summary: Obtiene todos los chats de un usuario
 *     tags: [AIChats]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de chats
 */
router.get('/ai-chats/:userId', aiChatsController.getAiChats);

/**
 * @swagger
 * /api/ai-chats:
 *   post:
 *     summary: Guarda un nuevo mensaje de chat
 *     tags: [AIChats]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - role
 *               - content
 *             properties:
 *               user_id:
 *                 type: integer
 *               subject_id:
 *                 type: integer
 *               role:
 *                 type: string
 *               content:
 *                 type: string
 *               cloud_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chat guardado exitosamente
 */
router.post('/ai-chats', aiChatsController.createAiChat);

/**
 * @swagger
 * /api/ai-chats/{id}:
 *   put:
 *     summary: Actualiza la información de un chat guardado
 *     tags: [AIChats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject_id:
 *                 type: integer
 *               role:
 *                 type: string
 *               content:
 *                 type: string
 *               cloud_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chat actualizado
 */
router.put('/ai-chats/:id', aiChatsController.updateAiChat);

/**
 * @swagger
 * /api/ai-chats/{id}:
 *   delete:
 *     summary: Elimina un mensaje de chat
 *     tags: [AIChats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat eliminado
 */
router.delete('/ai-chats/:id', aiChatsController.deleteAiChat);

module.exports = router;
