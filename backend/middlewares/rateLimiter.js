const rateLimit = require('express-rate-limit');

/**
 * Límite Global: Protege a tu servidor de ataques de fuerza bruta o DDoS.
 * Se aplicará a casi todas las rutas de la aplicación.
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    max: 100, // Máximo 100 peticiones por IP en esos 15 minutos
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
    max: 15, // Máximo 15 peticiones por IP por hora (ajusta este número según tu plan)
    message: { error: 'Has superado el límite de uso de la Inteligencia Artificial por hora. Intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Límite para Login/Registro: Previene ataques de fuerza bruta adivinando contraseñas.
 */
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Ventana de 1 hora
    max: 10, // Máximo 10 intentos por hora
    message: { error: 'Demasiados intentos de inicio de sesión. Tu cuenta está temporalmente bloqueada.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    globalLimiter,
    aiLimiter,
    authLimiter
};
