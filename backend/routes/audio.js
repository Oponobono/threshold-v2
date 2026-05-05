const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');

/**
 * @swagger
 * /api/audio-recordings/{userId}:
 *   get:
 *     summary: Obtiene todas las grabaciones de audio de un usuario
 *     tags: [Audio]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de grabaciones
 */
router.get('/audio-recordings/:userId', audioController.getAudioRecordings);

/**
 * @swagger
 * /api/audio-recordings:
 *   post:
 *     summary: Guarda una nueva grabación de audio
 *     tags: [Audio]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - local_uri
 *             properties:
 *               user_id:
 *                 type: integer
 *               subject_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               local_uri:
 *                 type: string
 *               duration:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Grabación guardada exitosamente
 */
router.post('/audio-recordings', audioController.createAudioRecording);

/**
 * @swagger
 * /api/audio-recordings/{id}:
 *   put:
 *     summary: Actualiza una grabación de audio (ej. asociar materia)
 *     tags: [Audio]
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
 *     responses:
 *       200:
 *         description: Grabación actualizada exitosamente
 *       500:
 *         description: Error interno
 */
router.put('/audio-recordings/:id', audioController.updateAudioRecording);

/**
 * @swagger
 * /api/audio-recordings/{id}:
 *   delete:
 *     summary: Elimina una grabación de audio
 *     tags: [Audio]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Grabación eliminada exitosamente
 *       500:
 *         description: Error interno
 */
router.delete('/audio-recordings/:id', audioController.deleteAudioRecording);

/**
 * @swagger
 * /api/audio-transcripts:
 *   post:
 *     summary: Guarda o actualiza la transcripción y el resumen de IA de una grabación
 *     tags: [Audio]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recording_id
 *             properties:
 *               recording_id:
 *                 type: integer
 *               transcript_uri:
 *                 type: string
 *               summary_uri:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transcripción/resumen actualizado
 *       201:
 *         description: Transcripción/resumen creado
 */
router.post('/audio-transcripts', audioController.upsertAudioTranscript);

module.exports = router;
