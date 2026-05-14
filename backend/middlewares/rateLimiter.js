const rateLimit = require('express-rate-limit');

/**
 * Límite Global: Protege a tu servidor de ataques de fuerza bruta o DDoS.
 * Se aplicará a casi todas las rutas de la aplicación.
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    max: 1000, // Máximo 1000 peticiones por IP en esos 15 minutos (100 era muy poco para una app moderna)
    message: { error: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo en 15 minutos.' },
    standardHeaders: true, // Informa a los clientes sobre su límite en las cabeceras HTTP
    legacyHeaders: false,
});

/**
 * Límite Estricto para IA: Protege tu bolsillo y tu cuota en Groq/Gemini.
 * Evita que un script agote el saldo generando miles de flashcards.
 */
const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Ventana de 1 hora
    max: 200, // DEV: 200 req/hora por IP — bajar a 30-50 antes de producción
              // Groq free: ~1,800/h · Gemini Flash free: ~900/h → 200 es seguro para ambos
    standardHeaders: true,
    legacyHeaders: false,
    // Handler personalizado para enviar Retry-After con el tiempo exacto en segundos
    handler: (req, res, next, options) => {
        const resetTimeMs = req.rateLimit?.resetTime?.getTime?.() ?? (Date.now() + options.windowMs);
        const retryAfterSeconds = Math.ceil((resetTimeMs - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(options.statusCode).json({
            error: 'Has superado el límite de uso de la Inteligencia Artificial por hora. Intenta más tarde.',
            retryAfter: retryAfterSeconds,
        });
    },
});

/**
 * Límite para Login/Registro: Previene ataques de fuerza bruta adivinando contraseñas.
 */
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Ventana de 1 hora
    max: 200, // DEV: 200 intentos fallidos por hora
    message: { error: 'Demasiados intentos de inicio de sesión. Tu cuenta está temporalmente bloqueada.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // ¡Clave! Solo cuenta los intentos fallidos
});

module.exports = {
    globalLimiter,
    aiLimiter,
    authLimiter
};
