const express = require('express');
const router = express.Router();
const multer = require('multer');
const { convertPresentation } = require('../controllers/convertController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.oasis.opendocument.presentation',
      'application/octet-stream', // fallback para algunos SO que no envían el MIME correcto
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Permitir también si el nombre termina en .pptx/.ppt aunque el MIME sea genérico
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (ext === 'pptx' || ext === 'ppt' || ext === 'odp') {
        cb(null, true);
      } else {
        cb(new Error(`Tipo de archivo no soportado para conversión: ${file.mimetype}`));
      }
    }
  },
});

/**
 * POST /api/convert/presentation
 * Convierte una presentación PPTX/PPT a PDF.
 * Body: multipart/form-data con campo 'file'.
 * Response: application/pdf (binary).
 */
router.post('/convert/presentation', upload.single('file'), convertPresentation);

module.exports = router;
