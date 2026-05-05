const express = require('express');
const router = express.Router();
const assessmentsController = require('../controllers/assessmentsController');

/**
 * @swagger
 * /api/assessments/{subjectId}:
 *   get:
 *     summary: Obtiene todas las evaluaciones de una materia
 *     tags: [Assessments]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de evaluaciones
 */
router.get('/assessments/:subjectId', assessmentsController.getAssessmentsBySubject);

/**
 * @swagger
 * /api/assessments/user/{userId}:
 *   get:
 *     summary: Obtiene todas las evaluaciones de todas las materias de un usuario
 *     tags: [Assessments]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de evaluaciones consolidadas
 */
router.get('/assessments/user/:userId', assessmentsController.getAssessmentsByUser);

/**
 * @swagger
 * /api/assessments:
 *   post:
 *     summary: Agrega una nueva evaluación a una materia
 *     tags: [Assessments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject_id
 *               - name
 *             properties:
 *               subject_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               date:
 *                 type: string
 *               weight:
 *                 type: string
 *               out_of:
 *                 type: number
 *               score:
 *                 type: number
 *               percentage:
 *                 type: number
 *               grade_value:
 *                 type: number
 *               is_completed:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Evaluación agregada
 */
router.post('/assessments', assessmentsController.createAssessment);

/**
 * @swagger
 * /api/assessments/{id}:
 *   delete:
 *     summary: Elimina una evaluación
 *     tags: [Assessments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Evaluación eliminada exitosamente
 */
router.delete('/assessments/:id', assessmentsController.deleteAssessment);

module.exports = router;
