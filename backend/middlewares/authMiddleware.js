const jwt = require('jsonwebtoken');
const secrets = require('../config/secrets');

const JWT_SECRET = secrets.JWT_SECRET;

/**
 * Middleware que verifica la validez del JSON Web Token (JWT)
 * Protege rutas privadas bloqueando peticiones sin token o con tokens falsos/expirados.
 */
const authenticateToken = (req, res, next) => {
    // 1. Extraer el token de la cabecera: "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // 2. Si no hay token, rebotar la petición inmediatamente (401 Unauthorized)
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    // 3. Verificar si el token es real y no ha expirado
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // El token fue modificado, expiró o no fue firmado por nosotros
            return res.status(403).json({ error: 'Token inválido o expirado.' });
        }

        // 4. Token válido: adjuntamos la información del usuario a 'req'
        // Esto permite que el controlador sepa exactamente QUÉ usuario está haciendo la petición
        req.user = user;
        next(); // Pasar el control a la ruta
    });
};

module.exports = {
    authenticateToken,
    JWT_SECRET // Exportado temporalmente por si algún controlador necesita firmar tokens
};
