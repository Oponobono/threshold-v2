const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Chatea con Zyren usando contexto
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context_text:
 *                 type: string
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *               session_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Respuesta de Zyren
 */
router.post('/ai/chat', aiController.aiChat);

/**
 * @swagger
 * /api/ai/chat/history/{userId}/{subjectId}:
 *   get:
 *     summary: Obtiene el historial de chat de una materia
 *     tags: [AI]
 */
router.get('/ai/chat/history/:userId/:subjectId', aiController.getChatHistory);

/**
 * @swagger
 * /api/ai/chat/clear/{userId}/{subjectId}:
 *   post:
 *     summary: Limpia el historial de chat (crea nueva sesión)
 *     tags: [AI]
 */
router.post('/ai/chat/clear/:userId/:subjectId', aiController.clearChatHistory);

/**
 * @swagger
 * /api/ai/build-context:
 *   post:
 *     summary: Construye un contexto de texto a partir de múltiples recursos seleccionados
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     type:
 *                       type: string
 *                     label:
 *                       type: string
 *     responses:
 *       200:
 *         description: Contexto construido exitosamente
 */
router.post('/ai/build-context', aiController.buildContext);

/**
 * @swagger
 * /api/ai/generate-flashcards:
 *   post:
 *     summary: Genera flashcards (pregunta/respuesta) desde un texto de contexto académico usando Groq LLaMA
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - context_text
 *             properties:
 *               context_text:
 *                 type: string
 *               count:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Array de flashcards generadas
 */
router.post('/ai/generate-flashcards', aiController.generateFlashcards);

/**
 * @swagger
 * /api/ai/process-document:
 *   post:
 *     summary: Procesa un documento completo (PDF, Word, TXT) con Gemini Files API
 *     description: |
 *       Sin truncado de contexto - procesa documentos completos.
 *       
 *       **Formatos soportados**: PDF, Word (.docx, .doc), TXT, HTML, Markdown
 *       
 *       **Ideal para**: Análisis de documentos, resúmenes, extracción de información, Q&A
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentPath, prompt]
 *             properties:
 *               documentPath:
 *                 type: string
 *                 example: "/uploads/documento.pdf"
 *                 description: Ruta local al archivo
 *               mimeType:
 *                 type: string
 *                 example: "application/pdf"
 *                 description: MIME type (opcional - se auto-detecta)
 *               prompt:
 *                 type: string
 *                 example: "Resume este documento en máximo 500 palabras"
 *                 description: Instrucción para procesar el documento
 *     responses:
 *       200:
 *         description: Documento procesado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: string
 *                   description: Resultado del procesamiento
 *       400:
 *         description: Parámetros faltantes o archivo no válido
 */
router.post('/ai/process-document', aiController.processDocumentWithGemini);

/**
 * @swagger
 * /api/ai/generate-flashcards-from-document:
 *   post:
 *     summary: Genera flashcards de estudio desde un documento (PDF, Word, TXT)
 *     description: |
 *       Crea sets de flashcards automáticamente desde materiales de estudio.
 *       
 *       **Formatos soportados**: PDF, Word (.docx, .doc), TXT, HTML, Markdown
 *       
 *       **Retorna**: Array de { question, answer } optimizados para Active Recall
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentPath]
 *             properties:
 *               documentPath:
 *                 type: string
 *                 example: "/uploads/capitulo.pdf"
 *               mimeType:
 *                 type: string
 *                 example: "application/pdf"
 *                 description: MIME type (opcional - se auto-detecta)
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 10
 *                 description: Número de flashcards a generar
 *     responses:
 *       200:
 *         description: Flashcards generadas exitosamente
 */
router.post('/ai/generate-flashcards-from-document', aiController.generateFlashcardsFromDocument);

/**
 * @swagger
 * /api/ai/model-info:
 *   get:
 *     summary: Obtiene información sobre los modelos disponibles y sus límites
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: Información de modelos (Groq vs Gemini)
 */
router.get('/ai/model-info', aiController.getModelInfo);

module.exports = router;
