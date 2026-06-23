const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const { aiLimiter } = require('../middlewares/rateLimiter');
const { validateFileMagicNumber } = require('../middlewares/fileValidator');

// 🚦 Fase 1: Proteger todas las rutas de Inteligencia Artificial con el límite estricto
router.use(aiLimiter);

// Configurar multer para memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/html',
      'text/markdown',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`MIME type ${file.mimetype} no soportado. Soportados: PDF, Word, TXT, HTML, Markdown`));
    }
  },
});

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
 * /api/ai/process-document-upload:
 *   post:
 *     summary: Procesa un documento cargado directamente sin guardar en disco
 *     description: |
 *       Envía el archivo directamente a Gemini para procesamiento.
 *       Soporta: PDF, Word (.docx, .doc), TXT, HTML, Markdown
 *       Tamaño máximo: 100 MB
 *     tags: [AI]
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
 *                 description: Archivo a procesar (PDF, Word, TXT, HTML, Markdown)
 *               prompt:
 *                 type: string
 *                 description: Instrucción para procesar el documento
 *                 example: "Resume este documento en 3 puntos clave"
 *             required:
 *               - file
 *               - prompt
 *     responses:
 *       200:
 *         description: Documento procesado exitosamente
 */
router.post('/ai/process-document-upload', upload.single('file'), validateFileMagicNumber, aiController.processDocumentUpload);

/**
 * @swagger
 * /api/ai/generate-flashcards-upload:
 *   post:
 *     summary: Genera flashcards desde un archivo cargado directamente
 *     description: |
 *       Procesa el archivo y genera flashcards en tiempo real.
 *       Soporta: PDF, Word (.docx, .doc), TXT, HTML, Markdown
 *       Tamaño máximo: 100 MB
 *     tags: [AI]
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
 *                 description: Archivo para generar flashcards
 *               count:
 *                 type: integer
 *                 description: Número de flashcards a generar (1-100)
 *                 default: 10
 *             required:
 *               - file
 *     responses:
 *       200:
 *         description: Flashcards generadas exitosamente
 */
router.post('/ai/generate-flashcards-upload', upload.single('file'), validateFileMagicNumber, aiController.generateFlashcardsUpload);

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

/**
 * POST /api/ai/generate-study-material
 * Genera un mazo de material de estudio (flashcard|multiple_choice|boolean|mixed)
 * directamente desde el contexto del chat con Zyren.
 */
router.post('/ai/generate-study-material', aiController.generateStudyMaterial);

/**
 * GET /api/ai/deck/:deckId/confusions
 * Detecta conceptos confundibles en un mazo (Learning Engineering).
 */
router.get('/ai/deck/:deckId/confusions', aiController.analyzeDeckConfusions);

/**
 * POST /api/ai/deck/:deckId/differentiate
 * Genera e inserta una tarjeta de diferenciación basada en una sugerencia.
 */
router.post('/ai/deck/:deckId/differentiate', aiController.generateDifferentiationCard);

/**
 * POST /api/ai/class-flashcards
 * Flujo Clase ➔ Nota ➔ Mazo. Recibe apuntes y metadatos del curso/materia,
 * retorna flashcards JSON puras listas para insertar en FSRS local.
 */
router.post('/ai/class-flashcards', aiController.generateClassFlashcards);

module.exports = router;
