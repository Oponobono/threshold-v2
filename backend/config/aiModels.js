/**
 * aiModels.js — Catálogo declarativo de modelos de IA.
 *
 * Este archivo es la ÚNICA fuente de verdad sobre qué modelos usar y para qué.
 * No hace red. No decide. Solo describe.
 *
 * Principios:
 *
 *  1. Las capacidades se DECLARAN, nunca se infieren. Un modelo ausente de un
 *     ranking no es un candidato. Esto reemplaza el fallback a `['text']` que
 *     causó que las rutas de visión nunca resolvieran en Groq.
 *
 *  2. Los rankings son cortos y están separados por uso. Un mismo modelo puede
 *     ser la opción principal para chat y no existir para visión.
 *
 *  3. Todo ranking es sobreescribible por variable de entorno, para que una
 *     deprecación se corrija sin deploy.
 *
 *  4. `sampling` se declara porque en Gemini 3.x los parámetros de muestreo se
 *     aceptan pero se IGNORAN (medido: temp=0 produce salidas distintas en
 *     gemini-3.6-flash, idénticas en gemini-3.5-flash). Enviarlos da una falsa
 *     sensación de control sobre el comportamiento del modelo.
 *
 * Procedencia de los estados (verificado por invocación contra las APIs, no por
 * lectura de documentación — un modelo puede aparecer en /models y dar 404):
 *
 *   INVOCADO OK    groq: gpt-oss-120b, gpt-oss-20b, qwen3.8-27b, whisper-large-v3,
 *                         whisper-large-v3-turbo
 *                  gemini: gemini-3.6-flash, gemini-3.5-flash
 *   INVOCADO 404   groq: llama-3.1-8b-instant, llama-3.3-70b-versatile, qwen3.6-27b,
 *                         llama-4-scout-17b-16e-instruct (404 model_not_found)
 *                         llama-3.1-70b-versatile, llama-3.2-11b-vision-preview
 *                         (400 model_decommissioned)
 *                  gemini: gemini-2.0-flash, gemini-2.0-flash-exp, gemini-pro,
 *                         gemini-2.5-flash, gemini-2.5-flash-lite
 *   SIN VERIFICAR  gemini-3.8-flash, gemini-3.7-flash, gemini-flash-latest
 *                  (503 "high demand" sostenido al momento de la prueba; el
 *                  health-check de arranque los resuelve sin intervención)
 *
 *   VISIÓN CON IMAGEN REAL (PNG 64x64, no solo /models):
 *                  OK      qwen/qwen3.8-27b, gemini-3.6-flash, gemini-3.5-flash
 *                  503     gemini-3.8-flash, gemini-3.7-flash
 *                  400     openai/gpt-oss-120b, openai/gpt-oss-20b
 *                          ("messages[0].content must be a string" -> texto
 *                          puro, NO es que esten muertos)
 *
 *   El 503 de 3.7 y 3.8 es transitorio, no una retirada: por eso el ranking de
 *   visión los mantiene arriba y la caché los mete en cooldown en vez de
 *   marcarlos como muertos. Si se retiraran, esa decisión quedaría congelada en
 *   el catálogo durante 6 horas sin poder volver atrás.
 */

/** Capacidades soportadas. */
const CAPS = Object.freeze({
  TEXT: 'text',
  VISION: 'vision',
  STT: 'stt',
});

/**
 * Un ranking es un array de entradas. El orden ES la prioridad: la posición 0
 * es la opción principal. Ningún modelo fuera de este array es candidato para
 * el uso correspondiente, sin importar qué devuelva /models.
 *
 * @typedef {Object} RankingEntry
 * @property {string} id               ID del modelo tal cual lo expone el proveedor.
 * @property {string[]} caps           Capacidades declaradas. Sin inferencia.
 * @property {'honored'|'ignored'} sampling  Si el proveedor respeta temperature/top_p/top_k.
 * @property {number} [minTokens]      Presupuesto mínimo de max_tokens para que llegue
 *                                      a emitir texto. Ausente = no medido.
 * @property {string} [note]           Contexto para quien lea esto en 6 meses.
 */

/** Rankings por defecto. Un env var por ranking: lista de IDs separados por coma. */
const DEFAULT_RANKINGS = {
  // ── Chat por texto ────────────────────────────────────────────────────────
  'chat.groq': [
    { id: 'openai/gpt-oss-120b', caps: [CAPS.TEXT], sampling: 'honored', minTokens: 64, note: 'Verificado 200. Sustituye a llama-3.3-70b-versatile. ES RAZONADOR: emite en un campo `reasoning` aparte y esos tokens consumen max_tokens. Medido: con 32 devuelve HTTP 200 y content "" (finish_reason=length).' },
    { id: 'openai/gpt-oss-20b', caps: [CAPS.TEXT], sampling: 'honored', minTokens: 64, note: 'Verificado 200. Sustituye a llama-3.1-8b-instant, más rápido. Razonador con el mismo límite de presupuesto que el 120b: ambos devuelven vacío por debajo de 64 tokens.' },
  ],

  'chat.gemini': [
    { id: 'gemini-3.8-flash', caps: [CAPS.TEXT], sampling: 'ignored', note: 'GA. Más capaz de la línea Flash. El error 404 de gemini-2.0-flash lo recomienda explícitamente.' },
    { id: 'gemini-3.7-flash', caps: [CAPS.TEXT], sampling: 'ignored' },
    { id: 'gemini-3.6-flash', caps: [CAPS.TEXT], sampling: 'ignored', note: 'Verificado 200. A/B medido: ignora sampling.' },
    { id: 'gemini-3.5-flash', caps: [CAPS.TEXT], sampling: 'honored', note: 'Verificado 200. Último modelo que aún respeta sampling.' },
    { id: 'gemini-flash-latest', caps: [CAPS.TEXT], sampling: 'ignored', note: 'Alias rolling. Último recurso a propósito: un cambio de alias no debe alterar el comportamiento sin que se note.' },
  ],

  // ── Visión ────────────────────────────────────────────────────────────────
  'vision.gemini': [
  { id: 'gemini-3.8-flash', caps: [CAPS.VISION], sampling: 'ignored', note: 'Listado en /models. VISION SIN CONFIRMAR: 503 high demand en la prueba con imagen real. Se clasifica transient, no dead.' },
  { id: 'gemini-3.7-flash', caps: [CAPS.VISION], sampling: 'ignored', note: 'Listado en /models. VISION SIN CONFIRMAR: 503 high demand en la prueba con imagen real. Se clasifica transient, no dead.' },
  { id: 'gemini-3.6-flash', caps: [CAPS.VISION], sampling: 'ignored', note: 'VERIFICADO 200 con imagen real. No solo aparece en /models: lee de verdad.' },
  { id: 'gemini-3.5-flash', caps: [CAPS.VISION], sampling: 'honored', note: 'VERIFICADO 200 con imagen real, y el único 3.x que además respeta sampling.' },
  ],

  // Fallback, no ruta primaria. Es Preview y su predecesor se apago cuatro
  // semanas despues de su release. Ademas tiene limite de 20MB por archivo,
  // que los PDFs escaneados de una clase superan con facilidad.
  // Verificado leyendo una imagen real.
  'vision.groq': [
    { id: 'qwen/qwen3.8-27b', caps: [CAPS.VISION], sampling: 'honored', note: 'FALLBACK. Preview, 20MB máx. gpt-oss-120b es texto puro (rechaza image_url).' },
  ],

  // ── Transcripción de voz ──────────────────────────────────────────────────
  'stt.groq': [
    { id: 'whisper-large-v3-turbo', caps: [CAPS.STT], sampling: 'honored', note: 'Verificado 200. ~2.8x más barato que large-v3.' },
    { id: 'whisper-large-v3', caps: [CAPS.STT], sampling: 'honored', note: 'Verificado 200. WER más bajo; fallback si turbo degrada en español.' },
  ],
};

/**
 * Permite sobreescribir un ranking completo por variable de entorno sin tocar
 * el código ni desplegar. Ejemplo:
 *
 *   RANKING_CHAT_GROQ=openai/gpt-oss-20b,openai/gpt-oss-120b
 *
 * El env var aporta el ORDEN (que es el ranking). Las capacidades y la política
 * de sampling se resuelven contra DEFAULT_RANKINGS; un ID que no exista ahí se
 * trata como texto-honored y el health-check lo corrige.
 */
function applyEnvOverrides(rankings) {
  const resolved = {};

  for (const [key, entries] of Object.entries(rankings)) {
    const envName = `RANKING_${key.toUpperCase().replace(/\./g, '_')}`;
    const override = process.env[envName];

    if (!override) {
      resolved[key] = entries.map((e) => ({ ...e }));
      continue;
    }

    const ids = override.split(',').map((s) => s.trim()).filter(Boolean);
    const byId = new Map(entries.map((e) => [e.id, e]));

    resolved[key] = ids.map((id) => {
      const known = byId.get(id);
      if (known) return { ...known };
      console.warn(
        `[aiModels] ${envName} referencia '${id}', que no está en el catálogo por defecto. ` +
        `Se asume texto/honored hasta que el health-check lo verifique.`
      );
      return { id, caps: [CAPS.TEXT], sampling: 'honored', note: 'Introducido por env var, sin metadatos declarados.' };
    });

    console.log(`[aiModels] Ranking '${key}' sobreescrito por ${envName}: ${ids.join(', ')}`);
  }
  return Object.freeze(resolved);
}

const RANKINGS = applyEnvOverrides(DEFAULT_RANKINGS);

/** Usos conocidos. `callWithModelFallback` rechaza cualquier otro. */
const USES = Object.freeze(Object.keys(DEFAULT_RANKINGS));

/** Entradas de un uso, o array vacío si el uso no existe. */
function getRanking(use) {
  return RANKINGS[use] || [];
}

/** Todas las entradas de un uso que declaran una capacidad. */
function getCandidates(use, capability) {
  if (!capability) return getRanking(use);
  return getRanking(use).filter((e) => e.caps.includes(capability));
}

/** Busca la declaración de un modelo en cualquier ranking. */
function findEntry(modelId) {
  for (const entries of Object.values(RANKINGS)) {
    const hit = entries.find((e) => e.id === modelId);
    if (hit) return hit;
  }
  return null;
}

/** Un modelo vivo es uno que aparece en algun ranking. Evita dar capacidades a un ID muerto. */
function isKnownModel(modelId) {
  return findEntry(modelId) !== null;
}

/**
 * Presupuesto mínimo de max_tokens para que un uso pueda devolver texto.
 *
 * Devuelve el MAYOR minTokens declarado en el ranking: es el umbral que hay
 * que superar para que AL MENOS un candidato pueda responder. Con 0 no hay
 * ninguno declarado y no se presupone nada.
 *
 * Motivo: los openai/gpt-oss son razonadores y consumen el presupuesto antes de
 * emitir la primera palabra. Con un max_tokens ajustado, TODOS los candidatos
 * de chat.groq devuelven HTTP 200 con content vacio, y el ranking entero queda
 * inutilizable para esa tarea. Quien arme la llamada necesita poder leer esto
 * antes de elegir el presupuesto.
 */
function minTokensFor(use) {
  const declared = getRanking(use)
    .map((e) => e.minTokens)
    .filter((n) => typeof n === 'number' && n > 0);
  return declared.length ? Math.max(...declared) : 0;
}

module.exports = {
  CAPS,
  RANKINGS,
  USES,
  DEFAULT_RANKINGS,
  getRanking,
  getCandidates,
  findEntry,
  isKnownModel,
  minTokensFor,
};
