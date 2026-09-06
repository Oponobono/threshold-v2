const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginRateLimiter, biometricRateLimiter } = require('../middlewares/rateLimiter');

/**
 * Auth routes — rate limiting applied as inline middleware at the route level.
 *
 * Policy is declared here (routing) and not inside the controller (business logic).
 * Each authentication path has its own independent limiter so they do not share
 * a counter bucket.
 *
 * HTTP Request
 *      │
 *      ▼
 * ┌─────────────────────────┐
 * │ Rate Limiter (per route)│
 * │  /login → loginRateLimiter
 * │  /biometric-login → biometricRateLimiter
 * └────────────┬────────────┘
 *              │
 *              ▼
 *     Authentication Handler
 */

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Registra un nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               lastname:
 *                 type: string
 *               username:
 *                 type: string
 *               grading_scale:
 *                 type: string
 *               approval_threshold:
 *                 type: number
 *               major:
 *                 type: string
 *               university:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Faltan campos requeridos
 *       409:
 *         description: El correo ya está registrado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/register', loginRateLimiter, authController.registerUser);

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Inicia sesión con email y contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       400:
 *         description: Faltan campos requeridos
 *       401:
 *         description: Credenciales inválidas o cuenta eliminada
 *       429:
 *         description: Demasiados intentos de autenticación
 *       500:
 *         description: Error interno del servidor
 */
router.post('/login', loginRateLimiter, authController.loginUser);

/**
 * @swagger
 * /api/auth/enroll-biometric:
 *   post:
 *     summary: Asocia un token biométrico a un usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - biometric_token
 *             properties:
 *               userId:
 *                 type: integer
 *               biometric_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token asociado exitosamente
 */
router.post('/auth/enroll-biometric', loginRateLimiter, authController.enrollBiometric);

/**
 * @swagger
 * /api/biometric-login:
 *   post:
 *     summary: Inicia sesión usando un token biométrico previamente registrado
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - biometric_token
 *             properties:
 *               biometric_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Token inválido o no encontrado
 *       429:
 *         description: Demasiados intentos de autenticación
 */
router.post('/biometric-login', biometricRateLimiter, authController.biometricLogin);

router.post('/auth/forgot-password', loginRateLimiter, authController.forgotPassword);
router.post('/auth/reset-password', loginRateLimiter, authController.resetPassword);

module.exports = router;
