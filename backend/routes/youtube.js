const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');

/**
 * @swagger
 * /api/youtube-videos/{userId}:
 *   get:
 *     summary: Obtiene todos los videos de YouTube guardados por un usuario
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de videos
 */
router.get('/youtube-videos/:userId', youtubeController.getYoutubeVideos);

/**
 * @swagger
 * /api/youtube-videos:
 *   post:
 *     summary: Guarda un nuevo video de YouTube asociado a una materia
 *     tags: [YouTube]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - youtube_url
 *               - video_id
 *             properties:
 *               user_id:
 *                 type: integer
 *               subject_id:
 *                 type: integer
 *               youtube_url:
 *                 type: string
 *               video_id:
 *                 type: string
 *               title:
 *                 type: string
 *               thumbnail_url:
 *                 type: string
 *               duration:
 *                 type: string
 *     responses:
 *       201:
 *         description: Video guardado exitosamente
 */
router.post('/youtube-videos', youtubeController.createYoutubeVideo);

/**
 * @swagger
 * /api/youtube-videos/{id}:
 *   put:
 *     summary: Actualiza la información de un video guardado
 *     tags: [YouTube]
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
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Video actualizado
 */
router.put('/youtube-videos/:id', youtubeController.updateYoutubeVideo);

/**
 * @swagger
 * /api/youtube-videos/{id}:
 *   delete:
 *     summary: Elimina un video de la biblioteca
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Video eliminado
 */
router.delete('/youtube-videos/:id', youtubeController.deleteYoutubeVideo);

/**
 * @swagger
 * /api/youtube-captions:
 *   post:
 *     summary: Extrae los subtítulos de un video de YouTube usando Supadata.ai
 *     tags: [AI Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - video_id
 *             properties:
 *               video_id:
 *                 type: string
 *               language:
 *                 type: string
 *                 default: es
 *     responses:
 *       200:
 *         description: Subtítulos extraídos
 *       404:
 *         description: Subtítulos no encontrados
 */
router.post('/youtube-captions', youtubeController.getYoutubeCaptions);

/**
 * @swagger
 * /api/youtube-transcripts:
 *   post:
 *     summary: Guarda o actualiza los metadatos locales de transcripción o resumen de IA
 *     tags: [YouTube]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - video_id
 *             properties:
 *               video_id:
 *                 type: integer
 *               transcript_uri:
 *                 type: string
 *               summary_uri:
 *                 type: string
 *     responses:
 *       200:
 *         description: Metadatos actualizados o creados
 */
router.post('/youtube-transcripts', youtubeController.upsertYoutubeTranscript);

module.exports = router;
