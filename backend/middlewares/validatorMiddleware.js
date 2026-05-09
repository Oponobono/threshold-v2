/**
 * Middleware Genérico de Validación (Usando Zod)
 * Garantiza que la API reciba exactamente los datos que espera (tipos, longitudes)
 * antes de pasarlos al controlador, evitando inyecciones o crashes.
 * 
 * @param {import('zod').ZodSchema} schema - El esquema o reglas de Zod a cumplir
 * @param {String} target - Qué parte de la petición validar: 'body', 'query', o 'params'
 */
const validate = (schema, target = 'body') => {
    return (req, res, next) => {
        try {
            // Intentamos parsear los datos contra el esquema estricto
            const validatedData = schema.parse(req[target]);
            
            // Reemplazamos los datos potencialmente peligrosos con la versión limpia y parseada
            req[target] = validatedData;
            
            // Si todo está bien, pasamos al controlador
            next();
        } catch (error) {
            // Si falla, Zod arroja un error con los detalles precisos
            // Formateamos los errores para que sean legibles en el frontend
            const formattedErrors = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));

            return res.status(400).json({
                error: 'Los datos enviados no cumplen con el formato requerido.',
                details: formattedErrors
            });
        }
    };
};

module.exports = {
    validate
};
