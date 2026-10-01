/**
 * Router de la API de IA v2.
 *
 * Que se monta y que NO
 * ---------------------
 * Aqui no hay `authenticateToken`. El middleware global de server.js ya verifica
 * el JWT para todo /api, y v2 no es una excepcion: exentarlo dejaria un
 * agujero silencioso si alguien monta una ruta v2 fuera de este router, que es
 * exactamente el fallo que hace que el unico verificador deje de ser unico.
 *
 * El orden de este router es el que importa:
 *   1. aiLimiter  -> antes de validar el cuerpo, para que un cliente que envia
 *                    basura en bucle gaste cuota lo mismo que uno que pregunta
 *                    de verdad.
 *   2. validarChat-> el cuerpo se comprueba una vez, aqui, no en cada handler.
 */

const express = require('express');
const { aiLimiter } = require('../middlewares/rateLimiter');
const aiV2Controller = require('../controllers/aiV2Controller');

const router = express.Router();

router.use(aiLimiter);

router.post('/chat', aiV2Controller.chatV2);

module.exports = router;