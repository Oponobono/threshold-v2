const express = require('express');
const router = express.Router();
const flashcardsController = require('../controllers/flashcardsController');

/**
 * @swagger
 * /api/flashcard-decks:
 *   get:
 *     summary: Obtiene todos los mazos de flashcards del usuario (propios y compartidos)
 *     tags: [Flashcards]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de mazos de flashcards
 *       400:
 *         description: Falta el user_id
 *       500:
 *         description: Error interno
 */
router.get('/flashcard-decks', flashcardsController.getFlashcardDecks);

/**
 * @swagger
 * /api/flashcard-decks/with-metrics:
 *   get:
 *     summary: Obtiene mazos ordenados por prioridad de repaso (tarjetas vencidas, dominio bajo)
 *     tags: [Flashcards]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de mazos con métricas de prioridad
 *       400:
 *         description: Falta el user_id
 *       500:
 *         description: Error interno
 */
router.get('/flashcard-decks/with-metrics', flashcardsController.getFlashcardDecksWithMetrics);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/export:
 *   get:
 *     summary: Exporta un mazo como JSON seguro (sin user_id)
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mazo a exportar
 *     responses:
 *       200:
 *         description: JSON del mazo exportado (sin user_id)
 *       403:
 *         description: No tienes permiso para exportar este mazo
 *       404:
 *         description: Mazo no encontrado
 *       500:
 *         description: Error interno
 */
router.get('/flashcard-decks/:deckId/export', flashcardsController.exportDeck);

/**
 * @swagger
 * /api/flashcard-decks:
 *   post:
 *     summary: Crea un nuevo mazo de flashcards
 *     tags: [Flashcards]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject_id
 *               - user_id
 *               - title
 *             properties:
 *               subject_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Mazo creado exitosamente
 *       400:
 *         description: Faltan campos requeridos
 */
router.post('/flashcard-decks', flashcardsController.createFlashcardDeck);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}:
 *   put:
 *     summary: Actualiza un mazo de flashcards
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
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
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mazo actualizado exitosamente
 */
router.put('/flashcard-decks/:deckId', flashcardsController.updateFlashcardDeck);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/cards:
 *   get:
 *     summary: Obtiene todas las tarjetas de un mazo
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mazo
 *     responses:
 *       200:
 *         description: Lista de tarjetas
 *       500:
 *         description: Error interno
 */
router.get('/flashcard-decks/:deckId/cards', flashcardsController.getCardsByDeck);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/cards/prioritized:
 *   get:
 *     summary: Obtiene tarjetas de un mazo ordenadas por prioridad de repaso
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mazo
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario (para calcular tasa de fallos)
 *     responses:
 *       200:
 *         description: Lista de tarjetas ordenadas por prioridad
 *       400:
 *         description: Faltan parámetros requeridos
 *       500:
 *         description: Error interno
 */
router.get('/flashcard-decks/:deckId/cards/prioritized', flashcardsController.getCardsByDeckPrioritized);

/**
 * @swagger
 * /api/flashcards/{cardId}:
 *   get:
 *     summary: Obtiene una tarjeta específica por su ID
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la tarjeta
 *     responses:
 *       200:
 *         description: Datos de la tarjeta
 *       404:
 *         description: Tarjeta no encontrada
 *       500:
 *         description: Error interno
 */
router.get('/flashcards/:cardId', flashcardsController.getCardById);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/cards:
 *   post:
 *     summary: Crea una nueva tarjeta en un mazo
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - front
 *               - back
 *             properties:
 *               front:
 *                 type: string
 *               back:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tarjeta creada exitosamente
 *       400:
 *         description: Faltan campos
 */
router.post('/flashcard-decks/:deckId/cards', flashcardsController.createCard);

/**
 * POST /api/flashcard-decks/:deckId/items
 * Crea un ítem de evaluación polimórfico (flashcard | multiple_choice | boolean)
 */
router.post('/flashcard-decks/:deckId/items', flashcardsController.createEvaluationItem);

/**
 * @swagger
 * /api/flashcards/{cardId}:
 *   put:
 *     summary: Actualiza el estado de una tarjeta
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: cardId
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
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.put('/flashcards/:cardId', flashcardsController.updateCardStatus);

/**
 * @swagger
 * /api/flashcards/{cardId}/review:
 *   post:
 *     summary: Registra una revisión de tarjeta con FSRS (Free Spaced Repetition Scheduler)
 *     description: Procesa la revisión de una tarjeta y calcula la próxima fecha de repaso usando FSRS, más avanzado que SM-2. Actualiza estadísticas del usuario.
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - result
 *               - responseTimeMs
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: ID del usuario que revisó la tarjeta
 *               result:
 *                 type: string
 *                 enum: [correct, incorrect]
 *                 description: Resultado de la revisión
 *               responseTimeMs:
 *                 type: number
 *                 description: Tiempo de respuesta en milisegundos
 *     responses:
 *       200:
 *         description: Revisión registrada correctamente con FSRS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 cardId:
 *                   type: integer
 *                 quality:
 *                   type: integer
 *                   description: Calidad calculada (1-5)
 *                 nextReviewDate:
 *                   type: string
 *                   format: date-time
 *                 newStability:
 *                   type: number
 *                   description: Nueva estabilidad FSRS
 *                 newDifficulty:
 *                   type: number
 *                   description: Nueva dificultad FSRS (0-10)
 *                 newRepetitions:
 *                   type: integer
 *                 retention:
 *                   type: number
 *                   description: Retención esperada (%)
 *       400:
 *         description: Falta de parámetros requeridos
 *       404:
 *         description: Tarjeta no encontrada
 *       500:
 *         description: Error interno
 */
router.post('/flashcards/:cardId/review', flashcardsController.recordCardReview);

/**
 * @swagger
 * /api/flashcards/{cardId}:
 *   delete:
 *     summary: Elimina una tarjeta
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tarjeta eliminada
 */
router.delete('/flashcards/:cardId', flashcardsController.deleteCard);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}:
 *   delete:
 *     summary: Elimina un mazo completo y sus tarjetas
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mazo eliminado
 */
router.delete('/flashcard-decks/:deckId', flashcardsController.deleteDeck);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/share:
 *   post:
 *     summary: Comparte un mazo con otro usuario usando su PIN
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - owner_id
 *               - target_pin
 *             properties:
 *               owner_id:
 *                 type: integer
 *               target_pin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mazo compartido exitosamente
 *       404:
 *         description: PIN no encontrado
 */
router.post('/flashcard-decks/:deckId/share', flashcardsController.shareDeck);
router.delete('/flashcard-decks/:deckId/group-share', flashcardsController.removeDeckFromGroup);

/**
 * @swagger
 * /api/flashcard-decks/generate-from-text:
 *   post:
 *     summary: Genera un mazo de flashcards a partir de un texto usando IA
 *     tags: [Flashcards, AI Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - count
 *               - title
 *               - subject_id
 *               - user_id
 *             properties:
 *               text:
 *                 type: string
 *               count:
 *                 type: integer
 *               title:
 *                 type: string
 *               subject_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Mazo generado exitosamente
 *       400:
 *         description: Faltan campos requeridos
 *       500:
 *         description: Error interno o de la IA
 */
router.post('/flashcard-decks/generate-from-text', flashcardsController.generateDeckFromText);

/**
 * @swagger
 * /api/flashcard-decks/generate-from-image:
 *   post:
 *     summary: Genera un mazo de flashcards a partir de una imagen (OCR + IA) usando Groq Vision
 *     tags: [Flashcards, AI Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image_base64
 *               - count
 *               - title
 *               - subject_id
 *               - user_id
 *             properties:
 *               image_base64:
 *                 type: string
 *                 description: Imagen en formato base64
 *               count:
 *                 type: integer
 *               title:
 *                 type: string
 *               subject_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Mazo generado exitosamente
 *       400:
 *         description: Faltan campos requeridos
 *       500:
 *         description: Error interno o de la IA
 */
router.post('/flashcard-decks/generate-from-image', flashcardsController.generateDeckFromImage);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/analyze-confusions:
 *   get:
 *     summary: Analiza confusiones en un mazo (tarjetas que se confunden frecuentemente)
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mazo
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de confusiones detectadas
 *       400:
 *         description: Faltan parámetros requeridos
 *       500:
 *         description: Error interno
 */
router.get('/flashcard-decks/:deckId/analyze-confusions', flashcardsController.analyzeDeckConfusions);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/generate-differentiation:
 *   post:
 *     summary: Genera una tarjeta de diferenciación entre dos conceptos confusos
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mazo donde se agregará la nueva tarjeta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - card1_id
 *               - card2_id
 *               - userId
 *             properties:
 *               card1_id:
 *                 type: integer
 *               card2_id:
 *                 type: integer
 *               userId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Tarjeta de diferenciación creada
 *       400:
 *         description: Parámetros faltantes o inválidos
 *       500:
 *         description: Error interno o de la IA
 */
router.post('/flashcard-decks/:deckId/generate-differentiation', flashcardsController.generateDifferentiationCard);

/**
 * @swagger
 * /api/flashcards/{cardId}/snooze:
 *   post:
 *     summary: Snooze una tarjeta por un tiempo especificado
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - durationMinutes
 *             properties:
 *               userId:
 *                 type: integer
 *               durationMinutes:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tarjeta snoozed exitosamente
 */
router.post('/flashcards/:cardId/snooze', flashcardsController.snoozeCard);

/**
 * @swagger
 * /api/flashcards/{cardId}/snooze:
 *   delete:
 *     summary: Reanuda una tarjeta snoozed
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tarjeta reanudada
 */
router.delete('/flashcards/:cardId/snooze', flashcardsController.unsnoozeCard);

/**
 * @swagger
 * /api/flashcards/{cardId}/snooze-status:
 *   get:
 *     summary: Obtiene el estado de snooze de una tarjeta
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado de snooze (isSnoozed, resumeAt, timeUntilResume)
 */
router.get('/flashcards/:cardId/snooze-status', flashcardsController.getSnoozeStatus);

/**
 * @swagger
 * /api/flashcard-decks/{deckId}/cards/not-snoozed:
 *   get:
 *     summary: Obtiene tarjetas de un mazo excluyendo las snoozed
 *     tags: [Flashcards]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de tarjetas sin snooze, ordenadas por prioridad
 */
router.get('/flashcard-decks/:deckId/cards/not-snoozed', flashcardsController.getCardsNotSnoozed);

/**
 * @swagger
 * /api/flashcards/auto-unsnoozed:
 *   post:
 *     summary: Reanuda automáticamente todas las tarjetas snoozed expiradas
 *     tags: [Flashcards]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Tarjetas snoozed expiradas reanudadas
 */
router.post('/flashcards/auto-unsnoozed', flashcardsController.autoUnsnoozeExpired);

module.exports = router;
