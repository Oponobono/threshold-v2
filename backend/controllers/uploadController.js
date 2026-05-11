/**
 * Upload Controller
 * Recibe archivos del móvil vía multipart/form-data y los sube
 * a Uploadthing usando UTApi (server-side SDK). Devuelve la URL permanente.
 */
const { UTApi } = require('uploadthing/server');

// UTApi lee UPLOADTHING_TOKEN automáticamente del entorno
const utapi = new UTApi();

/**
 * POST /api/upload
 * Body: multipart/form-data con campo "file"
 * Sube cualquier archivo a Uploadthing y devuelve la URL pública.
 */
exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo.' });
  }

  try {
    // Convertir el Buffer de multer en un objeto File (compatible con UTApi)
    const file = new File([req.file.buffer], req.file.originalname, {
      type: req.file.mimetype,
    });

    const response = await utapi.uploadFiles(file);

    if (response.error) {
      console.error('[Uploadthing] Error al subir:', response.error);
      return res.status(500).json({ error: 'Error al subir el archivo a Uploadthing.' });
    }

    return res.json({
      url: response.data.ufsUrl,
      key: response.data.key,
      name: response.data.name,
      size: response.data.size,
    });
  } catch (error) {
    console.error('[Uploadthing] Error inesperado:', error.message);
    return res.status(500).json({ error: 'Error interno al procesar la subida.' });
  }
};

/**
 * DELETE /api/upload/:key
 * Elimina un archivo de Uploadthing usando su key.
 * Útil cuando el usuario cambia su foto de perfil.
 */
exports.deleteFile = async (req, res) => {
  const { key } = req.params;
  if (!key) {
    return res.status(400).json({ error: 'Se requiere el key del archivo.' });
  }

  try {
    await utapi.deleteFiles(key);
    return res.json({ message: 'Archivo eliminado correctamente.' });
  } catch (error) {
    console.error('[Uploadthing] Error al eliminar:', error.message);
    return res.status(500).json({ error: 'Error al eliminar el archivo.' });
  }
};
