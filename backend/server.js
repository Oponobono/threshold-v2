require('dotenv').config();
const express = require('express');
const secrets = require('./config/secrets');
const cors = require('cors');
const multer = require('multer');
const { db, initializeDb } = require('./db');
const { swaggerUi, specs } = require('./swagger');
const helmet = require('helmet');
const { globalLimiter } = require('./middlewares/rateLimiter');
const os = require('os');

// Importar rutas
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const subjectsRoutes = require('./routes/subjects');
const assessmentsRoutes = require('./routes/assessments');
const schedulesRoutes = require('./routes/schedules');
const galleryRoutes = require('./routes/gallery');
const flashcardsRoutes = require('./routes/flashcards');
const audioRoutes = require('./routes/audio');
const youtubeRoutes = require('./routes/youtube');
const scannedDocumentsRoutes = require('./routes/scanned_documents');
const learningRoutes = require('./routes/learning');
const aiRoutes = require('./routes/ai');
const uploadRoutes = require('./routes/upload');
const backupRoutes = require('./routes/backup');
const gradingRoutes = require('./routes/grading');
const assessmentCategoriesRoutes = require('./routes/assessmentCategories');
const calendarRoutes = require('./routes/calendar');
const settingsRoutes = require('./routes/settings');

const app = express();

// Confía en el primer proxy (necesario para express-rate-limit en Render/Heroku)
app.set('trust proxy', 1);
const PORT = secrets.PORT;
const HOST = secrets.HOST;
const MAX_PORT_RETRIES = 10;

// Configurar multer para memoria (sin guardar en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/html',
      'text/markdown',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`MIME type ${file.mimetype} no soportado. Soportados: PDF, Word, TXT, HTML, Markdown`));
    }
  },
});

// Middlewares de Seguridad Globales
app.use(helmet()); // Añade cabeceras HTTP que previenen XSS, Clickjacking, etc.
app.use(globalLimiter); // Evita DDoS limitando a 100 peticiones por IP cada 15 min.

// 🛡️ Fase 6: Auditoría y Logging (Registro estructurado de accesos)
const morgan = require('morgan');
app.use(morgan(':remote-addr - :method :url :status :res[content-length] - :response-time ms'));

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Configurar Swagger (solo en desarrollo)
if (secrets.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// 🏥 Health Check Endpoint (Completamente público, sin autenticación)
// Usado por el cliente para detectar si el backend está disponible
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Ruta de estado (deprecated - usar /health)
app.get('/api/status', (req, res) => {
  res.json({ status: 'OK' });
});

// Registrar rutas públicas (Login, Registro)
app.use('/api', authRoutes);

// Ruta pública auxiliar para el flujo de registro (obtener sistemas de calificación)
const gradingController = require('./controllers/gradingController');
app.get('/api/grading-systems', gradingController.getGradingSystems);

// 🛡️ Fase 1: Escudo de Autenticación JWT
// A partir de esta línea, TODAS las rutas requerirán un token válido
const { authenticateToken } = require('./middlewares/authMiddleware');
app.use('/api', authenticateToken);

// Uploadthing — ruta de subida de archivos
app.use('/api', uploadRoutes);

// Rutas privadas
app.use('/api', usersRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', subjectsRoutes);
app.use('/api', assessmentsRoutes);
app.use('/api', schedulesRoutes);
app.use('/api', galleryRoutes);
app.use('/api', flashcardsRoutes);
app.use('/api', audioRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', scannedDocumentsRoutes);
app.use('/api', learningRoutes);
app.use('/api', aiRoutes);
app.use('/api', backupRoutes);
app.use('/api', gradingRoutes);
app.use('/api', assessmentCategoriesRoutes);
app.use('/api', calendarRoutes);
app.use('/api', settingsRoutes);



// ─── Global JSON Error Handler ────────────────────────────────────────────────
// MUST be registered AFTER all routes.
// Express 5 catches async errors automatically; this ensures they always return
// JSON instead of the default HTML 500 page.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor.';

  // Multer errors (file type rejection, size limit, etc.)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo supera el tamaño máximo permitido.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Campo de archivo inesperado.' });
  }

  console.error(`[Server] Error ${status}:`, message);
  return res.status(status).json({ error: message });
});

// ─── Helper: Obtener IP local ──────────────────────────────────────────────────
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Saltar loopback e IPs IPv6 internas
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function startServer(port, retriesLeft) {
  const server = app.listen(port, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║             ✅ SERVIDOR INICIADO                        ║
╠═══════════════════════════════════════════════════════════╣
║ URL Local: http://localhost:${port}
║ URL Red: http://${getLocalIpAddress()}:${port}
║ HOST Config: ${HOST} (${HOST === '0.0.0.0' ? '✓ Todas las interfaces' : '⚠️ Específico'})
║ 
║ 📱 Desde tu teléfono/emulador:
║ - Asegúrate de estar en la MISMA WIFI que la PC
║ - Usa: http://${getLocalIpAddress()}:${port}/api
║ 
║ 📚 Swagger Docs: http://localhost:${port}/api-docs
║ 🏥 Health Check: http://localhost:${port}/health
╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // Mantiene una referencia activa del socket del servidor.
  server.ref();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Puerto ${port} en uso. Reintentando en ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error('Error al iniciar el servidor:', err.message);
    process.exit(1);
  });
}

// 🛡️ Inicializar DB primero, LUEGO arrancar servidor
// Esto evita race conditions: el servidor no acepta peticiones
// hasta que todas las tablas y semillas estén listas.
(async () => {
  await initializeDb();
  startServer(PORT, MAX_PORT_RETRIES);
})();

