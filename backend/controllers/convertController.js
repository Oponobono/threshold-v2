const libre = require('libreoffice-convert');
const { promisify } = require('util');
const { execSync } = require('child_process');
const path = require('path');

const convertAsync = promisify(libre.convert);

// Log LibreOffice availability on module load
try {
  const loPath = execSync('which soffice', { encoding: 'utf8' }).trim();
  console.log('[ConvertController] LibreOffice found at:', loPath);
  const loVersion = execSync('soffice --version', { encoding: 'utf8' }).trim();
  console.log('[ConvertController]', loVersion);
} catch (e) {
  console.warn('[ConvertController] WARNING: soffice not found in PATH. PPT conversion will return 503.');
}

/**
 * POST /api/convert/presentation
 *
 * Recibe un archivo de presentación (PPTX, PPT) como multipart/form-data
 * y devuelve el PDF resultante como binary stream.
 *
 * Requiere LibreOffice instalado en el sistema.
 * En Render.com, añadir al Build Command:
 *   apt-get install -y libreoffice --no-install-recommends && npm install
 */
async function convertPresentation(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = ['.pptx', '.ppt', '.odp'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({
        error: `Extensión no soportada: ${ext}. Soportadas: ${allowed.join(', ')}`,
      });
    }

    const pdfBuffer = await convertAsync(req.file.buffer, '.pdf', undefined);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${path.basename(req.file.originalname, ext)}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[ConvertController] Error al convertir presentación:', err.message);

    const msg = (err.message || '').toLowerCase();
    if (msg.includes('soffice') || msg.includes('libreoffice') || msg.includes('enoent')) {
      return res.status(503).json({
        error: 'El servicio de conversión no está disponible. LibreOffice no está instalado en el servidor.',
        code: 'LIBREOFFICE_UNAVAILABLE',
      });
    }

    return res.status(500).json({ error: 'Error al convertir el archivo.' });
  }
}

module.exports = { convertPresentation };
