const express = require('express');
const router = express.Router();
const subjectsController = require('../controllers/subjectsController');

/**
 * @swagger
 * /api/subject/{subjectId}:
 *   get:
 *     summary: Obtiene una materia específica por su ID
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Datos de la materia
 *       404:
 *         description: Materia no encontrada
 */
router.get('/subject/:subjectId', subjectsController.getSubjectById);

/**
 * @swagger
 * /api/subjects/{userId}:
 *   get:
 *     summary: Obtiene todas las materias de un usuario
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de materias
 */
router.get('/subjects/:userId', subjectsController.getSubjectsByUser);

/**
 * @swagger
 * /api/subjects:
 *   post:
 *     summary: Agrega una nueva materia
 *     tags: [Subjects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - name
 *             properties:
 *               user_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               credits:
 *                 type: integer
 *               professor:
 *                 type: string
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *               target_grade:
 *                 type: number
 *     responses:
 *       201:
 *         description: Materia creada
 *       400:
 *         description: Faltan campos requeridos
 */
router.post('/subjects', subjectsController.createSubject);

/**
 * @swagger
 * /api/subjects/{subjectId}:
 *   delete:
 *     summary: Elimina una materia y sus elementos
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Materia eliminada
 *       500:
 *         description: Error del servidor
 */
router.delete('/subjects/:subjectId', subjectsController.deleteSubject);

/**
 * @swagger
 * /api/subjects/{subjectId}:
 *   put:
 *     summary: Actualiza una materia
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Materia actualizada
 *       404:
 *         description: Materia no encontrada
 */
router.put('/subjects/:subjectId', subjectsController.updateSubject);

module.exports = router;
