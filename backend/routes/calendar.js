const express = require('express');
const router = express.Router();
const calendarEventsController = require('../controllers/calendarEventsController');

/**
 * @swagger
 * /api/calendar/events:
 *   post:
 *     summary: Crear un nuevo evento en el calendario
 *     tags: [Calendar Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - eventType
 *               - startDate
 *               - endDate
 *               - allDay
 *             properties:
 *               title:
 *                 type: string
 *                 description: Nombre del evento
 *               eventType:
 *                 type: string
 *                 enum: [exam, task, class, other]
 *                 description: Tipo de evento
 *               subjectId:
 *                 type: integer
 *                 description: ID de la materia (requerido para exam, task, class)
 *               startDate:
 *                 type: string
 *                 description: Fecha de inicio (DD-MM-YYYY)
 *               endDate:
 *                 type: string
 *                 description: Fecha de fin (DD-MM-YYYY)
 *               startTime:
 *                 type: string
 *                 description: Hora de inicio (HH:MM, opcional si allDay=true)
 *               endTime:
 *                 type: string
 *                 description: Hora de fin (HH:MM, opcional si allDay=true)
 *               allDay:
 *                 type: boolean
 *                 description: Si es evento de todo el día
 *               description:
 *                 type: string
 *                 description: Descripción del evento (opcional)
 *               createStudyPlan:
 *                 type: boolean
 *                 description: Crear plan de estudio automático (solo exámenes)
 *     responses:
 *       201:
 *         description: Evento creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 */
router.post('/calendar/events', calendarEventsController.createCalendarEvent);

/**
 * @swagger
 * /api/calendar/events:
 *   get:
 *     summary: Obtener eventos del calendario del usuario
 *     tags: [Calendar Events]
 *     parameters:
 *       - name: user_id
 *         in: query
 *         type: integer
 *         description: ID del usuario (opcional si está autenticado)
 *       - name: startDate
 *         in: query
 *         type: string
 *         description: Fecha de inicio para filtrar (DD-MM-YYYY, opcional)
 *       - name: endDate
 *         in: query
 *         type: string
 *         description: Fecha de fin para filtrar (DD-MM-YYYY, opcional)
 *     responses:
 *       200:
 *         description: Lista de eventos
 *       401:
 *         description: No autenticado
 */
router.get('/calendar/events', calendarEventsController.getUserCalendarEvents);

/**
 * @swagger
 * /api/calendar/events/{eventId}:
 *   get:
 *     summary: Obtener un evento específico
 *     tags: [Calendar Events]
 *     parameters:
 *       - name: eventId
 *         in: path
 *         type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Evento encontrado
 *       404:
 *         description: Evento no encontrado
 */
router.get('/calendar/events/:eventId', calendarEventsController.getCalendarEvent);

/**
 * @swagger
 * /api/calendar/events/{eventId}:
 *   put:
 *     summary: Actualizar un evento
 *     tags: [Calendar Events]
 *     parameters:
 *       - name: eventId
 *         in: path
 *         type: integer
 *         required: true
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               eventType:
 *                 type: string
 *               subjectId:
 *                 type: integer
 *               startDate:
 *                 type: string
 *               endDate:
 *                 type: string
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *               allDay:
 *                 type: boolean
 *               description:
 *                 type: string
 *               createStudyPlan:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Evento actualizado
 *       404:
 *         description: Evento no encontrado
 */
router.put('/calendar/events/:eventId', calendarEventsController.updateCalendarEvent);

/**
 * @swagger
 * /api/calendar/events/{eventId}:
 *   delete:
 *     summary: Eliminar un evento
 *     tags: [Calendar Events]
 *     parameters:
 *       - name: eventId
 *         in: path
 *         type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Evento eliminado
 *       404:
 *         description: Evento no encontrado
 */
router.delete('/calendar/events/:eventId', calendarEventsController.deleteCalendarEvent);

module.exports = router;
