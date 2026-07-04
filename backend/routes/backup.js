const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');

/**
 * @swagger
 * /api/backup/stats:
 *   get:
 *     summary: Estadísticas de backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de ítems respaldados vs totales
 */
router.get('/backup/stats', backupController.getBackupStats);

/**
 * @swagger
 * /api/backup/pending:
 *   get:
 *     summary: Ítems pendientes de respaldo
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ítems no respaldados agrupados por tipo
 */
router.get('/backup/pending', backupController.getPendingItems);

/**
 * @swagger
 * /api/backup/mark:
 *   post:
 *     summary: Marca un ítem como respaldado
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - id
 *             properties:
 *               type:
 *                 type: string
 *                 description: Tipo de ítem (photo, audio, document, transcript)
 *               id:
 *                 type: string
 *               cloud_url:
 *                 type: string
 *               transcript_type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ítem marcado como respaldado
 */
router.post('/backup/mark', backupController.markAsBackedUp);

/**
 * @swagger
 * /api/backup/cloud-items:
 *   get:
 *     summary: Lista todos los ítems respaldados en la nube
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ítems en la nube
 */
router.get('/backup/cloud-items', backupController.getCloudItems);

/**
 * @swagger
 * /api/backup/restore-local-uri:
 *   post:
 *     summary: Actualiza la URI local de un ítem restaurado
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - id
 *               - local_uri
 *             properties:
 *               type:
 *                 type: string
 *               id:
 *                 type: string
 *               local_uri:
 *                 type: string
 *     responses:
 *       200:
 *         description: URI local actualizada
 */
router.post('/backup/restore-local-uri', backupController.restoreLocalUri);

module.exports = router;
