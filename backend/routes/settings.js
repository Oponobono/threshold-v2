const express = require('express');
const router = express.Router();
const {
  getGradingPeriods,
  createGradingPeriod,
  deleteGradingPeriod,
  getThresholdOverrides,
  saveThresholdOverrides,
  createCustomGradingSystem,
  getTwoFactorStatus,
  enableTwoFactor,
  disableTwoFactor,
  getLmsAccounts,
  addLmsAccount,
  removeLmsAccount,
  exportDataCsv,
  exportDataPdf,
  sendFeedback,
} = require('../controllers/settingsController');

/**
 * @swagger
 * /api/grading-periods:
 *   get:
 *     summary: Obtiene todos los períodos académicos
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de períodos académicos
 */
router.get('/grading-periods', getGradingPeriods);

/**
 * @swagger
 * /api/grading-periods:
 *   post:
 *     summary: Crea un período académico
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - period_type
 *             properties:
 *               name:
 *                 type: string
 *               period_type:
 *                 type: string
 *               start_date:
 *                 type: string
 *               end_date:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Período creado
 */
router.post('/grading-periods', createGradingPeriod);

/**
 * @swagger
 * /api/grading-periods/{id}:
 *   delete:
 *     summary: Elimina un período académico
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Período eliminado
 */
router.delete('/grading-periods/:id', deleteGradingPeriod);

/**
 * @swagger
 * /api/threshold-overrides:
 *   get:
 *     summary: Obtiene los umbrales de aprobación personalizados
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de umbrales por materia
 */
router.get('/threshold-overrides', getThresholdOverrides);

/**
 * @swagger
 * /api/threshold-overrides:
 *   put:
 *     summary: Guarda umbrales de aprobación personalizados
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 subject_id:
 *                   type: string
 *                 threshold:
 *                   type: number
 *     responses:
 *       200:
 *         description: Umbrales guardados
 */
router.put('/threshold-overrides', saveThresholdOverrides);

/**
 * @swagger
 * /api/grading-systems/custom:
 *   post:
 *     summary: Crea un sistema de calificación personalizado
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               mode:
 *                 type: string
 *               direction:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sistema creado
 */
router.post('/grading-systems/custom', createCustomGradingSystem);

/**
 * @swagger
 * /api/two-factor/status:
 *   get:
 *     summary: Obtiene el estado de 2FA del usuario
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de 2FA
 */
router.get('/two-factor/status', getTwoFactorStatus);

/**
 * @swagger
 * /api/two-factor/enable:
 *   post:
 *     summary: Activa 2FA para el usuario
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA activado
 */
router.post('/two-factor/enable', enableTwoFactor);

/**
 * @swagger
 * /api/two-factor/disable:
 *   post:
 *     summary: Desactiva 2FA para el usuario
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA desactivado
 */
router.post('/two-factor/disable', disableTwoFactor);

/**
 * @swagger
 * /api/lms-accounts:
 *   get:
 *     summary: Obtiene cuentas LMS vinculadas
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cuentas LMS
 */
router.get('/lms-accounts', getLmsAccounts);

/**
 * @swagger
 * /api/lms-accounts:
 *   post:
 *     summary: Vincula una cuenta LMS
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - username
 *             properties:
 *               platform:
 *                 type: string
 *               instance_url:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cuenta vinculada
 */
router.post('/lms-accounts', addLmsAccount);

/**
 * @swagger
 * /api/lms-accounts/{id}:
 *   delete:
 *     summary: Desvincula una cuenta LMS
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cuenta desvinculada
 */
router.delete('/lms-accounts/:id', removeLmsAccount);

/**
 * @swagger
 * /api/export/csv:
 *   get:
 *     summary: Exporta datos en formato CSV
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archivo CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export/csv', exportDataCsv);

/**
 * @swagger
 * /api/export/pdf:
 *   get:
 *     summary: Exporta datos en formato PDF
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archivo PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export/pdf', exportDataPdf);

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Envía feedback del usuario
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback enviado
 */
router.post('/feedback', sendFeedback);

module.exports = router;
