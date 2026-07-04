const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/assessmentCategoriesController');

/**
 * @swagger
 * /api/subjects/{subjectId}/categories:
 *   get:
 *     summary: Obtiene todas las categorías de evaluación de una materia
 *     tags: [Assessment Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de categorías
 */
router.get('/subjects/:subjectId/categories', categoriesController.getCategoriesBySubject);

/**
 * @swagger
 * /api/subjects/{subjectId}/categories:
 *   post:
 *     summary: Crea una nueva categoría de evaluación
 *     tags: [Assessment Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               weight:
 *                 type: number
 *               drop_lowest:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Categoría creada
 *       400:
 *         description: Datos inválidos
 */
router.post('/subjects/:subjectId/categories', categoriesController.createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Actualiza una categoría de evaluación
 *     tags: [Assessment Categories]
 *     security:
 *       - bearerAuth: []
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
 *               name:
 *                 type: string
 *               weight:
 *                 type: number
 *               drop_lowest:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Categoría actualizada
 *       404:
 *         description: Categoría no encontrada
 */
router.put('/categories/:id', categoriesController.updateCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Elimina una categoría de evaluación
 *     tags: [Assessment Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoría eliminada
 *       404:
 *         description: Categoría no encontrada
 */
router.delete('/categories/:id', categoriesController.deleteCategory);

module.exports = router;
