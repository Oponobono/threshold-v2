const express = require('express');
const router = express.Router();
const assessmentsController = require('../controllers/assessmentsController');

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
 * /api/assessments/analytics/subject/{subjectId}/projection:
 *   get:
 *     summary: Obtiene métricas de proyección de desempeño para una materia
 *     tags: [Assessments]
 *     description: Calcula proyección de nota final usando EMA (Exponential Moving Average), considerando el desempeño actual y la tendencia de aprendizaje.
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Métricas de proyección calculadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subjectId:
 *                   type: integer
 *                 currentAverage:
 *                   type: number
 *                   description: PA - Promedio Actual ponderado
 *                 currentEMA:
 *                   type: number
 *                   description: Tendencia reciente usando EMA (α=0.35)
 *                 projectedGrade:
 *                   type: number
 *                   description: NP - Nota Proyectada final
 *                 delta:
 *                   type: number
 *                   description: Cambio esperado (NP - PA), puede ser positivo o negativo
 *                 evaluatedWeight:
 *                   type: number
 *                   description: Porcentaje evaluado (0-1)
 *                 remainingWeight:
 *                   type: number
 *                   description: Porcentaje pendiente (0-1)
 *                 assessmentCount:
 *                   type: integer
 *                 maxScale:
 *                   type: number
 */
router.get('/assessments/analytics/subject/:subjectId/projection', assessmentsController.getProjectionAnalytics);

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
 * /api/assessments/{id}:
 *   put:
 *     summary: Actualiza una evaluación existente
 *     tags: [Assessments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *               category_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Evaluación actualizada
 */
router.put('/assessments/:id', assessmentsController.updateAssessment);

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
