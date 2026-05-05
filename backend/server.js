require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initializeDb } = require('./db');
const { swaggerUi, specs } = require('./swagger');

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

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_PORT_RETRIES = 10;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Inicializar la base de datos y crear tablas
initializeDb();

// Configurar Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Ruta de estado
app.get('/api/status', (req, res) => {
  const dbType = process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite';
  res.json({ 
    status: 'API funcionando correctamente', 
    db: dbType,
    env: process.env.NODE_ENV || 'development'
  });
});

// Registrar rutas
app.use('/api', authRoutes);
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



function startServer(port, retriesLeft) {
  const server = app.listen(port, HOST, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log(`Documentación de Swagger disponible en http://localhost:${port}/api-docs`);
    console.log('Para celular, usa la IP local de esta PC (ej: 192.168.x.x).');
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

startServer(PORT, MAX_PORT_RETRIES);

