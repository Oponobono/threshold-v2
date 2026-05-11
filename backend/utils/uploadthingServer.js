/**
 * Uploadthing Server Utilities
 * Funciones de servidor para gestionar archivos en Uploadthing via UTApi.
 */
const { UTApi } = require('uploadthing/server');

const utapi = new UTApi();

/**
 * Extrae el key de Uploadthing desde una URL completa.
 * Soporta formatos:
 *  - https://utfs.io/f/{key}
 *  - https://{appId}.ufs.sh/f/{key}
 *
 * @param {string} url - URL completa de Uploadthing
 * @returns {string|null} key del archivo o null si no se puede extraer
 */
function extractKeyFromUrl(url) {
  if (!url) return null;
  try {
    const parts = url.split('/f/');
    return parts.length > 1 ? parts[1].split('?')[0] : null;
  } catch {
    return null;
  }
}

/**
 * Elimina un archivo de Uploadthing usando su URL pública.
 * No lanza error si el archivo no existe o la operación falla (best-effort).
 *
 * @param {string|null} cloudUrl - URL pública del archivo en Uploadthing
 * @returns {Promise<boolean>} true si se eliminó, false si falló o no había URL
 */
async function deleteFromUploadthing(cloudUrl) {
  const key = extractKeyFromUrl(cloudUrl);
  if (!key) return false;

  try {
    await utapi.deleteFiles(key);
    console.log(`[Uploadthing] Archivo eliminado: ${key}`);
    return true;
  } catch (err) {
    // No propagamos el error — si falla la eliminación en la nube, el registro local ya fue borrado
    console.warn(`[Uploadthing] No se pudo eliminar ${key}:`, err.message);
    return false;
  }
}

/**
 * Elimina múltiples archivos de Uploadthing de una vez.
 * @param {string[]} cloudUrls - Array de URLs públicas
 */
async function deleteMultipleFromUploadthing(cloudUrls) {
  const keys = cloudUrls.map(extractKeyFromUrl).filter(Boolean);
  if (keys.length === 0) return;

  try {
    await utapi.deleteFiles(keys);
    console.log(`[Uploadthing] ${keys.length} archivo(s) eliminado(s)`);
  } catch (err) {
    console.warn('[Uploadthing] Error al eliminar múltiples archivos:', err.message);
  }
}

module.exports = { deleteFromUploadthing, deleteMultipleFromUploadthing, extractKeyFromUrl };
