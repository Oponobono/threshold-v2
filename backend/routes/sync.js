const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

/**
 * @swagger
 * /api/sync/initial:
 *   get:
 *     summary: Initial Sync — descarga completa de todas las entidades del usuario
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto con todas las entidades del usuario (subjects, courses, assessments, etc.)
 *       401:
 *         description: No autorizado
 */
router.get('/sync/initial', syncController.initialSync);

/**
 * @swagger
 * /api/sync:
 *   get:
 *     summary: Delta Sync — sincronización incremental desde una versión
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Objeto con updated, deleted y _syncVersion
 *       400:
 *         description: Parámetro version requerido
 */
router.get('/sync', syncController.deltaSync);

module.exports = router;
