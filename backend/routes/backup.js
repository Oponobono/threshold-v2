const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');

/**
 * GET /api/backup/stats
 * Estadísticas de backup: cuántos ítems hay vs cuántos están en la nube.
 */
router.get('/backup/stats', backupController.getBackupStats);

/**
 * GET /api/backup/pending
 * Lista de ítems no respaldados agrupados por tipo (fotos, audio, docs, transcripts).
 */
router.get('/backup/pending', backupController.getPendingItems);

/**
 * POST /api/backup/mark
 * Marca un ítem como respaldado y guarda su URL de Uploadthing.
 * Body: { type, id, cloud_url, transcript_type? }
 */
router.post('/backup/mark', backupController.markAsBackedUp);

/**
 * GET /api/backup/cloud-items
 * Lista todos los ítems respaldados en la nube para este usuario.
 * Usado para sincronizar/descargar en un dispositivo nuevo.
 */
router.get('/backup/cloud-items', backupController.getCloudItems);

module.exports = router;
