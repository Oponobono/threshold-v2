/**
 * Contrato de la API de IA v2.
 *
 * Que es y que no es
 * -----------------
 * Este modulo NO contiene logica de negocio. Es el unico sitio donde se
 * declara la forma que tiene una peticion y una respuesta de v2. Los handlers
 * importan de aqui, y ningun handler define su propia forma.
 *
 * Por que un modulo aparte y no validation en cada handler
 * -------------------------------------------------------
 * Si cada endpoint valida por su cuenta, cada uno olvida algo distinto: uno
 * acepta un array vacio, otro un string de 50 MB, otro no comprueba el limite
 * de mensajes. El primer fallo de ese tipo no aparece en los tests (que
 * prueban el camino bueno) sino en produccion, con un 500 y un movil que se
 * queda pensando. Declarar el esquema una vez hace que "que se considera una
 * peticion valida" sea una respuesta consultable, no una suma de intuiciones.
 *
 * Que devuelve
 * ------------
 * { ok: true, valor } o { ok: false, status, codigo, detalle }. Nunca lanza:
 * la validacion no debe ser una fuente de 500, y si lo fuera, el error seria
 * del mismo tipo que los que valida, que es circular.
 */

const { AI_ERRORS } = require('./aiErrors');

const LIMITE_MENSAJES = 100;
const LIMITE_CHARS_POR_MENSAJE = 32000;
const LIMITE_CHARS_CONTEXTO = 60000;

/**
 * Normaliza y comprueba `messages`.
 *
 * Lo que se acepta: [{ role, content }] donde role es 'user' | 'assistant' |
 * 'system'. Se exige al menos un mensaje de usuario porque sin el no hay
 * pregunta que responder, y devolver un 200 con un texto generico seria
 * confuso: el cliente creeria que la IA funcionan.
 */
function validarMensajes(messages) {
  if (!Array.isArray(messages)) {
    return { ok: false, status: 400, codigo: 'INVALID_REQUEST', detalle: 'messages debe ser un array' };
  }
  if (messages.length === 0) {
    return { ok: false, status: 400, codigo: 'INVALID_REQUEST', detalle: 'messages esta vacio' };
  }
  if (messages.length > LIMITE_MENSAJES) {
    return {
      ok: false,
      status: 413,
      codigo: 'PAYLOAD_TOO_LARGE',
      detalle: `messages supera el limite de ${LIMITE_MENSAJES}`,
    };
  }

  const rolesValidos = new Set(['user', 'assistant', 'system']);
  const salida = [];

  for (const [indice, m] of messages.entries()) {
    if (!m || typeof m !== 'object') {
      return { ok: false, status: 400, codigo: 'INVALID_REQUEST', detalle: `messages[${indice}] no es un objeto` };
    }
    if (!rolesValidos.has(m.role)) {
      return {
        ok: false,
        status: 400,
        codigo: 'INVALID_REQUEST',
        detalle: `messages[${indice}].role no es valido`,
      };
    }
    if (typeof m.content !== 'string') {
      return {
        ok: false,
        status: 400,
        codigo: 'INVALID_REQUEST',
        detalle: `messages[${indice}].content no es texto`,
      };
    }
    if (m.content.length > LIMITE_CHARS_POR_MENSAJE) {
      return {
        ok: false,
        status: 413,
        codigo: 'PAYLOAD_TOO_LARGE',
        detalle: `messages[${indice}].content supera el limite de caracteres`,
      };
    }

    salida.push({ role: m.role, content: m.content });
  }

  if (!salida.some((m) => m.role === 'user')) {
    return {
      ok: false,
      status: 400,
      codigo: 'INVALID_REQUEST',
      detalle: 'se requiere al menos un mensaje con role=user',
    };
  }

  return { ok: true, valor: salida };
}

/**
 * El contexto de la materia es opcional, pero si viene tiene que ser texto y
 * cabe. Truncarlo en silencio seria peor que rechazarlo: el usuario creeria que
 * la IA vio todo su material cuando en realidad recibio solo una parte.
 */
function validarContexto(context) {
  if (context === undefined || context === null || context === '') {
    return { ok: true, valor: '' };
  }
  if (typeof context !== 'string') {
    return { ok: false, status: 400, codigo: 'INVALID_REQUEST', detalle: 'context_text no es texto' };
  }
  if (context.length > LIMITE_CHARS_CONTEXTO) {
    return {
      ok: false,
      status: 413,
      codigo: 'PAYLOAD_TOO_LARGE',
      detalle: `context_text supera el limite de ${LIMITE_CHARS_CONTEXTO} caracteres`,
    };
  }
  return { ok: true, valor: context };
}

/**
 * Valida el cuerpo entero de /chat y devuelve el chat ya normalizado.
 *
 * Se expone como una unidad (no como varias llamadas sueltas) porque el orden
 * de los chequeos importa: si `messages` esta mal formado no se pierde tiempo
 * midiendo el contexto, y el error que se ve es el del problema real.
 */
function validarChat(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, codigo: 'INVALID_REQUEST', detalle: 'cuerpo vacio o no JSON' };
  }

  const mensajes = validarMensajes(body.messages);
  if (!mensajes.ok) return mensajes;

  const contexto = validarContexto(body.context_text);
  if (!contexto.ok) return contexto;

  const modelPreference = normalizarPreferencia(body.model_preference);

  return {
    ok: true,
    valor: {
      messages: mensajes.valor,
      contextText: contexto.valor,
      modelPreference,
    },
  };
}

/**
 * La preferencia de modelo llega del movil y no es de fiar: un cliente
 * manipulado puede pedir un id cualquiera. Se acepta solo la forma que el
 * registry entiende, y cualquier otra cosa se degrada a 'auto' en lugar de
 * fallar, porque elegir modelo no es un error del usuario sino una opcion.
 */
function normalizarPreferencia(preferencia) {
  if (!preferencia || typeof preferencia !== 'object') return null;

  const modo = preferencia.mode;
  if (modo !== 'auto' && modo !== 'manual') return null;
  if (modo === 'manual' && typeof preferencia.modelId !== 'string') return null;
  if (modo === 'manual' && preferencia.modelId === '') return null;

  return modo === 'manual'
    ? { mode: 'manual', modelId: preferencia.modelId }
    : { mode: 'auto' };
}

module.exports = {
  LIMITE_MENSAJES,
  LIMITE_CHARS_POR_MENSAJE,
  LIMITE_CHARS_CONTEXTO,
  validarChat,
  validarMensajes,
  validarContexto,
  normalizarPreferencia,
  AI_ERRORS,
};