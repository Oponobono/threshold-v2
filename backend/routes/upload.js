const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');

// Multer permisivo para esta ruta: acepta imágenes, audio y documentos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 }, // 64 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}`));
    }
  },
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Sube un archivo a Uploadthing y devuelve la URL permanente
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL permanente del archivo subido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 key:
 *                   type: string
 */
router.post('/upload', upload.single('file'), uploadController.uploadFile);

/**
 * @swagger
 * /api/upload/{key}:
 *   delete:
 *     summary: Elimina un archivo de Uploadthing por su key
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Archivo eliminado
 */
router.delete('/upload/:key', uploadController.deleteFile);

module.exports = router;
