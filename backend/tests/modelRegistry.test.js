/**
 * Tests del catalogo de modelos y del clasificador de errores.
 *
 * Usa node:test (stdlib) porque el backend no tiene runner y no vale la pena
 * introducir jest solo para esto.
 *
 *   node --test tests/modelRegistry.test.js
 *
 * Los codigos HTTP y los mensajes que se simulan son copias literales de
 * respuestas reales observadas contra Groq y Gemini.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const AI_MODELS = require('../config/aiModels');
const health = require('../utils/modelHealth');
const R = require('../utils/modelRegistry');

// Respuestas reales, copiadas de las pruebas contra las APIs.
const GROQ_404 = { status: 404, details: { error: { message: 'model_not_found: qwen/qwen3.6-27b' } } };
const GROQ_400_DECOMMISSIONED = { status: 400, details: { error: { message: 'model_decommissioned: llama-3.1-70b-versatile' } } };
const GROQ_400_TEXT_ONLY = { status: 400, details: { error: { message: 'messages[0].content must be a string' } } };
const GROQ_503 = { status: 503, message: 'Service Unavailable' };
const GEMINI_404 = { status: 404, message: "models/gemini-2.5-flash is not found for api version 'v1beta'" };
const AUTH_401 = { status: 401, message: 'Invalid API Key' };

test.beforeEach(() => health.reset());

// ─── Catalogo ───────────────────────────────────────────────────────────────

test('el catalogo no incluye ningun modelo verificado como retirado', () => {
  const muertosVerificados = [
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'llama-3.3-70b-versatile',
    'qwen/qwen3.6-27b',
    'llama-4-scout-17b-16e-instruct',
    'llama-3.2-11b-vision-preview',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-pro',
  ];
  for (const id of muertosVerificados) {
    assert.equal(AI_MODELS.findEntry(id), null, `${id} esta retirado y no debe estar en el catalogo`);
  }
});

test('GROQ_PRIORITY_LIST por defecto ya no contiene solo modelos muertos', () => {
  assert.deepEqual(R.GROQ_PRIORITY_LIST, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
});

test('vision en Groq resuelve un modelo con capacidad declarada', () => {
  const vision = R.getEligibleModels('groq', 'vision');
  assert.equal(vision.length, 1);
  assert.equal(vision[0], 'qwen/qwen3.8-27b');
  assert.ok(AI_MODELS.findEntry('qwen/qwen3.8-27b').caps.includes('vision'));
});

test('el alias rolling de Gemini queda al final de su ranking', () => {
  const chat = R.getEligibleModels('gemini', 'text');
  assert.equal(chat[chat.length - 1], 'gemini-flash-latest');
  assert.equal(chat[0], 'gemini-3.8-flash');
});

test('cada ranking declara capacidades: nada se infiere como texto', () => {
  for (const [key, entries] of Object.entries(AI_MODELS.RANKINGS)) {
    for (const e of entries) {
      assert.ok(Array.isArray(e.caps) && e.caps.length > 0, `${key}/${e.id} sin caps`);
      assert.ok(['honored', 'ignored'].includes(e.sampling), `${e.id} con sampling invalido`);
    }
  }
});

test('Gemini 3.x ignora sampling y Gemini 3.5 lo respeta', () => {
  assert.deepEqual(R.applySamplingPolicy('gemini-3.6-flash', { temperature: 0, top_p: 0.5 }), {});
  assert.deepEqual(R.applySamplingPolicy('gemini-3.8-flash', { temperature: 0 }), {});
  assert.deepEqual(R.applySamplingPolicy('gemini-3.5-flash', { temperature: 0, top_p: 0.5 }), { temperature: 0, top_p: 0.5 });
  assert.deepEqual(R.applySamplingPolicy('openai/gpt-oss-120b', { temperature: 0.2 }), { temperature: 0.2 });
});

test('un uso no declarado se rechaza en vez de caer a un default silencioso', async () => {
  await assert.rejects(
    () => R.callWithModelFallback('groq', null, async () => ({}), { capability: 'audio' }),
    /Uso no declarado/
  );
});

test('la imagen sonda cumple el minimo de 32px que exige Groq', () => {
  // Regresion: con un PNG de 1x1 el check de vision recibia 400 "Image must have
  // at least 32 pixels in each dimension", que describe al caller, no al modelo.
  // Sin este guard, un recorte del base64 reintroduce el fallo en silencio.
  const buf = Buffer.from(
    R.VISION_PROBE_PNG_BASE64,
    'base64'
  );
  const pngSignature = '89504e470d0a1a0a';
  assert.equal(buf.subarray(0, 8).toString('hex'), pngSignature, 'no es un PNG valido');
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.ok(width >= 32 && height >= 32, `imagen sonda de ${width}x${height}, Groq exige 32 minimo`);
});

// ─── Clasificador ───────────────────────────────────────────────────────────

test('404 model_not_found se clasifica como muerto', () => {
  assert.equal(health.classifyError(GROQ_404).class, 'dead');
});

test('400 model_decommissioned se clasifica como muerto, no transitorio', () => {
  assert.equal(health.classifyError(GROQ_400_DECOMMISSIONED).class, 'dead');
});

test('404 de Gemini por version de API se clasifica como muerto', () => {
  assert.equal(health.classifyError(GEMINI_404).class, 'dead');
});

test('400 content must be a string es capacidad ausente, no muerte', () => {
  const v = health.classifyError(GROQ_400_TEXT_ONLY, { capability: 'vision' });
  assert.equal(v.class, 'incompatible');
  assert.equal(v.capability, 'vision');
});

test('503 y 429 son transitorios y no matan el modelo', () => {
  assert.equal(health.classifyError(GROQ_503).class, 'transient');
  assert.equal(health.classifyError({ status: 429, message: 'quota exceeded' }).class, 'transient');
});

test('401 corta el provider y no se confunde con modelo retirado', () => {
  assert.equal(health.classifyError(AUTH_401).class, 'auth');
});

test('un error desconocido se clasifica fatal para propagarse sin enmascarar', () => {
  assert.equal(health.classifyError({ status: 418, message: 'teapot' }).class, 'fatal');
});

// ─── Caché de salud ─────────────────────────────────────────────────────────

test('un modelo muerto se cachea y queda fuera de los candidatos', () => {
  health.record('openai/gpt-oss-120b', health.classifyError(GROQ_404));
  assert.ok(!R.getEligibleModels('groq', 'text').includes('openai/gpt-oss-120b'));
  assert.equal(R.resolveAutoModel({ provider: 'groq' }), 'openai/gpt-oss-20b');
});

test('un fallo transitorio bloquea con cooldown corto y expira', () => {
  health.record('openai/gpt-oss-120b', health.classifyError(GROQ_503));
  assert.equal(R.resolveAutoModel({ provider: 'groq' }), 'openai/gpt-oss-20b');
  // El cooldown es mucho mas corto que el TTL de muerto.
  const snap = health.snapshot();
  assert.ok(snap.transient['openai/gpt-oss-120b'].msLeft < health.TRANSIENT_MAX_MS);
});

test('marcar sano limpia el estado de fallo', () => {
  health.record('openai/gpt-oss-120b', health.classifyError(GROQ_404));
  health.markHealthy('openai/gpt-oss-120b');
  assert.equal(R.resolveAutoModel({ provider: 'groq' }), 'openai/gpt-oss-120b');
});

test('una capacidad rechazada no descarta el modelo para texto', () => {
  health.record('openai/gpt-oss-120b', health.classifyError(GROQ_400_TEXT_ONLY, { capability: 'vision' }));
  assert.ok(R.getEligibleModels('groq', 'text').includes('openai/gpt-oss-120b'));
  assert.ok(!R.getEligibleModels('groq', 'vision').includes('openai/gpt-oss-120b'));
});

// ─── Fallback ───────────────────────────────────────────────────────────────

test('el fallback avanza de candidato y devuelve la resolucion', async () => {
  const vistos = [];
  const { result, resolution } = await R.callWithModelFallback('groq', 'openai/gpt-oss-120b', async (m) => {
    vistos.push(m);
    if (m === 'openai/gpt-oss-120b') throw GROQ_404;
    return 'ok';
  });
  assert.equal(result, 'ok');
  assert.deepEqual(vistos, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  assert.equal(resolution.wasFallback, true);
  assert.equal(resolution.resolvedModelId, 'openai/gpt-oss-20b');
});

test('el default y el auto recorren el mismo camino', async () => {
  const conAuto = await R.callWithModelFallback('groq', 'auto', async (m) => m);
  const conNull = await R.callWithModelFallback('groq', null, async (m) => m);
  assert.equal(conAuto.result, conNull.result);
  assert.equal(conAuto.result, 'openai/gpt-oss-120b');
});

test('una preferencia no declarada se ignora y se usa el ranking', async () => {
  const { result } = await R.callWithModelFallback('groq', 'modelo-inventado', async (m) => m);
  assert.equal(result, 'openai/gpt-oss-120b');
});

test('el error de agotamiento lista cada candidato con su motivo', async () => {
  await assert.rejects(
    () => R.callWithModelFallback('groq', null, async (m) => {
      throw m.includes('120b') ? GROQ_400_DECOMMISSIONED : GROQ_404;
    }),
    (err) => {
      assert.equal(err.code, 'GROQ_ALL_MODELS_EXHAUSTED');
      assert.equal(err.attempts.length, 2);
      assert.match(err.message, /openai\/gpt-oss-120b/);
      assert.match(err.message, /retirado del catalogo/);
      // Cada motivo debe ser distinto y util, no un unico texto generico.
      assert.ok(err.attempts.every((a) => typeof a.reason === 'string' && a.reason.length > 5));
      return true;
    }
  );
});

test('401 aborta el provider y no queman quota los demas candidatos', async () => {
  let llamadas = 0;
  await assert.rejects(
    () => R.callWithModelFallback('groq', null, async () => {
      llamadas += 1;
      throw AUTH_401;
    }),
    /credencial rechazada/
  );
  assert.equal(llamadas, 1, 'debe parar en el primer 401');
  assert.ok(health.isProviderBlocked('groq'));
  await assert.rejects(
    () => R.callWithModelFallback('groq', null, async () => 'no deberia llamarse'),
    /credencial rechazada/
  );
});

test('un error fatal se propaga sin agotar la lista', async () => {
  let llamadas = 0;
  await assert.rejects(
    () => R.callWithModelFallback('groq', null, async () => {
      llamadas += 1;
      throw new Error('payload malformado del cliente');
    }),
    /fallo en openai\/gpt-oss-120b/
  );
  assert.equal(llamadas, 1);
});

test('todos los candidatos bloqueados producen agotamiento con motivo, no una lista vacia', async () => {
  health.record('openai/gpt-oss-120b', health.classifyError(GROQ_404));
  health.record('openai/gpt-oss-20b', health.classifyError(GROQ_404));
  await assert.rejects(
    () => R.callWithModelFallback('groq', null, async () => 'no deberia llamarse'),
    (err) => {
      assert.equal(err.code, 'GROQ_ALL_MODELS_EXHAUSTED');
      assert.ok(err.attempts.every((a) => a.skipped === true));
      assert.match(err.message, /descartado/);
      return true;
    }
  );
});

// ─── Back-compat ────────────────────────────────────────────────────────────

test('los parsers de back-compat siguen devolviendo booleano', () => {
  assert.equal(R.parseGroqModelError(GROQ_404), true);
  assert.equal(R.parseGroqModelError(GROQ_400_DECOMMISSIONED), true);
  assert.equal(R.parseGroqModelError(GROQ_400_TEXT_ONLY, 'vision'), true);
  assert.equal(R.parseGroqModelError(GROQ_503), false);
  assert.equal(R.parseGeminiModelError(GEMINI_404), true);
});

test('MODEL_DEFAULTS se evalua en cada acceso y devuelve un vivo', () => {
  const antes = R.MODEL_DEFAULTS.groq;
  health.record('openai/gpt-oss-120b', health.classifyError(GROQ_404));
  const despues = R.MODEL_DEFAULTS.groq;
  assert.equal(antes, 'openai/gpt-oss-120b');
  assert.equal(despues, 'openai/gpt-oss-20b', 'el default debe seguir al estado de salud');
});

test('un fallo de red en el health-check se registra como transitorio', async () => {
  // Regresion: el veredicto se reclasificaba desde un motivo ya formateado con
  // status null. Eso daba 'fatal', record() no guardaba nada y un corte de red
  // pasaba desapercibido por completo.
  const original = global.fetch;
  global.fetch = async () => { throw new Error('fetch failed'); };
  try {
    health.reset();
    const r = await R.healthCheckModel('groq', 'openai/gpt-oss-120b', 'text');
    assert.equal(r.ok, false);
    assert.equal(r.class, 'transient', 'fetch failed es transitorio, no fatal');
    assert.ok(r.verdict, 'el veredicto debe viajar ya clasificado');
    health.record('openai/gpt-oss-120b', r.verdict);
    assert.equal(health.isCoolingDown('openai/gpt-oss-120b'), true);
  } finally {
    global.fetch = original;
    health.reset();
  }
});

test('runScheduledHealthChecks solo sondea la cabeza de cada ranking', async () => {
  const original = global.fetch;
  const llamadas = [];
  global.fetch = async (url, opts) => {
    const u = String(url);
    llamadas.push(u);
    // Vision recibe un bloque image_url; el texto plano da 400 en gpt-oss.
    const mandaImagen = JSON.stringify(opts?.body || '').includes('image_url');
    return { status: mandaImagen ? 200 : 200, ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
  };
  try {
    const summary = await R.runScheduledHealthChecks();
    assert.ok(summary.length > 0, 'debe sondear algo');
    for (const s of summary) {
      assert.ok(['chat', 'vision'].includes(s.capability));
      assert.ok(s.model, 'cada entrada nombra el modelo sondeado');
    }
    // 4 rankings (groq/gemini x chat/vision) y nunca mas de un modelo cada uno.
    assert.ok(summary.length <= 4, `como maximo 4 sondeos, hubo ${summary.length}`);
    assert.ok(llamadas.length <= 8, 'no debe multiplicar las llamadas de pago');
  } finally {
    global.fetch = original;
    health.reset();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Presupuesto de razonamiento
//
// Medido contra Groq el 2026-09: los openai/gpt-oss emiten el razonamiento en un
// campo aparte, pero esos tokens consumen max_tokens. Con un presupuesto
// ajustado devuelven HTTP 200 con content "" y finish_reason "length", es decir
// response.ok === true. Si eso se acepta como exito, la app muestra un vacio.
// ─────────────────────────────────────────────────────────────────────────────

test('una respuesta HTTP 200 sin contenido no se acepta como exito', async () => {
  // El fallo es invisible desde fuera: response.ok es true. Solo mirar el
  // status daria por buena una respuesta que no tiene nada.
  const vistos = [];
  await assert.rejects(
    R.callWithModelFallback('groq', null, async (model) => {
      vistos.push(model);
      return { content: '' };
    }),
    (e) => e.code === 'GROQ_ALL_MODELS_EXHAUSTED',
    'una respuesta vacia debe agotar el ranking, no devolverse como resultado',
  );
  assert.equal(vistos.length, 2, 'debe probar ambos candidatos antes de agotar');
});

test('el vacio por presupuesto salta al siguiente candidato y devuelve la resolucion', async () => {
  let intento = 0;
  // Se pide 120b explicitamente: si se queda sin presupuesto, resolver en 20b
  // SI es un fallback (no se obtuvo lo pedido) y debe quedar registrado.
  const { result, resolution } = await R.callWithModelFallback(
    'groq', 'openai/gpt-oss-120b', async () => {
      intento += 1;
      if (intento === 1) return { content: '   ' };
      return { content: 'contenido valido' };
    },
  );
  assert.equal(result.content, 'contenido valido');
  assert.equal(resolution.resolvedModelId, 'openai/gpt-oss-20b');
  assert.equal(resolution.wasFallback, true, 'no se obtuvo el modelo pedido');
  assert.equal(resolution.reason, 'requested_unavailable');
  assert.equal(intento, 2);
});

test('el vacio no se registra como fallo de salud del modelo', async () => {
  // El modelo funciona; lo que se agoto fue el presupuesto de la tarea.
  // Marcarlo deadsacaria un modelo sano del ranking por una tarea mal dimensionada.
  health.reset();
  await assert.rejects(
    R.callWithModelFallback('groq', null, async () => ({ content: '' })),
    (e) => e.code === 'GROQ_ALL_MODELS_EXHAUSTED',
  );
  const snap = health.snapshot();
  assert.deepEqual(snap.dead, {}, 'no debe marcar muerto un modelo que responde');
  assert.deepEqual(snap.transient, {}, 'no debe entrar en cooldown por vacio');
});

test('extractText reconoce las formas de respuesta reales', () => {
  assert.equal(R.extractText({ content: 'hola' }), 'hola');
  assert.equal(R.extractText({ text: 'hola' }), 'hola');
  assert.equal(R.extractText('hola'), 'hola');
  assert.equal(R.extractText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'ab');
  assert.equal(R.extractText({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }), 'hola');
  assert.equal(R.extractText({ content: '' }), '');
  assert.equal(R.extractText({ content: '   ' }), '');
  assert.equal(R.extractText(null), '');
  assert.equal(R.extractText(undefined), '');
  assert.equal(R.extractText({}), '');
  // Un consumidor con forma propia puede cobrar su propia extraccion.
  assert.equal(R.extractText({ raro: 'texto' }, (r) => r.raro), 'texto');
  // Un valor que no es texto NO se coacciona: devolver '' hace que la respuesta
  // se trate como vacia y se pruebe el siguiente candidato, en vez de inventar
  // contenido a partir de un numero u objeto.
  assert.equal(R.extractText({ raro: 1 }, (r) => r.raro), '');
  assert.equal(R.extractText({ content: 42 }), '');
});

test('minTokensFor declara el presupuesto minimo medido por uso', () => {
  // Medido: gpt-oss no emite texto por debajo de 64 tokens porque el
  // razonamiento se come el presupuesto.
  assert.equal(AI_MODELS.minTokensFor('chat.groq'), 64);
  // Gemini no tiene medicion, y no se presupone ninguna.
  assert.equal(AI_MODELS.minTokensFor('chat.gemini'), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown persistente: un 503 que no se resuelve debe alertar, no fundirse
// con el ruido de los reintentos de 5 minutos.
// ─────────────────────────────────────────────────────────────────────────────

test('un fallo transitorio persistente se expone como alerta', () => {
  health.reset();
  const v = health.classifyError({ status: 503, message: 'high demand' });
  const umbral = 12;
  for (let i = 0; i < umbral; i += 1) health.record('openai/gpt-oss-120b', v);
  const snap = health.snapshot();
  const alerta = snap.persistentCooldown['openai/gpt-oss-120b'];
  assert.ok(alerta, 'un 503 sostenido debe generar alerta');
  assert.equal(alerta.consecutive, umbral);
  assert.match(alerta.alert, /fallos transitorios consecutivos/);
  health.reset();
});

test('la racha sobrevive a prune: con trafico bajo la alerta sigue llegando', () => {
  // Regresion: el contador vivia en la entrada del cooldown, que tiene TTL. Con
  // trafico bajo, prune() borraba la entrada al vencer el TTL y la racha
  // reiniciaba, de modo que un 503 sostenido NUNCA alcanzaba el umbral.
  //
  // Se simula el reloj porque el punto del test es precisamente que el TTL
  // VENCE entre fallos: llamar a prune() sin avanzar el tiempo no ejercitaria
  // nada y el test pasaria aunque el defecto volviera.
  const realNow = Date.now;
  let reloj = realNow();
  Date.now = () => reloj;
  try {
    health.reset();
    const v = health.classifyError({ status: 503, message: 'high demand' });

    for (let i = 0; i < 6; i += 1) {
      health.record('openai/gpt-oss-120b', v);
      // Dos minutos por encima del backoff maximo (5 min) para que la entrada
      // de cooldown expire: es la situacion de trafico bajo que rompia antes.
      reloj += 10 * 60 * 1000;
      health.prune();
    }
    assert.equal(health.snapshot().persistentCooldown['openai/gpt-oss-120b'], undefined,
      '6 fallos todavia no llegan al umbral de 12');

    // El cooldown ya no esta en la cache (expiro), pero la racha debe contar 6.
    for (let i = 0; i < 6; i += 1) {
      health.record('openai/gpt-oss-120b', v);
      reloj += 10 * 60 * 1000;
      health.prune();
    }
    const alerta = health.snapshot().persistentCooldown['openai/gpt-oss-120b'];
    assert.ok(alerta, 'la racha debe cruzar el umbral aunque cada entrada de cooldown haya expirado');
    assert.equal(alerta.consecutive, 12);
  } finally {
    Date.now = realNow;
    health.reset();
  }
});

test('un exito borra la racha: no es un contador de fallos historicos', () => {
  health.reset();
  const v = health.classifyError({ status: 503, message: 'high demand' });
  for (let i = 0; i < 11; i += 1) health.record('openai/gpt-oss-120b', v);
  health.markHealthy('openai/gpt-oss-120b');
  for (let i = 0; i < 3; i += 1) health.record('openai/gpt-oss-120b', v);
  const snap = health.snapshot();
  assert.equal(snap.persistentCooldown['openai/gpt-oss-120b'], undefined,
    'tras un exito la racha vuelve a empezar');
  assert.equal(snap.transient['openai/gpt-oss-120b'].consecutive, 3);
  health.reset();
});

// ─────────────────────────────────────────────────────────────────────────────
// La politica no se queda en el helper: se aplica en los estrangulamientos por
// los que pasa TODO el trafico Gemini.
// ─────────────────────────────────────────────────────────────────────────────

test('GeminiProvider no envia temperature a un modelo que la ignora', async () => {
  // Se carga el modulo con un doble de @google/generative-ai que captura lo que
  // se le pasa, para comprobar el generationConfig real y no el intentionsado.
  const capturado = {};
  const requireOriginal = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === '@google/generative-ai') {
      return {
        GoogleGenerativeAI: class {
          getGenerativeModel(cfg) {
            capturado.generationConfig = cfg.generationConfig;
            capturado.model = cfg.model;
            return {
              generateContent: async () => ({
                response: { text: () => '{"ok":true}' },
              }),
            };
          }
        },
      };
    }
    return requireOriginal.apply(this, arguments);
  };

  let provider;
  try {
    delete require.cache[require.resolve('../services/ai/providers/GeminiProvider')];
    provider = require('../services/ai/providers/GeminiProvider');
  } finally {
    Module.prototype.require = requireOriginal;
  }

  // Un Gemini 3.x ignora temperature: no debe viajar en la peticion.
  await provider.generate([{ role: 'user', content: 'texto' }], 'sistema', {
    model: 'gemini-3.6-flash', temperature: 0.15,
  });
  assert.equal(capturado.model, 'gemini-3.6-flash');
  assert.equal('temperature' in capturado.generationConfig, false, 'no debe enviarse temperature');
  assert.equal(capturado.generationConfig.maxOutputTokens, 8000, 'el resto de la config se conserva');
  assert.equal(capturado.generationConfig.responseMimeType, 'application/json');

  // Un 3.5 si la honra: debe llegar intacta.
  await provider.generate([{ role: 'user', content: 'texto' }], 'sistema', {
    model: 'gemini-3.5-flash', temperature: 0.15,
  });
  assert.equal(capturado.generationConfig.temperature, 0.15);
});

test('una respuesta con content null degrada al siguiente candidato en vez de romper', async () => {
  // Regresion: la vision de flashcards hacia content.trim() sobre el mensaje.
  // gpt-oss devuelve content null cuando consume el presupuesto en
  // razonamiento, y un TypeError ahi se clasifica como fatal,Abortando el
  // fallback cuando el segundo candidato habria respondido bien.
  const { result, resolution } = await R.callWithModelFallback('groq', 'openai/gpt-oss-120b', async (model) => {
    if (model === 'openai/gpt-oss-120b') return { content: null, reasoning: 'thinking...' };
    return { content: 'contenido del candidato sano' };
  }, { capability: 'text' });
  assert.equal(result.content, 'contenido del candidato sano');
  assert.equal(resolution.resolvedModelId, 'openai/gpt-oss-20b');
  assert.equal(resolution.wasFallback, true);
});
