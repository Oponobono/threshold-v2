const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Threshold API',
      version: '1.0.0',
      description: 'API del backend de Threshold — aplicación offline-first para estudiantes universitarios. Gestión académica, flashcards con SM-2/FSRS, asistente IA (Zyren), y sincronización entre dispositivos.\n\n📘 Documentación completa del proyecto: ejecutar \`cd docs && npm run start\` para ver el sitio Docusaurus local.',
    },
    externalDocs: {
      description: 'Documentación completa de Threshold (Docusaurus)',
      url: 'http://localhost:3001',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor local (desarrollo)',
      },
      {
        url: 'https://threshold.onrender.com',
        description: 'Producción (Render)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};
