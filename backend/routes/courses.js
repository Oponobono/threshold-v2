const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/coursesController');

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Obtiene todos los cursos del usuario autenticado
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cursos
 *       401:
 *         description: No autorizado
 */
router.get('/courses', coursesController.getCourses);

/**
 * @swagger
 * /api/courses/{courseId}:
 *   get:
 *     summary: Obtiene un curso por ID
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Datos del curso
 *       404:
 *         description: Curso no encontrado
 */
router.get('/courses/:courseId', coursesController.getCourseById);

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Crea un nuevo curso
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
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
 *               platform:
 *                 type: string
 *               instructor:
 *                 type: string
 *               total_hours:
 *                 type: integer
 *               total_classes:
 *                 type: integer
 *               main_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Curso creado
 *       400:
 *         description: Datos inválidos
 */
router.post('/courses', coursesController.createCourse);

/**
 * @swagger
 * /api/courses/{courseId}:
 *   put:
 *     summary: Actualiza un curso
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
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
 *               platform:
 *                 type: string
 *               instructor:
 *                 type: string
 *               total_hours:
 *                 type: integer
 *               completed_classes:
 *                 type: integer
 *               status:
 *                 type: string
 *               sync_version:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Curso actualizado
 *       404:
 *         description: Curso no encontrado
 *       409:
 *         description: Conflicto de versión (stale sync_version)
 */
router.put('/courses/:courseId', coursesController.updateCourse);

/**
 * @swagger
 * /api/courses/{courseId}:
 *   delete:
 *     summary: Elimina un curso
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Curso eliminado
 *       404:
 *         description: Curso no encontrado
 */
router.delete('/courses/:courseId', coursesController.deleteCourse);

module.exports = router;
