/**
 * Upload Controller
 * Recibe archivos del móvil vía multipart/form-data y los sube
 * a Uploadthing usando UTApi (server-side SDK). Devuelve la URL permanente.
 */
const { UTApi } = require('uploadthing/server');

// Lazy singleton: se inicializa en la primera petición para garantizar
// que process.env.UPLOADTHING_TOKEN ya ha sido inyectado por dotenv.
let _utapi = null;
function getUtapi() {
  if (!_utapi) _utapi = new UTApi();
  return _utapi;
}

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
    const utapi = getUtapi();

    // Convertir el Buffer de multer en un objeto File (compatible con UTApi)
    const file = new File([req.file.buffer], req.file.originalname, {
      type: req.file.mimetype,
    });

    console.log(`[Uploadthing] Subiendo archivo: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);
    const response = await utapi.uploadFiles(file);

    if (response.error) {
      // Exponer el error real de UploadThing para facilitar el diagnóstico
      const detail = response.error?.message || JSON.stringify(response.error);
      console.error('[Uploadthing] Error al subir:', response.error);
      return res.status(500).json({ error: `Error de Uploadthing: ${detail}` });
    }

    const fileData = response.data;
    console.log(`[Uploadthing] ÉXITO: ${fileData.name} → ${fileData.ufsUrl}`);
    return res.json({
      url: fileData.ufsUrl,
      key: fileData.key,
      name: fileData.name,
      size: fileData.size,
    });
  } catch (error) {
    console.error('[Uploadthing] Error inesperado:', error);
    return res.status(500).json({ error: `Error interno: ${error.message}` });
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
