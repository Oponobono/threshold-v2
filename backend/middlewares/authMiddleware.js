const { verificarHeader, MOTIVO } = require('../services/auth/jwtVerifier');
const { sendAiError, esRutaAiV2, PREFIJO_AI_V2 } = require('../services/ai/contracts/aiErrors');

/**
 * Prefijo de la API de IA v2 y su deteccion viven en services/ai/contracts/aiErrors.js,
 * que es quien define el dialecto. Aqui se re-exportan por comodidad.
 *
 * Se decide por ruta y NO por una excepcion: el middleware global sigue siendo
 * el unico que verifica, no hay ninguna ruta exenta, y por lo tanto no hay forma
 * de olvidar la auth montando una ruta v2 fuera del sitio previsto. La
 * alternativa (eximir /api/ai/v2 y verificar en el router v2) deja un agujero
 * silencioso si alguien monta una ruta v2 fuera de ese router.
 */

/**
 * Middleware que verifica la validez del JSON Web Token (JWT).
 * Protege rutas privadas bloqueando peticiones sin token o con tokens falsos/expirados.
 *
 * Es el UNICO verificador de JWT de la aplicacion. Solo cambia el dialecto de
 * la respuesta de rechazo segun la ruta; la decision de verificar es una sola.
 */
const authenticateToken = (req, res, next) => {
    const veredicto = verificarHeader(req.headers['authorization']);

    if (!veredicto.ok) {
        return responderAuthFallido(req, res, veredicto.motivo);
    }

    // Token valido: el controlador sabe que usuario esta haciendo la peticion.
    req.user = veredicto.user;
    req.userId = veredicto.userId;
    next();
};

/**
 * Responde al rechazo en el dialecto que corresponda a la ruta.
 *
 * v2 -> sobre estable, con requestId y codigo, y un log que SÍ distingue por que
 *       fallo (el movil no necesita saberlo, el operador sí).
 * v1 -> exactamente lo que se respondia antes, porque los builds instalados del
 *       movil leen `error` como texto.
 */
function responderAuthFallido(req, res, motivo) {
    if (esRutaAiV2(req)) {
        return sendAiError(res, { code: 'UNAUTHENTICATED', message: `JWT ${motivo}` }, req.id);
    }

    if (motivo === MOTIVO.AUSENTE) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    return res.status(403).json({ error: 'Token inválido o expirado.' });
}

module.exports = {
    authenticateToken,
    esRutaAiV2,
    PREFIJO_AI_V2,
    JWT_SECRET: require('../config/secrets').JWT_SECRET // Exportado temporalmente por si algún controlador necesita firmar tokens
};