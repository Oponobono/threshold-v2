const secrets = require('../config/secrets');

// Allow-lists for chat models
const GROQ_ALLOW_LIST = [
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'llama-3.2-1b-preview',
  'llama-3.2-3b-preview',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

const GEMINI_ALLOW_LIST = [
  'gemini-flash-latest',   // rolling alias oficial (preferido)
  'gemini-3.6-flash',      // modelo estable GA reciente
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-pro',
];

// Gemini: alias rolling primero, luego versiones pineadas en orden de preferencia
const GEMINI_PRIORITY_LIST = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-pro',
];

// Fallback priority lists (first is highest priority)
// Esto actúa como *Ranking* (nuestra preferencia entre modelos compatibles)
const GROQ_PRIORITY_LIST = [
  'qwen/qwen3.6-27b',      // Añadido como preferencia para visión/texto
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'openai/gpt-oss-120b'
];

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY REGISTRY (Metadata Curada)
// ─────────────────────────────────────────────────────────────────────────────
// Define las capacidades especiales de los modelos.
// Si un modelo descubierto no está aquí, asumimos que su capability es ['text'].
const MODEL_CAPABILITIES = {
  // Groq Vision
  'qwen/qwen3.6-27b': ['text', 'vision'],
  'llama-3.2-11b-vision-preview': ['text', 'vision'],
  'llama-3.2-90b-vision-preview': ['text', 'vision'],
  'meta-llama/llama-4-scout-17b-16e-instruct': ['text', 'vision'], // Deprecado, pero mapeado por si resucita/vuelve a aparecer
  
  // Gemini Vision (todos los actuales del allow-list soportan visión)
  'gemini-flash-latest': ['text', 'vision'],
  'gemini-3.6-flash': ['text', 'vision'],
  'gemini-2.0-flash': ['text', 'vision'],
  'gemini-2.0-flash-exp': ['text', 'vision'],
  'gemini-2.5-flash': ['text', 'vision'],
  'gemini-2.5-flash-lite': ['text', 'vision'],
  'gemini-pro': ['text', 'vision']
};

let cachedModels = {
  groq: [],
  gemini: [],
  lastUpdated: null
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY & SELECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cruza Discovery (API) + Capability (Metadata) + Ranking (Priority Lists)
 * @param {string} provider - 'groq' | 'gemini'
 * @param {string} capability - 'text' | 'vision'
 * @returns {string[]} Lista ordenada de IDs de modelos elegibles
 */
function getEligibleModels(provider, capability = 'text') {
  const discovered = cachedModels[provider] || [];
  
  // 1. Filtrar por capability
  const eligible = discovered.filter(m => {
    const caps = MODEL_CAPABILITIES[m.id] || ['text'];
    return caps.includes(capability);
  });
  
  // 2. Ordenar por Ranking (Priority List)
  const priorityList = provider === 'groq' ? GROQ_PRIORITY_LIST : GEMINI_PRIORITY_LIST;
  
  eligible.sort((a, b) => {
    const idxA = priorityList.indexOf(a.id);
    const idxB = priorityList.indexOf(b.id);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1; // Si no está en la priority list, va al final
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
  
  return eligible.map(m => m.id);
}

// Error parsers
function parseGroqModelError(error) {
  if (error?.status === 400 || error?.status === 404) {
    const errorBody = error.details || error.message;
    const msgToCheck = (typeof errorBody === 'string') 
      ? errorBody 
      : (errorBody?.error?.message || error.message || '');
      
    const lower = msgToCheck.toLowerCase();
    if (lower.includes('model') && (lower.includes('does not exist') || lower.includes('not found') || lower.includes('decommissioned'))) {
      return true;
    }
  }
  return false;
}

function parseGeminiModelError(error) {
  if (error?.status === 404) {
    const errorBody = error.details || error.message;
    if (typeof errorBody === 'string') {
      const lower = errorBody.toLowerCase();
      if (lower.includes('not_found') && lower.includes('models/')) {
        return true;
      }
    }
    if (error?.error?.status === 'NOT_FOUND' && error?.error?.message?.includes('models/')) {
      return true;
    }
  }
  return false;
}

/**
 * Resuelve el modelo "Automático" para un proveedor y capacidad.
 * @param {string|Object} options - Provider ('groq'|'gemini') o objeto { provider, capability }
 */
function resolveAutoModel(options) {
  const provider = typeof options === 'string' ? options : options.provider;
  const capability = typeof options === 'object' && options.capability ? options.capability : 'text';
  
  if (provider === 'gemini') {
    const GEMINI_ROLLING_ALIAS = 'gemini-flash-latest';
    // Validate contra live cache
    if (cachedModels.gemini.some(cm => cm.id === GEMINI_ROLLING_ALIAS)) {
      const caps = MODEL_CAPABILITIES[GEMINI_ROLLING_ALIAS] || ['text'];
      if (caps.includes(capability)) return GEMINI_ROLLING_ALIAS;
    }
  }
  
  const eligible = getEligibleModels(provider, capability);
  if (eligible.length > 0) return eligible[0];
  
  // Fallback extremo si la caché está vacía
  const defaultList = provider === 'groq' ? GROQ_PRIORITY_LIST : GEMINI_PRIORITY_LIST;
  return defaultList[0];
}

// Defaults para exportar a otros controladores
const MODEL_DEFAULTS = {
  groq: GROQ_PRIORITY_LIST[0],
  gemini: 'gemini-flash-latest',
};

// TODO (Deuda Técnica - Tanda 3):
// Las listas GROQ_ALLOW_LIST y GEMINI_ALLOW_LIST actuales actúan como un filtro rígido en Discovery.
// Esto impide que Threshold descubra orgánicamente nuevos modelos cuando el proveedor los publica.
// Deberán ser eliminadas en el futuro para que getEligibleModels trabaje sobre el catálogo completo.

async function fetchGroqModels() {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${secrets.GROQ_API_KEY}` }
    });
    if (!response.ok) throw new Error('Failed to fetch Groq models');
    const data = await response.json();
    return data.data
      .map(m => ({ id: m.id, name: m.id, provider: 'groq' }))
      .filter(m => GROQ_ALLOW_LIST.includes(m.id));
  } catch (error) {
    console.warn('[modelRegistry] Error fetching Groq models:', error.message);
    return null;
  }
}

async function fetchGeminiModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${secrets.GEMINI_API_KEY}`);
    if (!response.ok) throw new Error('Failed to fetch Gemini models');
    const data = await response.json();
    return data.models
      .map(m => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name, provider: 'gemini' }))
      .filter(m => GEMINI_ALLOW_LIST.includes(m.id));
  } catch (error) {
    console.warn('[modelRegistry] Error fetching Gemini models:', error.message);
    return null;
  }
}

async function refreshModelsCache() {
  console.log('[modelRegistry] Refreshing models cache...');
  
  const groqModels = await fetchGroqModels();
  if (groqModels) {
    cachedModels.groq = groqModels;
  }
  
  const geminiModels = await fetchGeminiModels();
  if (geminiModels) {
    cachedModels.gemini = geminiModels;
  }
  
  cachedModels.lastUpdated = new Date();
  console.log(`[modelRegistry] Cache updated. Groq: ${cachedModels.groq.length}, Gemini: ${cachedModels.gemini.length}`);
}

async function getOnlineModels(req, res) {
  // If cache is empty for either, try to fetch in background (non-blocking)
  if (cachedModels.groq.length === 0 || cachedModels.gemini.length === 0) {
    refreshModelsCache().catch(err => {
      console.warn('[modelRegistry] Background refresh failed:', err.message);
    });
  }

  // Build response: use live cache if available, otherwise fall back to static lists
  const groqModels = cachedModels.groq.length > 0
    ? cachedModels.groq
    : GROQ_ALLOW_LIST.map(id => ({ id, name: id, provider: 'groq' }));

  const geminiModels = cachedModels.gemini.length > 0
    ? cachedModels.gemini
    : GEMINI_ALLOW_LIST.map(id => ({ id, name: id, provider: 'gemini' }));

  // Enrich with capability metadata
  const enriched = (models, provider) => models.map(m => ({
    ...m,
    capabilities: MODEL_CAPABILITIES[m.id] || ['text'],
  }));

  res.json({
    groq: enriched(groqModels, 'groq'),
    gemini: enriched(geminiModels, 'gemini'),
    lastUpdated: cachedModels.lastUpdated,
    source: cachedModels.groq.length > 0 ? 'live' : 'static',
  });
}

/**
 * Extrae la intención/preferencia de modelo desde el request.
 * NO resuelve el modelo — eso lo hace el Registry.
 *
 * Precedencia:
 *   1. modelPreference     ← Feature-specific (máxima autoridad)
 *   2. clientModelPreferences[provider]  ← Preferencia global del usuario
 *   3. null               ← Auto
 *
 * @param {Object} req - Express request
 * @param {string} provider - 'groq' | 'gemini'
 * @returns {{ mode: 'auto' } | { mode: 'manual', modelId: string } | null}
 */
function resolveModelPreferenceFromRequest(req, provider) {
  const featurePreference = req.body?.modelPreference;

  if (featurePreference !== undefined) {
    return featurePreference;
  }

  const globalPreference = req.body?.clientModelPreferences?.[provider];

  if (globalPreference !== undefined) {
    return globalPreference;
  }

  return null;
}

/**
 * Helper universal de resiliencia basado en Capability Registry.
 *
 * Acepta una preferencia estructurada (AIModelPreference) en lugar de un initialModel string.
 * Produce un ResolvedModelState completo con requestedModelId, resolvedModelId, wasFallback y reason.
 *
 * @param {string} provider - 'groq' | 'gemini'
 * @param {string|null} requestedModelId - Modelo solicitado explícitamente (null = Auto)
 * @param {Function} apiCallFn - async (model: string) => any — la llamada real a la API
 * @param {Object} [options]
 * @param {string} [options.capability] - Capacidad requerida (ej. 'vision'). Por defecto 'text'.
 * @returns {Promise<{ result: any, resolution: ResolvedModelState }>}
 * @throws Error con .code = 'GROQ_ALL_MODELS_EXHAUSTED' | 'GEMINI_ALL_MODELS_EXHAUSTED'
 */
async function callWithModelFallback(provider, requestedModelId, apiCallFn, options = {}) {
  const isGroq = provider === 'groq';
  const isModelError = isGroq ? parseGroqModelError : parseGeminiModelError;
  const capability = options.capability || 'text';
  const exhaustedCode = isGroq ? 'GROQ_ALL_MODELS_EXHAUSTED' : 'GEMINI_ALL_MODELS_EXHAUSTED';

  // 1. Obtener modelos elegibles actuales desde el Discovery
  const eligibleModels = getEligibleModels(provider, capability);
  
  // 2. Construir la secuencia de reintentos
  const modelsToTry = [];
  
  // Si requestedModelId está en la caché y es elegible, lo intentamos primero
  if (requestedModelId && eligibleModels.includes(requestedModelId)) {
    modelsToTry.push(requestedModelId);
  } else if (requestedModelId) {
    // Si no está disponible/elegible, no lo intentamos a ciegas, pero sí lo registramos
    console.warn(`[modelRegistry] requestedModelId ${requestedModelId} no disponible o sin capability '${capability}'. Saltando al fallback...`);
  }
  
  // Agregar el resto de modelos elegibles según su Ranking
  for (const m of eligibleModels) {
    if (m !== requestedModelId) modelsToTry.push(m);
  }
  
  // Fallback de último recurso: si la caché está vacía
  if (modelsToTry.length === 0) {
    console.warn(`[modelRegistry] No hay modelos elegibles en caché para ${provider} [${capability}]. Usando fallback ciego.`);
    modelsToTry.push(requestedModelId || (isGroq ? GROQ_PRIORITY_LIST[0] : GEMINI_PRIORITY_LIST[0]));
  }

  // 3. Ejecutar la secuencia
  let lastModelError = null;
  for (const candidate of modelsToTry) {
    try {
      console.warn(`[modelRegistry] ${provider}: intentando candidato ${candidate}`);
      const result = await apiCallFn(candidate);
      console.log(`[modelRegistry] ${provider}: éxito con candidato ${candidate}`);

      const wasFallback = candidate !== requestedModelId && requestedModelId !== null;
      /** @type {string} */
      let reason = 'requested';
      if (wasFallback) {
        reason = lastModelError === 'capability' ? 'capability_mismatch' : 'model_unavailable';
      }

      return {
        result,
        resolution: {
          requestedModelId: requestedModelId || null,
          resolvedModelId: candidate,
          wasFallback,
          reason,
        },
      };
    } catch (candidateErr) {
      if (isModelError(candidateErr)) {
        console.warn(`[modelRegistry] ${provider}: ${candidate} rechazado (deprecated/not found).`);
        lastModelError = 'model_unavailable';
        continue; // Intentar el siguiente
      }
      throw candidateErr; // Error genuino (auth, red, payload) — propagar sin enmascarar
    }
  }

  // Caso terminal: toda la secuencia agotada
  const terminalError = new Error(
    `[modelRegistry] Todos los modelos de ${provider} para capability '${capability}' fallaron o están deprecados. Intentados: ${modelsToTry.join(', ')}`
  );
  terminalError.code = exhaustedCode;
  throw terminalError;
}

// Init background refresh every 24h
setInterval(refreshModelsCache, 24 * 60 * 60 * 1000);
// Initial fetch
setTimeout(refreshModelsCache, 2000);

module.exports = {
  getOnlineModels,
  parseGroqModelError,
  parseGeminiModelError,
  resolveAutoModel,
  resolveModelPreferenceFromRequest,
  callWithModelFallback,
  getEligibleModels,
  GROQ_PRIORITY_LIST,
  GEMINI_PRIORITY_LIST,
  MODEL_CAPABILITIES,
  refreshModelsCache,
  MODEL_DEFAULTS,
};
