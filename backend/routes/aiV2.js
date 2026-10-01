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
const multer = require('multer');
const { aiLimiter } = require('../middlewares/rateLimiter');
const aiV2Controller = require('../controllers/aiV2Controller');

const router = express.Router();
const upload = multer({ dest: 'temp/' });

router.use(aiLimiter);

router.post('/chat', aiV2Controller.chatV2);
router.post('/transcribe', upload.single('chunk'), aiV2Controller.transcribeV2);

/**
 * El precalentamiento va por el MISMO limiter que el chat, a proposito.
 *
 * Con /status sin cota, un movil que reintenta el wake en bucle consume la cuota
 * de un endpoint pensado para ser barato. Con el limiter compartido, el
 * precalentamiento no puede gastar la cuota que el chat necesita.
 */
router.get('/status', aiV2Controller.statusV2);

module.exports = router;