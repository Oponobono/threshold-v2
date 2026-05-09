/**
 * Middleware para validar la autenticidad de los archivos subidos.
 * No confía en la extensión ni en el mimetype que envía el cliente,
 * sino que inspecciona los primeros bytes del archivo (Magic Numbers).
 */

// Firmas Hexadecimales (Magic Numbers)
const MAGIC_NUMBERS = {
    PDF: '25504446', // %PDF
    DOCX: '504b0304', // PK.. (Es un ZIP encapsulado)
    DOC: 'd0cf11e0', // Archivos de Word antiguos (OLE)
};

/**
 * Convierte un buffer en una cadena hexadecimal
 */
const getMagicNumber = (buffer) => {
    if (!buffer || buffer.length < 4) return '';
    return buffer.toString('hex', 0, 4).toLowerCase();
};

/**
 * Verifica si un buffer parece ser texto puro (sin bytes nulos \0)
 */
const isTextFile = (buffer) => {
    // Escaneamos los primeros 1024 bytes (o el tamaño total si es menor)
    const scanLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < scanLength; i++) {
        if (buffer[i] === 0x00) {
            // Un byte nulo (0x00) en los primeros bytes indica que NO es texto
            return false;
        }
    }
    return true;
};

const validateFileMagicNumber = (req, res, next) => {
    if (!req.file) {
        return next(); // Si no hay archivo, pasamos al siguiente middleware
    }

    const buffer = req.file.buffer;
    if (!buffer) {
        return res.status(400).json({ error: 'El archivo está vacío o corrupto.' });
    }

    const magic = getMagicNumber(buffer);
    const mimeType = req.file.mimetype;

    // 1. Validar archivos binarios (PDF y Word)
    if (mimeType === 'application/pdf') {
        if (!magic.startsWith(MAGIC_NUMBERS.PDF)) {
            return res.status(400).json({ error: 'ALERTA DE SEGURIDAD: El archivo finge ser un PDF pero no lo es.' });
        }
    } 
    else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        mimeType === 'application/msword'
    ) {
        if (!magic.startsWith(MAGIC_NUMBERS.DOCX) && !magic.startsWith(MAGIC_NUMBERS.DOC)) {
            return res.status(400).json({ error: 'ALERTA DE SEGURIDAD: El archivo finge ser un documento Word pero no lo es.' });
        }
    }
    // 2. Validar archivos de texto plano (TXT, HTML, Markdown)
    else if (
        mimeType === 'text/plain' || 
        mimeType === 'text/html' || 
        mimeType === 'text/markdown'
    ) {
        if (!isTextFile(buffer)) {
            return res.status(400).json({ error: 'ALERTA DE SEGURIDAD: El archivo de texto contiene código binario o ejecutable sospechoso.' });
        }
    }
    // 3. Formato no soportado
    else {
        return res.status(400).json({ error: 'Formato de archivo no permitido o irreconocible.' });
    }

    next();
};

module.exports = {
    validateFileMagicNumber
};
