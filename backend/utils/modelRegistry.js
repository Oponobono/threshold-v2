/**
 * modelRegistry.js — Selección y fallback de modelos.
 *
 * Problema que este archivo resuelve, medido contra las APIs reales:
 *
 *  1. Los rankings apuntaban a modelos muertos. Los 4 IDs de GROQ_PRIORITY_LIST
 *     respondian 404 model_not_found o 400 model_decommissioned. Es decir, el
 *     primer modelo que se probaba en cada llamada Groq estaba retirado.
 *
 *  2. Un fallo no se distinguia de otro. parseGroqModelError devolvia un
 *     booleano, asi que un 404 (modelo retirado para siempre) y un 503 (demanda
 *     pasajera) provocaban exactamente la misma accion.
 *
 *  3. Las capacidades se inferian. MODEL_CAPABILITIES no incluia
 *     qwen/qwen3.8-27b, el unico modelo de vision de Groq que responde 200. Con
 *     la inferencia "si no esta en el mapa, es texto", la vision en Groq
 *     resolvia cero candidatos y caia a un fallback de modelos de texto, que
 *     responden 400 "content must be a string".
 *
 * Decision estructural: el catalato declarativo (config/aiModels.js) es la fuente
 * de verdad y la discovery de /models pasa a ser aditiva. Antes la cache de
 * discovery FILTRABA los candidatos, de modo que un fallo de red o un arranque
 * temprano dejaban la lista vacia. Ahora discovery informa, no gobierna.
 *
 * Compatibilidad: se conservan los exports publicos porque los consumen
 * aiController.js, geminiService.js, GroqProvider.js, GeminiProvider.js,
 * flashcardsController.js, scannedDocumentsController.js y server.js.
 */

const secrets = require('../config/secrets');
const AI_MODELS = require('../config/aiModels');
const health = require('./modelHealth');

/** provider + capability -> clave de ranking en config/aiModels.js */
const USE_KEYS = {
  'groq:text': 'chat.groq',
  'groq:vision': 'vision.groq',
  'groq:stt': 'stt.groq',
  'gemini:text': 'chat.gemini',
  'gemini:vision': 'vision.gemini',
};

function useKeyFor(provider, capability = 'text') {
  return USE_KEYS[`${provider}:${capability}`] || null;
}

/**
 * Aplica la politica de sampling declarada para un modelo.
 *
 * Gemini 3.x acepta temperature, top_p y top_k pero los ignora: medido, en
 * gemini-3.6-flash una temperatura de 0 produjo 3 salidas distintas de 3. Enviarlas
 * da la impresion de controlar el comportamiento sin controlarlo. En
 * gemini-3.5-flash si se respeta, asi que la politica es por modelo y no global.
 *
 * @param {string} modelId
 * @param {Object} params  {temperature, top_p, top_k, ...}
 * @returns {Object} params sin las claves ignoradas, o {} si el modelo ignora sampling.
 */
function applySamplingPolicy(modelId, params = {}) {
  const entry = AI_MODELS.findEntry(modelId);
  if (!entry) return { ...params };
  if (entry.sampling === 'ignored') return {};
  const { temperature, top_p, top_k, ...rest } = params;
  return {
    ...(temperature !== undefined ? { temperature } : {}),
    ...(top_p !== undefined ? { top_p } : {}),
    ...(top_k !== undefined ? { top_k } : {}),
    ...rest,
  };
}

/**
 * Candidatos para un uso, ya filtrados por el estado de salud en runtime.
 * El orden del ranking se respeta: la posicion 0 es la mejor opcion viva.
 */
function candidatesFor(provider, capability = 'text') {
  const key = useKeyFor(provider, capability);
  if (!key) return [];
  return AI_MODELS.getCandidates(key, capability === 'text' ? null : capability)
    .filter((e) => !health.isBlocked(e.id, capability === 'text' ? null : capability));
}

/**
 * IDs de modelos elegibles, ordenados por ranking y sin los bloqueados.
 * @returns {string[]}
 */
function getEligibleModels(provider, capability = 'text') {
  return candidatesFor(provider, capability).map((e) => e.id);
}

/**
 * Resuelve el modelo "automatico": el primero vivo del ranking.
 *
 * Antes este metodo tenia un caso especial que anteponia el alias rolling
 * gemini-flash-latest sobre el ranking. Ese alias devolvio 503 sostenido, y el
 * caso especial lo colocaba primero, asi que era precisamente el modelo con mas
 * probabilidad de fallar. Ahora no hay caso especial: el ranking ya coloca el
 * alias al final, donde pertenece.
 */
function resolveAutoModel(options) {
  const provider = typeof options === 'string' ? options : options.provider;
  const capability = typeof options === 'object' && options.capability ? options.capability : 'text';
  return candidatesFor(provider, capability)[0]?.id || null;
}

// Back-compat: los consumidores actuales promesses booleanos.
function parseGroqModelError(error, capability = 'text') {
  const v = health.classifyError(error, { capability });
  return v.class === 'dead' || v.class === 'incompatible';
}

function parseGeminiModelError(error, capability = 'text') {
  return parseGroqModelError(error, capability);
}

/**
 * Extrae la preferencia de modelo del request sin resolverla.
 * Precedencia: modelPreference (por feature) > clientModelPreferences[provider] > null.
 */
function resolveModelPreferenceFromRequest(req, provider) {
  const featurePreference = req.body?.modelPreference;
  if (featurePreference !== undefined) return featurePreference;
  const globalPreference = req.body?.clientModelPreferences?.[provider];
  if (globalPreference !== undefined) return globalPreference;
  return null;
}

/**
 * Construye el mensaje de error terminal listando cada candidato y su motivo.
 * Antes era un texto unico con la lista de intentados, sin explicar por que
 * fallo cada uno, que es justo el dato necesario para corregir el catalogo.
 */
function buildExhaustedError(provider, capability, attempts, exhaustedCode) {
  const lines = attempts.map(
    (a) => `  - ${a.model}: ${a.reason}${a.status ? ` (HTTP ${a.status})` : ''}`
  );
  const err = new Error(
    `Sin modelos disponibles en ${provider} para '${capability}'. Ningun candidato de `
    + `config/aiModels.js respondio:\n${lines.join('\n')}`
  );
  err.code = exhaustedCode;
  err.attempts = attempts;
  return err;
}

/**
 * Ejecuta una llamada con fallback determinista entre modelos.
 *
 * Reglas:
 *  - El default y el fallback recorren EXACTAMENTE el mismo camino. No hay
 *    rama ciega: si el cache de discovery esta vacio, el ranking sigue siendo la
 *    fuente de verdad.
 *  - dead / incompatible / transient avanzan al siguiente candidato. La razon
 *    queda registrada con un TTL acorde a la clase de fallo.
 *  - auth (401/403) corta el provider y propaga. Iterar modelos con una
 *    credencial invalida solo quema cuota.
 *  - fatal se propaga sin enmascarar.
 *
 * @param {string} provider
 * @param {string|null} requestedModelId  null o 'auto' = primer vivo del ranking
 * @param {(model:string)=>Promise<any>} apiCallFn
 * @param {Object} [options]
 * @param {string} [options.capability='text']
 * @returns {Promise<{ result:any, resolution:ResolvedModelState }>}
 */
/**
 * Extrae el texto util de una respuesta de proveedor.
 *
 * Cada consumidor devuelve una forma distinta (string, {content}, {text}, bloques
 * de vision, candidates de Gemini). Se cubren las que existen hoy para que la
 * deteccion de respuesta vacia sea fiable sin obligar a cada llamada a
 * recordarlo. Un consumidor con una forma propia pasa `options.extractText`.
 *
 * @returns {string} texto sin espacios, o '' si no hay contenido.
 */
function extractText(result, custom) {
  if (custom) {
    const t = custom(result);
    return typeof t === 'string' ? t.trim() : '';
  }
  if (result == null) return '';
  if (typeof result === 'string') return result.trim();
  if (Array.isArray(result)) return result.map((r) => extractText(r)).join('').trim();
  if (typeof result !== 'object') return '';

  // Bloques de contenido multimodal: [{type:'text', text:'...'}]
  if (Array.isArray(result.content)) return extractText(result.content);

  for (const clave of ['content', 'text', 'transcript', 'output']) {
    if (typeof result[clave] === 'string') return result[clave].trim();
  }

  // Respuesta cruda de Gemini: candidates[].content.parts[].text
  const partes = result.candidates?.[0]?.content?.parts;
  if (Array.isArray(partes)) {
    return partes.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
  }
  return '';
}

async function callWithModelFallback(provider, requestedModelId, apiCallFn, options = {}) {
  const capability = options.capability || 'text';
  const exhaustedCode = `${provider.toUpperCase()}_ALL_MODELS_EXHAUSTED`;

  if (health.isProviderBlocked(provider)) {
    const err = new Error(
      `Provider ${provider} bloqueado por credencial rechazada (401/403). `
      + 'No se reintentan modelos; revisa la API key del provider.'
    );
    err.code = `${provider.toUpperCase()}_AUTH_BLOCKED`;
    throw err;
  }

  const key = useKeyFor(provider, capability);
  if (!key) {
    throw new Error(`Uso no declarado: ${provider}/${capability}. Anade el ranking en config/aiModels.js.`);
  }

  const ranked = AI_MODELS.getCandidates(key, capability === 'text' ? null : capability);
  const attempts = [];
  const sequence = [];

  const explicit = requestedModelId && requestedModelId !== 'auto' ? requestedModelId : null;
  if (explicit) {
    const declared = ranked.find((e) => e.id === explicit);
    if (!declared) {
      console.warn(
        `[modelRegistry] ${explicit} no esta declarado para ${provider}/${capability}. `
        + `Se ignora la preferencia y se usa el ranking.`
      );
    } else {
      sequence.push(declared);
    }
  }
  for (const entry of ranked) {
    if (entry.id !== explicit) sequence.push(entry);
  }

  for (const entry of sequence) {
    const capArg = capability === 'text' ? null : capability;
    const blocked = health.isBlocked(entry.id, capArg);
    if (blocked) {
      attempts.push({ model: entry.id, reason: `descartado (${blocked})`, skipped: true });
      continue;
    }

    try {
      const result = await apiCallFn(entry.id);
      // El modelo respondio 200, asi que esta vivo: eso no se negocia. Lo que
      // puede fallar es que la respuesta no sirva.
      health.markHealthy(entry.id);

      // Medido contra Groq: los openai/gpt-oss gastan max_tokens en el campo
      // `reasoning` y pueden agotar el presupuesto antes de emitir una sola
      // palabra de respuesta. El resultado es HTTP 200 con content "" y
      // finish_reason "length", es decir response.ok === true. Sin este
      // chequeo, un cliente ingenuo devuelve un exito vacio al usuario.
      //
      // No se registra como fallo de salud: el modelo funciona, lo que se
      // agoto fue el presupuesto de la tarea. Solo se prueba el siguiente
      // candidato del ranking, que es donde esta la solucion real.
      const texto = extractText(result, options.extractText);
      if (!texto) {
        attempts.push({
          model: entry.id,
          reason: 'respuesta vacia (HTTP 200 sin contenido; el modelo consumio el presupuesto en razonamiento)',
          skipped: true,
        });
        continue;
      }

      const wasFallback = explicit !== null && entry.id !== explicit;
      return {
        result,
        resolution: {
          requestedModelId: explicit,
          resolvedModelId: entry.id,
          wasFallback,
          reason: wasFallback ? (explicit ? 'requested_unavailable' : 'ranking') : 'requested',
        },
      };
    } catch (err) {
      const verdict = health.classifyError(err, { capability: capArg });

      if (verdict.class === 'auth') {
        health.blockProvider(provider);
        attempts.push({ model: entry.id, reason: verdict.reason, status: verdict.status });
        const fatal = new Error(`Provider ${provider}: ${verdict.reason}`);
        fatal.code = `${provider.toUpperCase()}_AUTH_BLOCKED`;
        fatal.attempts = attempts;
        throw fatal;
      }

      if (verdict.class === 'fatal') {
        attempts.push({ model: entry.id, reason: verdict.reason, status: verdict.status });
        const propagated = new Error(`[modelRegistry] ${provider} fallo en ${entry.id}: ${verdict.reason}`);
        propagated.code = 'MODEL_CALL_FAILED';
        propagated.original = err;
        propagated.attempts = attempts;
        throw propagated;
      }

      health.record(entry.id, verdict);
      attempts.push({ model: entry.id, reason: verdict.reason, status: verdict.status, class: verdict.class });
      console.warn(`[modelRegistry] ${provider}: ${entry.id} -> ${verdict.class} (${verdict.reason}). Siguiente candidato.`);
    }
  }

  throw buildExhaustedError(provider, capability, attempts, exhaustedCode);
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery (informativa, no gobierna la seleccion)
// ─────────────────────────────────────────────────────────────────────────────

let cachedModels = { groq: [], gemini: [], lastUpdated: null };

async function fetchProviderCatalog(provider) {
  try {
    if (provider === 'groq') {
      if (!secrets.GROQ_API_KEY) return null;
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${secrets.GROQ_API_KEY}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.data || []).map((m) => ({ id: m.id, name: m.id, provider: 'groq' }));
    }
    if (!secrets.GEMINI_API_KEY) return null;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${secrets.GEMINI_API_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.models || [])
      .map((m) => ({ id: String(m.name).replace('models/', ''), name: m.displayName || m.name, provider: 'gemini' }))
      .filter((m) => m.id.startsWith('gemini-'));
  } catch (err) {
    console.warn(`[modelRegistry] No se pudo leer el catalogo de ${provider}: ${err.message}`);
    return null;
  }
}

/**
 * Marca como muertos los IDs de un ranking que el proveedor ya no lista.
 * Solo usa esta senal para descarte temprano; la confirmacion real la hace
 * una invocacion, porque /models lista modelos que luego devuelven 404.
 */
function reconcileWithCatalog(provider) {
  const catalog = cachedModels[provider];
  if (!catalog || catalog.length === 0) return;
  const live = new Set(catalog.map((m) => m.id));
  for (const entry of AI_MODELS.getRanking(`chat.${provider}`)) {
    if (!live.has(entry.id)) {
      health.record(entry.id, {
        class: 'dead',
        reason: 'ausente del catalogo del proveedor en /models',
      });
    }
  }
}

async function refreshModelsCache() {
  const [groq, gemini] = await Promise.all([fetchProviderCatalog('groq'), fetchProviderCatalog('gemini')]);
  if (groq) cachedModels.groq = groq;
  if (gemini) cachedModels.gemini = gemini;
  cachedModels.lastUpdated = new Date();
  reconcileWithCatalog('groq');
  reconcileWithCatalog('gemini');
  return cachedModels;
}

async function getOnlineModels(req, res) {
  if (cachedModels.groq.length === 0 || cachedModels.gemini.length === 0) {
    refreshModelsCache().catch(() => {});
  }
  const snap = health.snapshot();

  const enrich = (provider) => {
    const live = cachedModels[provider].length > 0
      ? cachedModels[provider]
      : AI_MODELS.RANKINGS[`chat.${provider}`].map((e) => ({ id: e.id, name: e.id, provider }));
    return live.map((m) => {
      const entry = AI_MODELS.findEntry(m.id);
      return {
        ...m,
        // Un modelo puede estar en el catalogo del proveedor y aun asi no
        // ser utilizable por la app. `usable` lo dice sin ambiguedad, para que
        // el selector del cliente no ofrezca una opcion que el registry luego
        // descartaria en silencio.
        usable: Boolean(entry),
        rankings: entry
          ? Object.entries(AI_MODELS.RANKINGS)
              .filter(([, entries]) => entries.some((e) => e.id === m.id))
              .map(([use]) => use)
          : [],
        // Sin declaracion no se inventan capacidades: null significa desconocido.
        capabilities: entry ? entry.caps : null,
        sampling: entry ? entry.sampling : null,
        minTokens: entry && typeof entry.minTokens === 'number' ? entry.minTokens : null,
        status: snap.dead[m.id] ? 'dead' : snap.transient[m.id] ? 'cooling' : 'ok',
        reason: snap.dead[m.id]?.reason || snap.transient[m.id]?.reason || null,
      };
    });
  };

  res.json({
    groq: enrich('groq'),
    gemini: enrich('gemini'),
    health: snap,
    // Presupuesto minimo por uso. Quien arme una llamada debe subirlo o cambiar
    // de provider: por debajo, el ranking entero devuelve vacio.
    minTokens: {
      'chat.groq': AI_MODELS.minTokensFor('chat.groq'),
      'chat.gemini': AI_MODELS.minTokensFor('chat.gemini'),
    },
    lastUpdated: cachedModels.lastUpdated,
    source: cachedModels.groq.length > 0 ? 'live' : 'ranking',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check por invocacion real
// ─────────────────────────────────────────────────────────────────────────────

const HEALTH_PROMPTS = { groq: 'ok', gemini: 'ok' };

/**
 * PNG 64x64 rojo solido, para el chequeo de capacidad de vision.
 *
 * No puede ser mas pequeno: Groq responde 400 "Image must have at least 32
 * pixels in each dimension" con un 1x1, y ese 400 describe el caller, no al
 * modelo. Para regenerarlo, cambiar W/H y reconstruir el PNG con zlib.deflateSync
 * sobre filas RGB precedidas por su byte de filtro 0.
 */
const VISION_PROBE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeUlEQVR4nO3PQQkAMAzAwCqpfymTNRF7HINABFzm7H7dcEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFj13Kp0DxHeM4GQAAAABJRU5ErkJggg==';

/**
 * Verifica un modelo con una invocacion minima. /models no sirve como prueba de
 * disponibilidad: gemini-2.5-flash aparecia listado y respondia 404 al usarlo.
 * @returns {Promise<{model:string, ok:boolean, status:number|null, reason:string}>}
 */
async function healthCheckModel(provider, modelId, capability = 'text') {
  const verdict = { model: modelId, ok: false, status: null, reason: '' };
  try {
    const prompt = HEALTH_PROMPTS[provider] || 'ok';
    // Para vision hay que mandar una imagen de verdad. Con solo texto, un modelo
    // de solo texto responderia 200 y el check no distinguiria nada, que es
    // justamente el fallo que nos trajo aqui (gpt-oss-120b en una ruta de vision).
    const wantsImage = capability === 'vision';
    if (provider === 'groq') {
      const content = wantsImage
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${VISION_PROBE_PNG_BASE64}` } },
          ]
        : prompt;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secrets.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content }],
          max_tokens: 1,
          ...applySamplingPolicy(modelId, { temperature: 0 }),
        }),
      });
      verdict.status = res.status;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const v = health.classifyError({ status: res.status, details: body }, { capability });
        verdict.reason = `${v.class}: ${v.reason}`;
        return verdict;
      }
    } else {
      const parts = wantsImage
        ? [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: VISION_PROBE_PNG_BASE64 } }]
        : [{ text: prompt }];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${secrets.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { maxOutputTokens: 1, ...applySamplingPolicy(modelId, { temperature: 0 }) },
          }),
        }
      );
      verdict.status = res.status;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const v = health.classifyError({ status: res.status, details: body }, { capability });
        verdict.class = v.class;
        verdict.reason = `${v.class}: ${v.reason}`;
        verdict.verdict = v;
        return verdict;
      }
    }
    verdict.ok = true;
    verdict.class = 'ok';
    verdict.reason = 'ok';
    health.markHealthy(modelId);
  } catch (err) {
    const v = health.classifyError(err, { capability });
    verdict.class = v.class;
    verdict.reason = `${v.class}: ${v.reason}`;
    verdict.verdict = v;
  }
  return verdict;
}

/** Comprueba todos los modelos de un ranking y registra los fallos. */
async function healthCheckProvider(provider, capability = 'text') {
  const key = useKeyFor(provider, capability);
  if (!key) return [];
  const entries = AI_MODELS.getRanking(key);
  const results = [];
  for (const entry of entries) {
    const r = await healthCheckModel(provider, entry.id, capability);
    if (r.ok) health.markHealthy(entry.id);
    // Se reutiliza el veredicto ya clasificado en lugar de reclasificar un
    // motivo formateado: con status null (fallo de red) la reclasificacion
    // daba 'fatal' y no registraba nada, y un corte de red pasaba desapercibido.
    else if (r.verdict) health.record(entry.id, r.verdict);
    results.push(r);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults vivos y listas de back-compat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Defaults como getters: se evaluan en cada acceso, asi que siempre apuntan al
 * mejor modelo vivo en ese momento. Un valor estatico congelaria en el ID la
 * decision tomada en el momento del require, que es precisamente lo que fallo
 * cuando el default era un modelo retirado.
 */
const MODEL_DEFAULTS = {};
Object.defineProperty(MODEL_DEFAULTS, 'groq', {
  enumerable: true,
  get: () => candidatesFor('groq', 'text')[0]?.id || null,
});
Object.defineProperty(MODEL_DEFAULTS, 'gemini', {
  enumerable: true,
  get: () => candidatesFor('gemini', 'text')[0]?.id || null,
});
Object.freeze(MODEL_DEFAULTS);

const GROQ_PRIORITY_LIST = AI_MODELS.getRanking('chat.groq').map((e) => e.id);
const GEMINI_PRIORITY_LIST = AI_MODELS.getRanking('chat.gemini').map((e) => e.id);

const MODEL_CAPABILITIES = {};
for (const entries of Object.values(AI_MODELS.RANKINGS)) {
  for (const e of entries) MODEL_CAPABILITIES[e.id] = e.caps;
}

/** Cadencia del health-check real por invocacion. */
const HEALTH_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Comprueba con una invocacion real el primer modelo vivo de cada ranking.
 *
 * Se toca solo la cabeza de cada ranking a proposito: cada health-check es una
 * llamada de pago, y el resto de la lista ya se clasifica en el momento en que
 * el trafico real la recorre. Basta con detectar si la cabeza del ranking esta
 * sana o si hay que bajar a otro candidato.
 */
async function runScheduledHealthChecks() {
  const runs = [
    ['groq', 'chat'], ['gemini', 'chat'],
    ['groq', 'vision'], ['gemini', 'vision'],
  ];
  const summary = [];
  for (const [provider, capability] of runs) {
    const key = useKeyFor(provider, capability);
    if (!key) continue;
    const head = candidatesFor(provider, capability)[0];
    if (!head) continue;
    const r = await healthCheckModel(provider, head.id, capability);
    if (r.ok) health.markHealthy(head.id);
    else if (r.verdict) health.record(head.id, r.verdict);
    summary.push({ provider, capability, model: head.id, ok: r.ok, class: r.class, reason: r.reason });
  }
  return summary;
}

function startBackgroundMaintenance() {
  const pruneTimer = setInterval(() => health.prune(), 30 * 60 * 1000);
  if (pruneTimer.unref) pruneTimer.unref();
  const refreshTimer = setInterval(() => { refreshModelsCache().catch(() => {}); }, 24 * 60 * 60 * 1000);
  if (refreshTimer.unref) refreshTimer.unref();
  // El discovery dice que modelos existen, no si responden. El unico control
  // que distingue "retirado" de "saturado ahora" es una invocacion real, asi
  // que se programa semanalmente. Diferido para no retrasar el arranque.
  const healthTimer = setInterval(
    () => { runScheduledHealthChecks().catch(() => {}); },
    HEALTH_CHECK_INTERVAL_MS,
  );
  if (healthTimer.unref) healthTimer.unref();
  const kick = setTimeout(() => { runScheduledHealthChecks().catch(() => {}); }, 0);
  if (kick.unref) kick.unref();
}

module.exports = {
  getOnlineModels,
  extractText,
  parseGroqModelError,
  parseGeminiModelError,
  resolveAutoModel,
  resolveModelPreferenceFromRequest,
  callWithModelFallback,
  getEligibleModels,
  candidatesFor,
  applySamplingPolicy,
  useKeyFor,
  GROQ_PRIORITY_LIST,
  GEMINI_PRIORITY_LIST,
  MODEL_CAPABILITIES,
  refreshModelsCache,
  runScheduledHealthChecks,
  healthCheckProvider,
  healthCheckModel,
  MODEL_DEFAULTS,
  startBackgroundMaintenance,
  VISION_PROBE_PNG_BASE64,
  health,
};
