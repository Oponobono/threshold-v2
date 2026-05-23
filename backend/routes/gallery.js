const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');

/**
 * @swagger
 * /api/gallery/{userId}:
 *   get:
 *     summary: Obtiene todos los ítems de la galería de un usuario
 *     tags: [Gallery]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de ítems de la galería
 */
router.get('/gallery/:userId', galleryController.getGalleryItems);

/**
 * @swagger
 * /api/gallery:
 *   post:
 *     summary: Agrega un nuevo ítem a la galería
 *     tags: [Gallery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - uri
 *             properties:
 *               user_id:
 *                 type: integer
 *               uri:
 *                 type: string
 *               subject:
 *                 type: string
 *               date:
 *                 type: string
 *               time:
 *                 type: string
 *               ocr_text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ítem agregado
 */
router.post('/gallery', galleryController.addGalleryItem);

// --- PHOTOS ENDPOINTS ---

/**
 * @swagger
 * /api/photos/{subjectId}/search:
 *   get:
 *     summary: Buscar fotos por tag/palabra clave
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de fotos con el tag
 */
router.get('/photos/:subjectId/search', galleryController.searchPhotosByTag);

/**
 * @swagger
 * /api/photos/{subjectId}:
 *   get:
 *     summary: Obtiene todas las fotos de una materia
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de fotos
 */
router.get('/photos/:subjectId', galleryController.getPhotosBySubject);

/**
 * @swagger
 * /api/photos:
 *   post:
 *     summary: Guarda una nueva foto de una materia
 *     tags: [Photos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject_id
 *               - local_uri
 *             properties:
 *               subject_id:
 *                 type: integer
 *               local_uri:
 *                 type: string
 *               es_favorita:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Foto guardada
 */
router.post('/photos', galleryController.savePhoto);

/**
 * @swagger
 * /api/photos/{photoId}/favorite:
 *   patch:
 *     summary: Marca o desmarca una foto como favorita
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: photoId
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
 *               es_favorita:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Estado de favorita actualizado
 */
router.patch('/photos/:photoId/favorite', galleryController.toggleFavoritePhoto);

/**
 * @swagger
 * /api/photos/{photoId}:
 *   put:
 *     summary: "Actualiza una foto (ej: OCR extraído posteriormente)"
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: photoId
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
 *               ocr_text:
 *                 type: string
 *               es_favorita:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Foto actualizada
 */
router.put('/photos/:photoId', galleryController.updatePhoto);

/**
 * @swagger
 * /api/photos/{photoId}:
 *   delete:
 *     summary: Elimina una foto
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Foto eliminada
 */
router.delete('/photos/:photoId', galleryController.deletePhoto);

module.exports = router;
