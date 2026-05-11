const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Obtiene el perfil completo de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Datos del perfil del usuario
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/users/:userId', userController.getUserProfile);

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Actualiza los campos del perfil de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               lastname:
 *                 type: string
 *               username:
 *                 type: string
 *               university:
 *                 type: string
 *               display_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil actualizado
 */
router.put('/users/:userId', userController.updateUserProfile);

/**
 * @swagger
 * /api/users/{userId}/password:
 *   put:
 *     summary: Cambia la contraseña del usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 */
router.put('/users/:userId/password', userController.updatePassword);

// Verificar contraseña (para confirmar eliminación de cuenta)
router.post('/users/:userId/password-verify', userController.verifyPassword);

/**
 * @swagger
 * /api/users/{userId}/deletion-data-count:
 *   get:
 *     summary: Obtiene el conteo de recursos que se eliminarán permanentemente
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Objeto con los conteos de materias, grabaciones, etc.
 */
router.get('/users/:userId/deletion-data-count', userController.getDeletionDataCount);

/**
 * @swagger
 * /api/users/{userId}/biometric:
 *   delete:
 *     summary: Revoca el token biométrico de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token revocado
 */
router.delete('/users/:userId/biometric', userController.revokeBiometric);

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Marca una cuenta para eliminación definitiva (Soft Delete de 14 días)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cuenta marcada para eliminación
 */
router.delete('/users/:userId', userController.requestDeletion);

/**
 * @swagger
 * /api/users/{userId}/reactivate:
 *   post:
 *     summary: Cancela el proceso de eliminación de cuenta
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cuenta reactivada
 */
router.post('/users/:userId/reactivate', userController.reactivateAccount);

/**
 * @swagger
 * /api/users/{userId}/profile-image:
 *   patch:
 *     summary: Actualiza la foto de perfil del usuario (URL de Firebase Storage)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - profile_image
 *             properties:
 *               profile_image:
 *                 type: string
 *                 description: URL pública de la imagen en Firebase Storage
 *     responses:
 *       200:
 *         description: Foto de perfil actualizada
 */
router.patch('/users/:userId/profile-image', userController.updateProfileImage);

module.exports = router;
