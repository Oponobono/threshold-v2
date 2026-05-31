const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middlewares/rateLimiter');

// Proteger login y registro contra fuerza bruta
router.use('/login', authLimiter);
router.use('/register', authLimiter);
router.use('/biometric-login', authLimiter);
router.use('/auth/enroll-biometric', authLimiter);
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
router.post('/register', authController.registerUser);

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
 *       500:
 *         description: Error interno del servidor
 */
router.post('/login', authController.loginUser);

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
router.post('/auth/enroll-biometric', authController.enrollBiometric);

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
 */
router.post('/biometric-login', authController.biometricLogin);

module.exports = router;
