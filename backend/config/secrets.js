require('dotenv').config();

/**
 * Función auxiliar para obtener variables de entorno con políticas estrictas.
 * Implementa el patrón "Fail-Fast": si falta algo crítico, apaga el servidor
 * de inmediato en lugar de fallar silenciosamente después.
 */
const getSecret = (key, defaultValue = null, required = false) => {
    const value = process.env[key] || defaultValue;
    if (required && !value) {
        console.error(`[🔥 CRÍTICO] Falta la variable de entorno obligatoria: ${key}`);
        console.error(`Por favor, añádela a tu archivo .env y reinicia el servidor.`);
        process.exit(1); 
    }
    return value;
};

const isProd = process.env.NODE_ENV === 'production';

/**
 * Gestor Centralizado de Secretos (Fase 2 de Seguridad)
 * 
 * Este es el ÚNICO archivo de la aplicación que tiene permiso para leer process.env.
 * El resto de la aplicación debe importar sus llaves desde aquí.
 */
const secrets = {
    // Entorno
    NODE_ENV: getSecret('NODE_ENV', 'development'),
    PORT: Number(getSecret('PORT', 3000)),
    HOST: getSecret('HOST', '0.0.0.0'),
    
    // Autenticación
    // ⚠️ En producción, JWT_SECRET es OBLIGATORIO. Configúralo en .env con un valor seguro.
    // En desarrollo, si no está configurado, se usa un valor aleatorio por sesión.
    JWT_SECRET: getSecret('JWT_SECRET', isProd ? null : require('crypto').randomBytes(32).toString('hex'), isProd),
    
    // Base de Datos
    DATABASE_URL: getSecret('DATABASE_URL', ''),
    
    // Inteligencia Artificial (Críticas)
    GROQ_API_KEY: getSecret('GROQ_API_KEY', null, true),
    GEMINI_API_KEY: getSecret('GEMINI_API_KEY', null, true),
    
    // Servicios de Terceros
    SUPADATA_API_KEY: getSecret('SUPADATA_API_KEY', null, false),
    // Uploadthing: obligatorio en producción para subir archivos (fotos, audios, docs)
    UPLOADTHING_TOKEN: getSecret('UPLOADTHING_TOKEN', null, isProd),
};

module.exports = secrets;
