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
 * /api/scanned_documents/{documentId}:
 *   put:
 *     summary: Actualiza un documento escaneado (ej. agregar ocr_text)
 *     tags: [Scanned Documents]
 *     parameters:
 *       - in: path
 *         name: documentId
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
 *               name:
 *                 type: string
 *               ocr_text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Documento actualizado exitosamente
 *       404:
 *         description: Documento no encontrado
 */
router.put('/scanned_documents/:documentId', scannedDocumentsController.updateScannedDocument);

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

/**
 * @swagger
 * /api/pdf-extract:
 *   post:
 *     summary: Extrae texto de un archivo PDF codificado en base64
 *     tags: [AI Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - base64Pdf
 *             properties:
 *               base64Pdf:
 *                 type: string
 *     responses:
 *       200:
 *         description: Texto extraído
 */
router.post('/pdf-extract', scannedDocumentsController.extractPDFText);

module.exports = router;
