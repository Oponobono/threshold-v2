/**
 * Upload Controller
 * Recibe archivos del móvil vía multipart/form-data y los sube
 * a Uploadthing usando UTApi (server-side SDK). Devuelve la URL permanente.
 */
const { UTFile } = require('uploadthing/server');
const { getUtapi } = require('../utils/uploadthingServer');

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

    // Si el token no está configurado, el UTApi fallará.
    // El error se captura en el catch y se devuelve 500 con mensaje descriptivo.

    // Convertir el Buffer de multer en un UTFile (compatible con UTApi en Node 18+)
    const file = new UTFile([req.file.buffer], req.file.originalname, {
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
    await getUtapi().deleteFiles(key);
    return res.json({ message: 'Archivo eliminado correctamente.' });
  } catch (error) {
    console.error('[Uploadthing] Error al eliminar:', error.message);
    return res.status(500).json({ error: 'Error al eliminar el archivo.' });
  }
};
