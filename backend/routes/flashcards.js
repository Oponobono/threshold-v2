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

module.exports = router;
