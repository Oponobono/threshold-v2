const express = require('express');
const router = express.Router();
const {
  getGradingSystems,
  getSystemScales,
  normalizeValue,
  createAssessmentResult,
  updateAssessmentResult,
  getResultHistory,
} = require('../controllers/gradingController');

/**
 * @swagger
 * tags:
 *   name: Grading
 *   description: Motor de evaluación desacoplado
 */

// ─── Grading Systems ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/grading-systems:
 *   get:
 *     summary: Lista todos los sistemas de calificación disponibles
 *     tags: [Grading]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de sistemas con su versión activa
 */
router.get('/grading-systems', getGradingSystems);

/**
 * @swagger
 * /api/grading-systems/{id}/scales:
 *   get:
 *     summary: Obtiene las escalas de la versión activa de un sistema
 *     tags: [Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/grading-systems/:id/scales', getSystemScales);

/**
 * @swagger
 * /api/grading-systems/normalize:
 *   post:
 *     summary: Normaliza un raw_value para un sistema dado (sin persistir)
 *     tags: [Grading]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               raw_value:
 *                 type: number
 *               grading_system_id:
 *                 type: integer
 */
router.post('/grading-systems/normalize', normalizeValue);

// ─── Assessment Results ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assessment-results:
 *   post:
 *     summary: Crea un resultado de evaluación con normalized_value congelado
 *     tags: [Grading]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assessment_id, raw_value, grading_system_id]
 *             properties:
 *               assessment_id:
 *                 type: integer
 *               raw_value:
 *                 type: number
 *               grading_system_id:
 *                 type: integer
 */
router.post('/assessment-results', createAssessmentResult);

/**
 * @swagger
 * /api/assessment-results/{id}:
 *   put:
 *     summary: Actualiza un resultado (registra en audit trail)
 *     tags: [Grading]
 *     security:
 *       - bearerAuth: []
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
 *               raw_value:
 *                 type: number
 *               reason:
 *                 type: string
 */
router.put('/assessment-results/:id', updateAssessmentResult);

/**
 * @swagger
 * /api/assessment-results/{id}/history:
 *   get:
 *     summary: Devuelve el audit trail de un resultado (append-only)
 *     tags: [Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/assessment-results/:id/history', getResultHistory);

module.exports = router;
