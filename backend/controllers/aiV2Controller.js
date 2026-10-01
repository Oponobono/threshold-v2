/**
 * POST /api/ai/v2/chat
 *
 * Un handler delgado a proposito
 * ------------------------------
 * Auth, cuota, validacion, resolucion de modelo, llamada y traduccion de
 * errores. No hay decision de negocio aqui dentro: si este archivo empieza a
 * decidir, significa que o el schema se quedo corto o la logica se esta
 * duplicando por el camino de v1.
 *
 * Que devuelve
 * ------------
 * 200 { data: { reply, context_truncated, meta }, error: null }
 *
 * El `error` va siempre presente, incluso a null. Un sobre que a veces trae
 * `error` y a veces no obliga al cliente a comprobar las claves antes de leer,
 * y esa comprobacion es la que se olvida en algun camino y produce un crash en
 * el movil. Un sobre de forma fija no se olvida.
 *
 * `meta` lleva solo { provider, model, attempts, requestId }. Nunca el detalle
 * de los intentos fallidos: eso es material de diagnostico del servidor y no
 * tiene por que cruzar la red para que el cliente decida que reintentar.
 */

const { sendAiError } = require('../services/ai/contracts/aiErrors');
const { validarChat } = require('../services/ai/contracts/aiV2Schema');
const { callWithModelFallback } = require('../utils/modelRegistry');
const { shieldPrompt, detectJailbreak } = require('../utils/promptShield');
const geminiService = require('../utils/geminiService');

/**
 * Que proveedor usa esta peticion.
 *
 * Copiado de aiController.getLLMProvider en vez de importado porque ahi es una
 * funcion local no exportada. Se unifica cuando se toquen las dos rutas; hoy
 * duplicar estas cinco lineas es menos arriesgado que mover la resolucion de
 * proveedor de v1, que tiene tests en produccion.
 */
function getLLMProvider(req) {
  const provider = req.query?.provider || req.body?.provider || 'groq';
  if (provider === 'local') return 'local';
  return (provider === 'gemini' || provider === 'groq') ? provider : 'groq';
}

/**
 * El prompt de sistema de Zyren.
 *
 * Va en el modulo, no dentro del handler, porque es constante: construirlo en
 * cada llamada daria a cada peticion una referencia de texto distinta y
 * compararlas en el log no diria nada.
 */
const SYSTEM_PROMPT = [
  'Eres Zyren, un tutor academico de una plataforma de aprendizaje universitario.',
  'Respondes en el idioma del estudiante.',
  'Te centras en las materias del contexto proporcionado y en explicar con claridad.',
  'Si no hay contexto, preguntas que lo delimiten en lugar de inventar materia.',
  'Prefieres ejemplos concretos sobre enumeraciones largas.',
].join(' ');

/** Quita el prefijo /api del originalUrl para que el registry vea la ruta de v1. */
function rutaInterna(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return url.replace(/^\/api/, '') || '/';
}

/**
 * Traduce un fallo del registry a un codigo publico.
 *
 * El registry distingue clases que el movil NO debe ver separadas: que un
 * proveedor rechazara la credencial (fatal, no tiene sentido reintentar) y que se
 * agotara la lista de modelos (puede tener sentido esperar) son dos cosas
 * distintas para el operador y la mismaFINALIDAD para el cliente: ahora no
 * puedes, intentalo mas tarde. Lo que si se propaga intacto es `retryable`.
 */
function enviarFalloDeProveedor(res, err, req) {
  const codigo = err && err.code ? String(err.code) : '';
  const intentos = Array.isArray(err && err.attempts) ? err.attempts.length : 0;

  console.error(`[aiV2/chat] fallo ${codigo || 'sin_codigo'} tras ${intentos} intento(s):`, err && err.message);

  if (/_AUTH_BLOCKED$/.test(codigo)) {
    // La credencial del proveedor esta rechazada. No es culpa de quien pregunta,
    // y decirlo como si lo fuera haria que el movil reintentara sin parar.
    return sendAiError(res, { code: 'INTERNAL_ERROR', message: 'Proveedor no disponible' }, req.id);
  }

  if (/_ALL_MODELS_EXHAUSTED$/.test(codigo)) {
    return sendAiError(res, { code: 'NO_MODEL_AVAILABLE', message: 'Sin modelos disponibles ahora mismo' }, req.id);
  }

  if (codigo === 'UPSTREAM_TIMEOUT') {
    return sendAiError(res, { code: 'UPSTREAM_TIMEOUT', message: 'El proveedor no respondio a tiempo' }, req.id);
  }

  return sendAiError(res, { code: 'INTERNAL_ERROR', message: 'Fallo interno' }, req.id);
}

exports.chatV2 = async (req, res) => {
  const validado = validarChat(req.body);
  if (!validado.ok) {
    return sendAiError(res, { code: validado.codigo, message: validado.detalle }, req.id);
  }

  const { messages, contextText } = validado.valor;
  const provider = getLLMProvider(req);

  // Filtro de jailbreak antes de gastar tokens: un prompt de extraccion de
  // instrucciones del sistema debe cortarse aqui, no cuando el proveedor ya ha
  // pagado por generarlo.
  const ultimoUsuario = messages.filter((m) => m.role === 'user').pop();
  const guardia = detectJailbreak(ultimoUsuario.content);
  if (!guardia.safe) {
    console.warn(`[aiV2/chat] prompt bloqueado por el escudo: ${guardia.reason}`);
    return res.status(200).json({
      data: {
        reply: {
          role: 'assistant',
          content: 'Como tu tutor Zyren, me enfoco exclusivamente en temas academicos. En que materia necesitas ayuda hoy?',
        },
        context_truncated: false,
        shield_blocked: true,
        meta: { provider, model: null, attempts: 0, requestId: req.id || null },
      },
      error: null,
    });
  }

  const inicio = Date.now();
  const contextoProtegido = shieldPrompt(contextText);

  // No se resuelve preferencia desde req: en v2 la peticion no puede traer
  // ningun control de modelo (lo rechaza el schema), asi que el ranking entero
  // queda disponible y `requestedModelId` es siempre null. Pass-through total de
  // la decision al registry, que es quien sabe que modelo esta sano ahora.
  const llamado = (model) => geminiService.processAcademicChat(
    contextoProtegido,
    messages,
    SYSTEM_PROMPT,
    { model }
  );

  try {
    const { result, resolution } = await callWithModelFallback(
      provider,
      null,
      llamado,
      { capability: 'text' }
    );

    const contenido = typeof result === 'string' ? result : result && result.content;

    return res.status(200).json({
      data: {
        reply: { role: 'assistant', content: contenido },
        context_truncated: false,
        shield_blocked: false,
        meta: {
          provider,
          model: resolution.resolvedModelId,
          attempts: 1,
          requestId: req.id || null,
        },
      },
      error: null,
    });
  } catch (err) {
    if (!res.headersSent) {
      return enviarFalloDeProveedor(res, err, req);
    }
    console.error('[aiV2/chat] fallo tras enviar respuesta:', err);
    return undefined;
  } finally {
    console.log(`[aiV2/chat] ${provider} ${Date.now() - inicio}ms ruta=${rutaInterna(req)}`);
  }
};