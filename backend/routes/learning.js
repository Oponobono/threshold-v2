const express = require('express');
const router = express.Router();
const learningController = require('../controllers/learningController');

// ================= STUDY SESSIONS =================

/**
 * @swagger
 * /api/learning/sessions/{userId}:
 *   get:
 *     summary: Obtiene todas las sesiones de estudio de un usuario
 *     tags: [Learning]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de sesiones de estudio
 */
router.get('/learning/sessions/:userId', learningController.getStudySessions);

/**
 * @swagger
 * /api/learning/sessions:
 *   post:
 *     summary: Guarda una nueva sesión de estudio terminada
 *     tags: [Learning]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - session_type
 *               - duration_seconds
 *             properties:
 *               user_id:
 *                 type: integer
 *               subject_id:
 *                 type: integer
 *               session_type:
 *                 type: string
 *               config_value:
 *                 type: string
 *               duration_seconds:
 *                 type: integer
 *               performance_rating:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Sesión de estudio guardada
 */
router.post('/learning/sessions', learningController.createStudySession);

// ================= CARD LOGS =================

/**
 * @swagger
 * /api/learning/card_logs/{userId}:
 *   get:
 *     summary: Obtiene el registro de aprendizaje (logs) de las flashcards
 *     tags: [Learning]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de interacciones con tarjetas
 */
router.get('/learning/card_logs/:userId', learningController.getCardLogs);

/**
 * @swagger
 * /api/learning/card_logs:
 *   post:
 *     summary: Registra la interacción de un usuario con una flashcard (acierto/error)
 *     tags: [Learning]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - card_id
 *               - user_id
 *             properties:
 *               card_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               result:
 *                 type: string
 *               response_time_ms:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Log registrado
 */
router.post('/learning/card_logs', learningController.createCardLog);

// ================= GROUP MEMBERSHIPS =================

/**
 * @swagger
 * /api/learning/groups/{userId}:
 *   get:
 *     summary: Obtiene los grupos a los que pertenece el usuario
 *     tags: [Learning]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de grupos
 */
router.get('/learning/groups/:userId', learningController.getGroups);

/**
 * @swagger
 * /api/learning/groups/join:
 *   post:
 *     summary: Se une a un grupo de estudio mediante un PIN
 *     tags: [Learning]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - group_pin_id
 *             properties:
 *               user_id:
 *                 type: integer
 *               group_pin_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Unido exitosamente
 *       400:
 *         description: Error de validación o ya es miembro
 *       404:
 *         description: PIN no encontrado
 */
router.post('/learning/groups/join', learningController.joinGroup);

/**
 * @swagger
 * /api/learning/groups/leave:
 *   delete:
 *     summary: Sale de un grupo de estudio
 *     tags: [Learning]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - group_pin_id
 *             properties:
 *               user_id:
 *                 type: integer
 *               group_pin_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ha salido del grupo
 */
router.delete('/learning/groups/leave', learningController.leaveGroup);

module.exports = router;
