/**
 * Tests de AIClientV2.
 *
 * El reloj falso, y por que no es un mock cualquiera
 * --------------------------------------------------
 * `sleep` de verdad con `Date.now()` congelado NO sirve para dos cosas que aqui
 * son el objeto del test:
 *
 *   - Un timeout. Si el reloj no avanza cuando duerme, un `sleep(9000)` que se
 *     resuelve al instante hace que el timeout se dispare en el momento
 *     equivocado y el test pasa sin comprobar nada.
 *   - Un cooldown. Al reves: congelarlo para siempre deja el TTL sin vencer y
 *     el test "vuelve a intentarlo despues del TTL" espera un tiempo que no
 *     existe.
 *
 * Asi que el reloj de aqui tiene temporizadores PENDIENTES: `sleep` registra
 * cuando debe resolverse y solo se resuelve cuando el test adelanta el reloj de
 * verdad. Con eso los 51,8 s del wake cuelgan de verdad: el transporte devuelve
 * una promesa que no resuelve nunca, el test adelanta 51,8 s, y en ese mundo la
 * peticion sigue sin respuesta.
 *
 * Por que hace falta `resuelve`
 * -----------------------------
 * Una llamada con reintentos encadena varios `sleep` (300, 900, 2700). Un test
 * que adelanta una cantidad fija se queda atascado en el primer `sleep` que no
 * ha vencido. `resuelve` adelanta el reloj en pasos hasta que la promesa se
 * asienta, de forma que el test expresa "deja que haga lo que tenga que hacer" en
 * lugar de hardcodear la suma de esperas. Los dos tests de timeout NO lo usan:
 * esos adelantan a mano, porque justamente quieren parar en un instante
 * concreto.
 *
 * El transporte es una funcion suelta, no un fetch mockeado: asi estos tests no
 * dependen de react-native, de MMKV ni de la deteccion de backend, y el fallo
 * que describen es el del clasificador y no el de la red.
 */

import {
  AIClientV2,
  clasificarFallo,
  esSobreV2,
  esSobreExito,
  ESPERA_PLATAFORMA_MS,
  TIMEOUT_CHAT_MS,
  TIMEOUT_CHAT_TOTAL_MS,
  TIMEOUT_PREWARM_MS,
  TTL_BREAKER_MS,
  UMBRAL_FALLOS_APP,
  RUTA_STATUS,
} from '../AIClientV2';
import type { Limite } from '../AIClientV2';

type RelojFalso = {
  clock: { now: () => number };
  dormir: (ms: number) => Promise<void>;
  /** Agenda un trabajo y devuelve su cancelacion. */
  enCola: (ms: number, cb: () => void) => { cancelar: () => void };
  avanzar: (ms: number) => void;
  pendientes: () => number;
  ahora: () => number;
};

/**
 * Reloj con temporizadores pendientes. El tiempo solo corre cuando el test lo
 * adelanta, y al adelantarlo se disparan los trabajos que vencen por el camino.
 *
 * `enCola` existe ademas de `dormir` porque el limite de tiempo necesita poder
 * CANCELAR su temporizador cuando la peticion gana la carrera. Sin ese
 * `cancelar`, cada intento deja un temporizador colgando, y un test que solo
 * compruebe "no quedan pendientes" seria imposible de escribir.
 */
function relojFalso(inicio = 0): RelojFalso {
  let t = inicio;
  let cola: { venceMs: number; cb: () => void; vivo: boolean }[] = [];

  return {
    clock: { now: () => t },
    enCola: (ms: number, cb: () => void) => {
      const item = { venceMs: t + ms, cb, vivo: true };
      cola.push(item);
      return {
        cancelar: () => {
          item.vivo = false;
        },
      };
    },
    dormir: (ms: number) =>
      new Promise<void>((resolver) => {
        if (ms <= 0) {
          resolver();
          return;
        }
        const item = { venceMs: t + ms, cb: resolver, vivo: true };
        cola.push(item);
      }),
    avanzar: (ms: number) => {
      const objetivo = t + ms;
      for (;;) {
        cola.sort((a, b) => a.venceMs - b.venceMs);
        const siguiente = cola[0];
        if (!siguiente || !siguiente.vivo || siguiente.venceMs > objetivo) break;
        cola.shift();
        t = siguiente.venceMs;
        if (siguiente.vivo) siguiente.cb();
      }
      cola = cola.filter((x) => x.vivo);
      t = objetivo;
    },
    pendientes: () => cola.filter((x) => x.vivo).length,
    ahora: () => t,
  };
}

/**
 * Limite de tiempo sobre el reloj falso: vence cuando el reloj llega, y se
 * cancela si la promesa gana antes.
 */
function limiteDe(reloj: RelojFalso): Limite {
  return async <T,>(promesa: Promise<T>, ms: number) => {
    let trabajo: { cancelar: () => void } | undefined;
    const Reloj = new Promise<{ ok: false; agotado: true }>((r) => {
      trabajo = reloj.enCola(ms, () => r({ ok: false, agotado: true }));
    });
    const valor = promesa.then((v) => ({ ok: true, valor: v }) as const);
    const resultado = await Promise.race([valor, Reloj]);
    trabajo?.cancelar();
    return resultado;
  };
}

/**
 * Adelanta el reloj hasta que la promesa se asienta.
 *
 * `setImmediate` es un tick real de macrotarea: deja correr los microtasks y las
 * promesas ya resueltas sin mover el reloj falso. El tiempo que pasa es real pero
 * del orden de milisegundos, y no es lo que el test mide.
 */
async function resuelve<T>(promesa: Promise<T>, reloj: RelojFalso, paso = 250): Promise<T> {
  let hecho = false;
  let valor!: T;
  let fallo: unknown = null;

  promesa.then(
    (v) => {
      hecho = true;
      valor = v;
    },
    (e) => {
      hecho = true;
      fallo = e;
    }
  );

  for (let i = 0; i < 500 && !hecho; i += 1) {
    await new Promise<void>((r) => setImmediate(r));
    if (hecho) break;
    reloj.avanzar(paso);
  }

  if (fallo) throw fallo;
  return valor;
}

type RespuestaFabricada = {
  status: number;
  body: unknown;
  renderRouting?: string;
};

function respuesta({ status, body, renderRouting }: RespuestaFabricada): Response {
  const headers = new Map<string, string>();
  if (renderRouting) headers.set('x-render-routing', renderRouting);
  return {
    status,
    headers: { get: (n: string) => headers.get(n) ?? null },
    json: async () => body,
  } as unknown as Response;
}

/** Promesa que no resuelve nunca: el contenedor que no despierta. */
function nuncaResuelve<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

const SIN_MODELOS: RespuestaFabricada = {
  status: 503,
  body: { error: { code: 'NO_MODEL_AVAILABLE', retryable: true, requestId: 'r1' } },
};

const RENDER_DORMIDO: RespuestaFabricada = {
  status: 503,
  body: '<html>Service Unavailable</html>',
  renderRouting: 'hibernate-wake-error',
};

const EXITO: RespuestaFabricada = {
  status: 200,
  body: {
    data: { content: 'hola', meta: { provider: 'groq', model: 'm', attempts: 1 } },
    error: null,
  },
};

/** Cliente con transporte propio, sobre un reloj dado. */
function cliente(
  transport: (path: string, init?: RequestInit) => Promise<Response>,
  reloj: RelojFalso = relojFalso()
) {
  const peticiones: { path: string; method?: string }[] = [];
  const c = new AIClientV2({
    transport: async (path, init) => {
      peticiones.push({ path, method: init?.method });
      return transport(path, init);
    },
    clock: reloj.clock,
    sleep: reloj.dormir,
    limite: limiteDe(reloj),
  });
  return { client: c, reloj, peticiones };
}

/** Cliente que responde con la secuencia dada, repitiendo la ultima. */
function clienteConSecuencia(respuestas: RespuestaFabricada[]) {
  const reloj = relojFalso();
  let i = 0;
  const c = cliente(async () => respuesta(respuestas[Math.min(i++, respuestas.length - 1)]), reloj);
  return { ...c, reloj };
}

// ── El sobre es el unico criterio ───────────────────────────────────────────

describe('el sobre v2', () => {
  it('reconoce un error con code', () => {
    expect(esSobreV2({ error: { code: 'NO_MODEL_AVAILABLE', retryable: true } })).toBe(true);
  });

  it('NO reconoce un error sin code, aunque tenga las demas claves', () => {
    // Si esto fuera true, un HTML de proxy con la palabra "error" dentro seria
    // tratado como respuesta de nuestra API.
    expect(esSobreV2({ error: { retryable: true } })).toBe(false);
  });

  it('NO reconoce un code que no es texto', () => {
    expect(esSobreV2({ error: { code: 503 } })).toBe(false);
  });

  it('distingue el sobre de exito (error: null) del de error', () => {
    expect(esSobreExito({ data: { content: 'x' }, error: null })).toBe(true);
    expect(esSobreExito({ data: { content: 'x' } })).toBe(false);
    expect(esSobreExito({ error: { code: 'X', retryable: false } })).toBe(false);
  });
});

// ── La clasificacion ────────────────────────────────────────────────────────

describe('clasificarFallo', () => {
  it('un 503 con sobre v2 es de la app', () => {
    const f = clasificarFallo({
      status: 503,
      body: { error: { code: 'NO_MODEL_AVAILABLE', retryable: true } },
    });
    expect(f.origen).toBe('app');
    expect(f.codigo).toBe('NO_MODEL_AVAILABLE');
  });

  it('un 503 sin sobre NO es de la app', () => {
    expect(clasificarFallo({ status: 503, body: '<html>503</html>' }).origen).toBe('platforma');
  });

  it('la cabecera x-render-routing manda sobre el status', () => {
    // Render puede devolver 502 o 503 segun el dia. El que decide es la cabecera.
    for (const status of [502, 503, 504]) {
      const f = clasificarFallo({
        status,
        body: { error: { code: 'INTERNAL_ERROR', retryable: false } },
        headers: {
          get: (n: string) => (n === 'x-render-routing' ? 'hibernate-wake-error' : null),
        },
      });
      expect(f.origen).toBe('platforma');
    }
  });

  it('un 502 sin sobre NO se traduce a codigo de la app', () => {
    const f = clasificarFallo({ status: 502, body: { message: 'Bad Gateway' } });
    expect(f.origen).toBe('platforma');
    expect(f.codigo).toBeUndefined();
  });

  it('un 500 sin sobre es nuestro bug, no de la plataforma', () => {
    expect(clasificarFallo({ status: 500, body: { message: 'boom' } }).origen).toBe('app');
  });
});

// ── El caso medido: el wake de 51,8 s ───────────────────────────────────────

describe('wake lento (el caso real de produccion)', () => {
  it('el chat agota su presupuesto y cae a local, sin abrir el breaker', async () => {
    // El transporte cuelga: el contenedor no escucha todavia. En el mundo del
    // test 51,8 s NO bastan, asi que aqui tampoco.
    const { client, reloj, peticiones } = cliente(() => nuncaResuelve<Response>());

    const promesa = client.chat([{ role: 'user', content: 'hola' }]);
    reloj.avanzar(51_800);
    const r = await promesa;

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.origen).toBe('red');
    expect(r.ok === false && r.local).toBe(true);

    // Ni un reintento: se fue el presupuesto total, y esperar mas seria hacer al
    // usuario peor la situacion que este modulo existe para evitar.
    expect(peticiones).toHaveLength(1);

    // Y el breaker intacto: un timeout es nuestra decision, no una opinion del
    // backend sobre si puede servir.
    expect(client.breaker.fallosConsecutivos).toBe(0);
    expect(client.breakerAbierto()).toBe(false);
  });

  it('el chat NO se rinde antes de su presupuesto', async () => {
    // El complemento del anterior: si el timeout disparase al instante, el
    // test pasaria sin comprobar nada.
    const { client, reloj } = cliente(() => nuncaResuelve<Response>());

    const promesa = client.chat([{ role: 'user', content: 'hola' }]);

    let resuelto = false;
    promesa.then(() => {
      resuelto = true;
    });

    reloj.avanzar(TIMEOUT_CHAT_MS - 1);
    for (let i = 0; i < 5; i += 1) await new Promise<void>((r) => setImmediate(r));
    expect(resuelto).toBe(false);

    reloj.avanzar(1);
    expect((await promesa).ok).toBe(false);
  });

  it('los presupuestos son los medidos, no numeros que parecen razonables', () => {
    // Si alguien los cambia, el comentario de cabecera deja de ser cierto y el
    // wake real vuelve a colgar la pantalla del usuario.
    expect(TIMEOUT_CHAT_MS).toBe(9_000);
    expect(TIMEOUT_CHAT_TOTAL_MS).toBe(12_000);
    expect(TIMEOUT_PREWARM_MS).toBeGreaterThan(51_800);
  });

  it('un wake lento NO cuenta como fallo de capacidad aunque se repita', async () => {
    const { client, reloj } = cliente(() => nuncaResuelve<Response>());

    for (let i = 0; i < 10; i += 1) {
      const p = client.chat([{ role: 'user', content: 'hola' }]);
      reloj.avanzar(TIMEOUT_CHAT_TOTAL_MS);
      await p;
    }

    expect(client.breaker.fallosConsecutivos).toBe(0);
    expect(client.breakerAbierto()).toBe(false);
  });
});

// ── El caso del 503 inmediato ───────────────────────────────────────────────

describe('503 inmediato de plataforma', () => {
  it('reintenta con espera creciente y NO toca el breaker', async () => {
    const { client, reloj, peticiones } = clienteConSecuencia([RENDER_DORMIDO]);

    const r = await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);

    expect(peticiones).toHaveLength(1 + ESPERA_PLATAFORMA_MS.length);
    expect(r.ok === false && r.origen).toBe('platforma');

    // Las esperas se RESUELVEN, no se acumulan: si el test los dejara
    // pendientes seria porque la cadena de reintentos no llego a su final.
    expect(reloj.pendientes()).toBe(0);
    expect(client.breaker.fallosConsecutivos).toBe(0);
  });

  it('el tiempo total de los reintentos es la suma de las esperas', async () => {
    const { client, reloj } = clienteConSecuencia([RENDER_DORMIDO]);
    const antes = reloj.ahora();
    await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    const gastado = reloj.ahora() - antes;

    // Cada intento responde de inmediato, asi que el tiempo gastado es
    // exactamente el de las esperas: ni mas (reintentos fantasma) ni menos.
    const esperas = ESPERA_PLATAFORMA_MS.reduce((a, b) => a + b, 0);
    expect(gastado).toBeGreaterThanOrEqual(esperas);
    expect(gastado).toBeLessThan(esperas + 1_000);
  });

  it('si el servidor vuelve a mitad, responde bien', async () => {
    const { client, reloj, peticiones } = clienteConSecuencia([
      RENDER_DORMIDO,
      RENDER_DORMIDO,
      EXITO,
    ]);

    const r = await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);

    expect(r.ok).toBe(true);
    expect(peticiones).toHaveLength(3);
    expect(client.breaker.fallosConsecutivos).toBe(0);
  });

  it('30 platformas seguidas NO abren el breaker', async () => {
    const { client, reloj } = clienteConSecuencia([RENDER_DORMIDO]);
    for (let i = 0; i < 30; i += 1) {
      await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    }
    expect(client.breakerAbierto()).toBe(false);
  });
});

// ── Fallo de la app ─────────────────────────────────────────────────────────

describe('fallo de la app', () => {
  it('NO reintenta: el servidor ya contesto que no puede', async () => {
    const { client, reloj, peticiones } = clienteConSecuencia([SIN_MODELOS]);
    const r = await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    expect(peticiones).toHaveLength(1);
    expect(r.ok === false && r.codigo).toBe('NO_MODEL_AVAILABLE');
    expect(client.breaker.fallosConsecutivos).toBe(1);
  });

  it('abre el breaker en el umbral, no en el primer fallo', async () => {
    const { client, reloj } = clienteConSecuencia([SIN_MODELOS]);
    for (let i = 0; i < UMBRAL_FALLOS_APP - 1; i += 1) {
      await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
      expect(client.breakerAbierto()).toBe(false);
    }
    await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    expect(client.breakerAbierto()).toBe(true);
  });

  it('con el breaker abierto responde local SIN tocar la red', async () => {
    const { client, reloj, peticiones } = clienteConSecuencia([SIN_MODELOS]);
    for (let i = 0; i < UMBRAL_FALLOS_APP; i += 1) {
      await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    }
    const antes = peticiones.length;
    const r = await client.chat([{ role: 'user', content: 'hola' }]);

    expect(peticiones).toHaveLength(antes);
    expect(r.ok === false && r.codigo).toBe('BREAKER_OPEN');
    expect(r.ok === false && r.local).toBe(true);
  });

  it('tras el TTL vuelve a intentarlo', async () => {
    const reloj = relojFalso();
    let respondeFallo = true;
    const { client } = cliente(
      async () => (respondeFallo ? respuesta(SIN_MODELOS) : respuesta(EXITO)),
      reloj
    );

    for (let i = 0; i < UMBRAL_FALLOS_APP; i += 1) {
      await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    }
    expect(client.breakerAbierto()).toBe(true);

    reloj.avanzar(TTL_BREAKER_MS - 1);
    expect(client.breakerAbierto()).toBe(true);
    reloj.avanzar(1);
    expect(client.breakerAbierto()).toBe(false);

    respondeFallo = false;
    const r = await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    expect(r.ok).toBe(true);
    expect(client.breaker.fallosConsecutivos).toBe(0);
    expect(client.breaker.abiertoHastaMs).toBe(0);
  });

  it('un exito en medio limpia el conteo', async () => {
    const { client, reloj } = clienteConSecuencia([SIN_MODELOS, EXITO, SIN_MODELOS, SIN_MODELOS]);
    for (const _ of [0, 1]) {
      await resuelve(client.chat([{ role: 'user', content: 'a' }]), reloj);
    }
    expect(client.breaker.fallosConsecutivos).toBe(0);

    for (const _ of [0, 1]) {
      await resuelve(client.chat([{ role: 'user', content: 'c' }]), reloj);
    }
    expect(client.breaker.fallosConsecutivos).toBe(2);
    expect(client.breakerAbierto()).toBe(false);
  });

  it('un 429 NO abre el breaker de golpe', async () => {
    const { client, reloj } = cliente(async () =>
      respuesta({
        status: 429,
        body: { error: { code: 'RATE_LIMITED', retryable: true, retryAfterSec: 60 } },
      })
    );
    const r = await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    expect(r.ok === false && r.codigo).toBe('RATE_LIMITED');
    expect(client.breakerAbierto()).toBe(false);
  });
});

// ── La regla que no se negocia ──────────────────────────────────────────────

describe('regla de seguridad', () => {
  it('un 502 sin sobre nunca se presenta como respuesta de la API', async () => {
    const { client, reloj } = clienteConSecuencia([
      { status: 502, body: { error: { message: 'Bad Gateway' } } },
    ]);
    const r = await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    expect(r.ok === false && r.codigo).toBeUndefined();
    expect(r.ok === false && r.origen).toBe('platforma');
  });

  it('un 200 sin sobre de exito NO es un exito', async () => {
    // Un build viejo desplegado devolveria justo esto.
    const { client, reloj } = clienteConSecuencia([{ status: 200, body: null }]);
    const r = await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    expect(r.ok).toBe(false);
  });

  it('una exception de red no cuenta para el breaker', async () => {
    const { client } = cliente(async () => {
      throw new Error('Network request failed');
    });
    const r = await client.chat([{ role: 'user', content: 'hola' }]);
    expect(r.ok === false && r.origen).toBe('red');
    expect(client.breaker.fallosConsecutivos).toBe(0);
  });
});

// ── Precalentamiento ────────────────────────────────────────────────────────

describe('precalentar', () => {
  it('aguanta el wake medido y devuelve despierto', async () => {
    // El transporte tarda lo que tarda el contenedor en escuchar.
    const reloj = relojFalso();
    const { client } = cliente(async () => {
      await reloj.dormir(51_800);
      return respuesta(EXITO);
    }, reloj);

    const res = await resuelve(client.precalentar(), reloj, 1_000);

    expect(res.despierto).toBe(true);
    expect(reloj.ahora()).toBeGreaterThanOrEqual(51_800);
  });

  it('se rinde al presupuesto si el wake no llega', async () => {
    const reloj = relojFalso();
    const { client } = cliente(() => nuncaResuelve<Response>(), reloj);

    const p = client.precalentar();
    reloj.avanzar(TIMEOUT_PREWARM_MS);
    const res = await p;

    expect(res.despierto).toBe(false);
    expect(res.detalle).toBe('timeout');
    expect(reloj.pendientes()).toBe(0);
  });

  it('un exito CIERRA el breaker', async () => {
    // El wake acaba de despertar el backend: un fallo de capacidad viejo no
    // debe seguir penalizando a un proceso que acaba de arrancar.
    //
    // El transporte cambia segun la ruta a proposito. Con un unico transporte
    // que siempre devuelve exito, los tres chat NO fallarian, el breaker nunca
    // se abriria y esta prueba pasaria sin comprobar lo que dice comprobar.
    const reloj = relojFalso();
    const { client } = cliente(
      async (path) =>
        path === RUTA_STATUS
          ? respuesta({ status: 200, body: { data: { listo: true }, error: null } })
          : respuesta(SIN_MODELOS),
      reloj
    );

    for (let i = 0; i < UMBRAL_FALLOS_APP; i += 1) {
      await resuelve(client.chat([{ role: 'user', content: 'hola' }]), reloj);
    }
    expect(client.breakerAbierto()).toBe(true);

    const res = await resuelve(client.precalentar(), reloj);
    expect(res.despierto).toBe(true);
    expect(client.breakerAbierto()).toBe(false);
    expect(client.breaker.fallosConsecutivos).toBe(0);
  });

  it('una plataforma dormida no se confunde con "no hay modelos"', async () => {
    const { client } = cliente(async () => respuesta(RENDER_DORMIDO));
    const res = await resuelve(client.precalentar(), relojFalso());
    expect(res.despierto).toBe(false);
    expect(res.detalle).toBe('platforma');
  });

  it('nunca lanza, aunque el transporte reviente', async () => {
    const { client } = cliente(async () => {
      throw new Error('sin red');
    });
    const res = await resuelve(client.precalentar(), relojFalso());
    expect(res.despierto).toBe(false);
    expect(res.detalle).toBe('red');
  });
});