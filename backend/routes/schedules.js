const express = require('express');
const router = express.Router();
const schedulesController = require('../controllers/schedulesController');

/**
 * @swagger
 * /api/prediction/{userId}:
 *   get:
 *     summary: Predice la materia actual de un usuario basándose en su horario y la hora actual
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Materia actual o nulo si no hay clases en este momento
 */
router.get('/prediction/:userId', schedulesController.getCurrentSubjectPrediction);

/**
 * @swagger
 * /api/schedules/today/{userId}:
 *   get:
 *     summary: Obtiene todos los horarios programados para el día actual
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de clases para hoy
 */
router.get('/schedules/today/:userId', schedulesController.getTodaySchedules);

/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: Agrega un horario a una materia
 *     tags: [Schedules]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject_id
 *               - day_of_week
 *               - start_time
 *               - end_time
 *             properties:
 *               subject_id:
 *                 type: integer
 *               day_of_week:
 *                 type: integer
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *     responses:
 *       201:
 *         description: Horario agregado
 */
router.post('/schedules', schedulesController.createSchedule);

/**
 * @swagger
 * /api/schedules/{id}:
 *   delete:
 *     summary: Elimina un bloque de horario
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Horario eliminado
 */
router.delete('/schedules/:id', schedulesController.deleteSchedule);

/**
 * @swagger
 * /api/schedules/subject/{subjectId}:
 *   get:
 *     summary: Obtiene todos los horarios de una materia específica
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de horarios para la materia
 */
router.get('/schedules/subject/:subjectId', schedulesController.getSchedulesBySubject);

/**
 * @swagger
 * /api/schedules/user/{userId}:
 *   get:
 *     summary: Obtiene todos los horarios de todas las materias de un usuario (Vista Semanal)
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista completa de horarios semanales
 */
router.get('/schedules/user/:userId', schedulesController.getSchedulesByUser);

module.exports = router;
