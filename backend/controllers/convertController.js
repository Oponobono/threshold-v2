const libre = require('libreoffice-convert');
const { promisify } = require('util');
const path = require('path');

const convertWithOptionsAsync = promisify(libre.convertWithOptions);

// Allowlist of environment variables required by LibreOffice to function across platforms
// Explicitly strips all application secrets (JWT_SECRET, DATABASE_URL, etc.)
const SAFE_ENV_VARS = [
  'PATH',
  'HOME',
  'TMPDIR',
  'USERPROFILE',
  'SystemRoot',
  'SystemDrive',
  'TEMP',
  'TMP',
  'APPDATA',
  'LOCALAPPDATA'
];

function getSafeEnv() {
  const safeEnv = {};
  for (const key of SAFE_ENV_VARS) {
    if (process.env[key] !== undefined) {
      safeEnv[key] = process.env[key];
    }
  }
  return safeEnv;
}

/**
 * POST /api/convert/presentation
 *
 * Recibe un archivo de presentación (PPTX, PPT, ODP) como multipart/form-data
 * y devuelve el PDF resultante como binary stream.
 *
 * Emplea process hardening:
 * - Timeout de 60 segundos (mitiga DoS)
 * - Entorno restringido (mitiga exposición de secretos ante RCE)
 * - Flags no interactivos
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

    const options = {
      execOptions: {
        env: getSafeEnv(),
        timeout: 60000, // 60 segundos
      },
      sofficeAdditionalArgs: [
        '--nologo',
        '--nodefault',
        '--norestore',
        '--invisible',
        '--nofirststartwizard',
      ],
    };

    const pdfBuffer = await convertWithOptionsAsync(req.file.buffer, '.pdf', undefined, options);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${path.basename(req.file.originalname, ext)}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[ConvertController] Error al convertir presentación:', err.message);

    const msg = (err.message || '').toLowerCase();
    if (msg.includes('soffice') || msg.includes('libreoffice') || msg.includes('enoent') || msg.includes('could not find soffice binary')) {
      return res.status(503).json({
        error: 'El servicio de conversión no está disponible. LibreOffice no está instalado en el servidor.',
        code: 'LIBREOFFICE_UNAVAILABLE',
      });
    }

    if (msg.includes('timeout') || err.killed) {
      return res.status(408).json({
        error: 'El procesamiento del documento excedió el tiempo límite (60s).',
        code: 'CONVERSION_TIMEOUT',
      });
    }

    return res.status(500).json({ error: 'Error al convertir el archivo.' });
  }
}

module.exports = { convertPresentation, getSafeEnv };

