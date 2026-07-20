const express = require('express');
const router = express.Router();
const studyNotesController = require('../controllers/studyNotesController');

/**
 * @swagger
 * /api/study-notes/user/{userId}:
 *   get:
 *     summary: Obtiene todos los apuntes de un usuario
 *     tags: [StudyNotes]
 */
router.get('/study-notes/user/:userId', studyNotesController.getStudyNotesByUser);

/**
 * @swagger
 * /api/study-notes/subject/{subjectId}:
 *   get:
 *     summary: Obtiene apuntes de una materia
 *     tags: [StudyNotes]
 */
router.get('/study-notes/subject/:subjectId', studyNotesController.getStudyNotesBySubject);

/**
 * @swagger
 * /api/study-notes:
 *   post:
 *     summary: Crea o re-sincroniza un apunte
 *     tags: [StudyNotes]
 */
router.post('/study-notes', studyNotesController.createStudyNote);

/**
 * @swagger
 * /api/study-notes/{id}:
 *   put:
 *     summary: Actualiza un apunte
 *     tags: [StudyNotes]
 */
router.put('/study-notes/:id', studyNotesController.updateStudyNote);

/**
 * @swagger
 * /api/study-notes/{id}:
 *   delete:
 *     summary: Elimina un apunte
 *     tags: [StudyNotes]
 */
router.delete('/study-notes/:id', studyNotesController.deleteStudyNote);

module.exports = router;
