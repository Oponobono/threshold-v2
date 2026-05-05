const express = require('express');
const router = express.Router();
const scannedDocumentsController = require('../controllers/scannedDocumentsController');

/**
 * @swagger
 * /api/scanned_documents/subject/{subjectId}:
 *   get:
 *     summary: Obtiene los documentos escaneados de una materia
 *     tags: [Scanned Documents]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de documentos escaneados
 */
router.get('/scanned_documents/subject/:subjectId', scannedDocumentsController.getScannedDocumentsBySubject);

/**
 * @swagger
 * /api/scanned_documents:
 *   post:
 *     summary: Guarda un nuevo documento escaneado
 *     tags: [Scanned Documents]
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
 *     responses:
 *       201:
 *         description: Documento escaneado registrado
 */
router.post('/scanned_documents', scannedDocumentsController.saveScannedDocument);

/**
 * @swagger
 * /api/scanned_documents/{documentId}:
 *   delete:
 *     summary: Elimina un documento escaneado
 *     tags: [Scanned Documents]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Documento eliminado
 */
router.delete('/scanned_documents/:documentId', scannedDocumentsController.deleteScannedDocument);

/**
 * @swagger
 * /api/ocr:
 *   post:
 *     summary: Extrae texto de una imagen base64 usando Groq Vision AI
 *     tags: [AI Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - base64Image
 *             properties:
 *               base64Image:
 *                 type: string
 *                 description: Imagen en formato base64 sin el prefijo de data URI
 *     responses:
 *       200:
 *         description: Texto extraído exitosamente
 *       413:
 *         description: La imagen es demasiado grande
 *       500:
 *         description: Error de Groq API
 */
router.post('/ocr', scannedDocumentsController.performOCR);

module.exports = router;
