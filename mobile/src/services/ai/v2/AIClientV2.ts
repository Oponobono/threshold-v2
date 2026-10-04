/**
 * AIClientV2 — cliente de la API v2 de IA.
 *
 * Que problema resuelve este modulo
 * ---------------------------------
 * `client.ts` ya tiene un breaker, pero cuenta CUALQUIER fallo de red igual.
 * Para IA eso es incorrecto, y el caso real lo demostro: hay dos 503 que
 * significan cosas opuestas.
 *
 *   - La app responde 503 con sobre v2 (`NO_MODEL_AVAILABLE`): el backend esta
 *     vivo, no tiene modelos. Reintentar es inutil y el breaker tiene que abrir.
 *   - La plataforma responde 503 sin sobre, con `x-render-routing`: Render no
 *     llego a despertar el contenedor. El backend no dio ninguna opinion, y
 *     abrir el breaker por eso penaliza un servicio que volvera en un minuto.
 *
 * Regla de seguridad, y la unica que no se negocia
 * -------------------------------------------------
 * Un 502/503 SIN sobre v2 valido no es una respuesta de nuestra API. No se
 * traduce, no se usa su status para el breaker y no se muestra como si el
 * servidor hubiera dicho algo. Un HTML de error de un proxy no se distingue de
 * un fallo de aplicacion si se le da el mismo tratamiento, y ese es el fallo
 * que hace que un cliente muestre "sin modelos disponibles" cuando en realidad
 * el servidor ni estaba escuchando.
 *
 * Los tres presupuestos de tiempo salen de una medicion, no de una suposicion
 * ---------------------------------------------------------------------------
 * Render en plan free hiberna a los 15 min y el wake medido en produccion fue de
 * **51,8 s** para la primera peticion, con las siguientes en 0,4 s. Por eso:
 *
 *   - El chat tiene 9 s por intento y 12 s en total. Por debajo de los 51,8 s
 *     del wake, de modo que un cold start SIEMPRE cae a la IA local en vez de
 *     dejar la pantalla pensando medio minuto. El usuario nunca ve un segundo
 *     de espera por una infraestructura que no controla.
 *   - El precalentamiento tiene 75 s, por encima del wake medido. Es el unico
 *     sitio donde esperar tiene sentido: va en segundo plano y su unico trabajo
 *     es pagar el arranque antes de que el usuario pregunte.
 *   - Los reintentos cortos (300/900/2700 ms) son para OTRO caso, el 503
 *     inmediato en el que Render rechaza el wake. No cubren un wake lento, y no
 *     deben intentar hacerlo: 3,9 s no es un presupuesto para 52.
 *
 * Todo el modulo es puro: recibe `transport`, `clock` y `sleep` por parametro.
 * No importa fetch, ni react-native, ni ningun store. Por eso los tests pueden
 * inyectar un reloj falso con temporizadores pendientes, que es lo unico que
 * permite probar de verdad tanto un cooldown como una espera que se agota.
 */

export type OrigenFallo = 'app' | 'platforma' | 'red';

export interface Clock {
  now(): number;
}

export type Transport = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Mecanismo de presupuesto de tiempo, inyectado.
 *
 * Por que es una dependencia y no un setTimeout dentro
 * ---------------------------------------------------
 * Por dos razones, y la segunda es la que no se ve:
 *
 *
 *   1. Los tests necesitan que el vencimiento ocurra cuando el reloj falso
 *      avanza, no cuando pasa el tiempo de pared. Un `setTimeout` real aqui hace
 *      que un test de timeout tarde 9 s en ejecutarse, y que uno de cooldown no
 *      pueda escribirse: el TTL nunca venceria en un reloj congelado.
 *   2. La promesa original NO se cancela (ver mas abajo), asi que el
 *      temporizador del envelope SI tiene que cancelarse cuando la peticion
 *      gana la carrera. Sin `cancelar`, cada intento deja un temporizador
 *      colgando hasta que vence: con el precalentamiento de 75 s, un movil que
 *      abre la pantalla de IA cinco veces arrastra cinco temporizadores de un
 *      minuto y medio que no van a hacer nada.
 */
export type Limite = <T>(
  promesa: Promise<T>,
  ms: number
) => Promise<{ ok: true; valor: T } | { ok: false; agotado: true }>;

/** Implementacion de produccion: `setTimeout` con su `clearTimeout`. */
export const limiteReal: Limite = async <T,>(promesa: Promise<T>, ms: number) => {
  let id: ReturnType<typeof setTimeout> | undefined;
  const Reloj = new Promise<{ ok: false; agotado: true }>((r) => {
    id = setTimeout(() => r({ ok: false, agotado: true }), ms);
  });
  const valor = promesa.then((v) => ({ ok: true, valor: v }) as const);
  const resultado = await Promise.race([valor, Reloj]);
  if (id !== undefined) clearTimeout(id);
  return resultado;
};

export interface EnvelopeError {
  code: string;
  retryable: boolean;
  retryAfterSec?: number;
  requestId?: string;
}

export interface ChatMeta {
  provider?: string;
  model?: string;
  attempts?: number;
  requestId?: string;
}

export interface ChatData {
  /** Respuesta textual del asistente. */
  content: string;
  meta?: ChatMeta;
  /**
   * Señal de bloqueo por prompt shield. En contrato v2 el backend expone
   * `shield_blocked` (snake_case), y el cliente lo traduce aquí a camelCase.
   */
  shieldBlocked?: boolean;
  /**
   * El backend indica si el contexto fue truncado. Aunque hoy es `false`,
   * el cliente debe aceptarlo para no romper con futuras versiones del contrato.
   */
  contextTruncated?: boolean;
}

export type ResultadoChat =
  | { ok: true; data: ChatData; intentos: number }
  | {
      ok: false;
      origen: OrigenFallo;
      codigo?: string;
      retryable?: boolean;
      /** El cliente debe seguir con la IA local. */
      local: boolean;
      detalle: string;
      intentos: number;
    };

/**
 * Traduce la forma del backend a la del cliente.
 *
 * Por que hace falta
 * ------------------
 * El backend responde `{ data: { reply: { role, content }, shield_blocked,
 * context_truncated, meta } }`. Tipar `ChatData` con ese shape obligaria a cada
 * componente a hacer `data.reply.content`, y `reply` no significa nada fuera de
 * este endpoint: lo que consume es el mensaje del asistente.
 *
 * `reply.content` puede faltar si el backend devolvio un mensaje sin texto. Se
 * convierte en cadena vacia en vez de propagar `undefined`: un componente que
 * pinta `{undefined}` es un fallo de render, y uno que decide con `.length` sobre
 * undefined es un fallo de logica. El texto vacio es un caso que todos los
 * consumidores ya saben manejar.
 */
function adaptarChat(data: unknown): ChatData {
  const d = (data ?? {}) as Record<string, unknown>;
  const reply = d.reply as { content?: unknown } | undefined;
  const crudo = reply?.content;

  return {
    content: typeof crudo === 'string' ? crudo : '',
    shieldBlocked: d.shield_blocked === true,
    contextTruncated: d.context_truncated === true,
    meta: d.meta as ChatMeta | undefined,
  };
}

// ── Rutas ───────────────────────────────────────────────────────────────────

export const RUTA_CHAT = '/ai/v2/chat';
export const RUTA_STATUS = '/ai/v2/status';

// ── Presupuestos de tiempo (medidos, no inventados) ──────────────────────────

/** Por intento de chat. Menor que el wake medido de 51,8 s a proposito. */
export const TIMEOUT_CHAT_MS = 9_000;

/** Tope del chat completo, reintentos incluidos. */
export const TIMEOUT_CHAT_TOTAL_MS = 12_000;

/** Precalentamiento: por encima del wake, en segundo plano. */
export const TIMEOUT_PREWARM_MS = 75_000;

/**
 * Reintentos para un 503 INMEDIATO de plataforma, con espera creciente.
 *
 * No es el presupuesto de un wake lento: ese caso no produce 503, produce una
 * peticion que cuelga y que resuelve el timeout de arriba. Aqui solo se
 * contempla que Render rechace el arranque de inmediato.
 */
export const ESPERA_PLATAFORMA_MS = [300, 900, 2_700];

/** Fallos de la app consecutivos antes de abrir el breaker. */
export const UMBRAL_FALLOS_APP = 3;

export const TTL_BREAKER_MS = 60_000;

// ── Clasificación ───────────────────────────────────────────────────────────

/**
 * Un sobre v2 de error es `{ error: { code, retryable, ... } }`.
 *
 * Se exige `code` string. Es el unico campo que el servidor no puede omitir sin
 * romper el contrato, asi que es el que decide "esto lo dijo nuestra API". El
 * sobre de exito es `{ data, error: null }`, con `error` a null, y por eso el
 * criterio es el `code` y no la presencia de `error`.
 */
export function esSobreV2(body: unknown): body is { error: EnvelopeError } {
  return (
    !!body &&
    typeof body === 'object' &&
    !!(body as { error?: unknown }).error &&
    typeof (body as { error: unknown }).error === 'object' &&
    typeof (body as { error: { code?: unknown } }).error.code === 'string'
  );
}

export function esSobreExito(body: unknown): body is { data: ChatData; error: null } {
  return (
    !!body &&
    typeof body === 'object' &&
    (body as { data?: unknown }).data !== undefined &&
    (body as { error?: unknown }).error === null
  );
}

interface EntradaClasificacion {
  status: number;
  body: unknown;
  headers?: { get(name: string): string | null };
}

/**
 * Decide de quien es el fallo. De aqui sale si el breaker abre y si el usuario
 * cae a la IA local.
 */
export function clasificarFallo({ status, body, headers }: EntradaClasificacion): {
  origen: OrigenFallo;
  codigo?: string;
  retryable?: boolean;
  retryAfterSec?: number;
} {
  // La cabecera manda sobre el status: Render la pone cuando el wake falla, y
  // el status puede ser 502 o 503 segun el dia.
  const routing = headers?.get('x-render-routing');
  if (routing) return { origen: 'platforma' };

  if (esSobreV2(body)) {
    return {
      origen: 'app',
      codigo: body.error.code,
      retryable: body.error.retryable,
      retryAfterSec: body.error.retryAfterSec,
    };
  }

  // Sin sobre y con status de puerta de entrada: no fue nuestra API.
  if (status === 502 || status === 503 || status === 504) {
    return { origen: 'platforma' };
  }

  // Sin sobre pero con otro status, el fallo es nuestro: un 500 sin sobre es un
  // bug y un 404 significa que el build desplegado no tiene la ruta.
  return { origen: 'app' };
}

// ── Cliente ─────────────────────────────────────────────────────────────────

export interface EstadoBreaker {
  fallosConsecutivos: number;
  abiertoHastaMs: number;
  ultimoFalloDeAppMs: number | null;
}

export class AIClientV2 {
  private readonly transport: Transport;
  private readonly clock: Clock;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly limite: Limite;

  breaker: EstadoBreaker = {
    fallosConsecutivos: 0,
    abiertoHastaMs: 0,
    ultimoFalloDeAppMs: null,
  };

  constructor(deps: {
    transport: Transport;
    clock?: Clock;
    sleep?: (ms: number) => Promise<void>;
    limite?: Limite;
  }) {
    this.transport = deps.transport;
    this.clock = deps.clock ?? { now: () => Date.now() };
    this.sleep =
      deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    this.limite = deps.limite ?? limiteReal;
  }

  private ahora(): number {
    return this.clock.now();
  }

  /**
   * Un fallo de plataforma NO cuenta. Solo lo que dijo nuestra API.
   *
   * Un timeout tampoco cuenta, y eso no es un matiz: durante el wake el
   * contenedor simply no escucha todavia, asi que abortar a los 9 s no es una
   *opinion del backend sino la nuestra. Contarlo abriria el breaker por una
   * infraestructura que no responde de su cuenta.
   */
  private registrarFalloDeApp(): void {
    this.breaker.fallosConsecutivos += 1;
    this.breaker.ultimoFalloDeAppMs = this.ahora();
    if (this.breaker.fallosConsecutivos >= UMBRAL_FALLOS_APP) {
      this.breaker.abiertoHastaMs = this.ahora() + TTL_BREAKER_MS;
    }
  }

  private registrarExito(): void {
    this.breaker.fallosConsecutivos = 0;
    this.breaker.abiertoHastaMs = 0;
  }

  breakerAbierto(): boolean {
    return this.ahora() < this.breaker.abiertoHastaMs;
  }

  /**
   * Cierra el breaker a mano, sin esperar al TTL.
   *
   * Existe para "ya se que el backend volvio". No se llama desde ninguna
   * pantalla a proposito: ponerlo en un boton de Ajustes lo convertiria en algo
   * que el usuario aprende a pulsar cuando el problema no es suyo.
   */
  cerrarBreaker(): void {
    this.registrarExito();
  }

  /**
   * Envuelve una promesa en un presupuesto de tiempo.
   *
   * Delega en `limite`, que es inyectable por lo que dice el contrato de ese
   * tipo. La version de produccion cancela el temporizador cuando la peticion
   * gana la carrera.
   *
   * La promesa original no se cancela, y es deliberado: si era la unica
   * peticion capaz de despertar el contenedor, abortarla impediria
   * precisamente lo que el precalentamiento viene a conseguir. El transporte de
   * produccion tiene su propio timeout interno, asi que no se queda colgada.
   */
  private conPresupuesto<T>(
    promesa: Promise<T>,
    ms: number
  ): Promise<{ ok: true; valor: T } | { ok: false; agotado: true }> {
    return this.limite(promesa, ms);
  }

  async chat(
    messages: { role: string; content: string }[],
    contextText?: string
  ): Promise<ResultadoChat> {
    if (this.breakerAbierto()) {
      return {
        ok: false,
        origen: 'app',
        codigo: 'BREAKER_OPEN',
        local: true,
        detalle: 'circuito abierto por fallos de capacidad del backend',
        intentos: 0,
      };
    }

    const cuerpo = JSON.stringify({
      messages,
      ...(contextText ? { context_text: contextText } : {}),
    });

    const inicio = this.ahora();
    let intentos = 0;

    for (const espera of [0, ...ESPERA_PLATAFORMA_MS]) {
      const restante = TIMEOUT_CHAT_TOTAL_MS - (this.ahora() - inicio);
      if (restante <= 0) break;
      if (intentos > 0) await this.sleep(espera);

      intentos += 1;

      let status = 0;
      let body: unknown = null;
      let headers: { get(n: string): string | null } | undefined;
      let agotado = false;

      try {
        const peticion = this.transport(RUTA_CHAT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: cuerpo,
        });
        const carrera = await this.conPresupuesto(peticion, Math.min(TIMEOUT_CHAT_MS, restante));

        if (!carrera.ok) {
          agotado = true;
        } else {
          const res = carrera.valor;
          status = res.status;
          headers = res.headers;
          body = await res.json().catch(() => null);
        }
      } catch {
        // Ni status ni cuerpo: no hubo respuesta. Es lo mas parecido a una
        // plataforma caida, y por el mismo motivo no cuenta para el breaker.
        return {
          ok: false,
          origen: 'red',
          local: true,
          detalle: 'sin respuesta del servidor',
          intentos,
        };
      }

      if (agotado) {
        // No se reintenta: si el primer intento consumio el presupuesto total,
        // no queda tiempo para otro, y esperar mas seria hacer al usuario peor
        // la situacion que este modulo existe para evitar.
        return {
          ok: false,
          origen: 'red',
          local: true,
          detalle: `sin respuesta en ${TIMEOUT_CHAT_MS} ms (wake en curso)`,
          intentos,
        };
      }

      if (esSobreExito(body)) {
        this.registrarExito();
        return { ok: true, data: adaptarChat(body.data), intentos };
      }

      const fallo = clasificarFallo({ status, body, headers });

      if (fallo.origen === 'platforma') {
        continue;
      }

      this.registrarFalloDeApp();
      return {
        ok: false,
        origen: 'app',
        codigo: fallo.codigo,
        retryable: fallo.retryable,
        local: true,
        detalle: `el backend respondio ${fallo.codigo ?? status}`,
        intentos,
      };
    }

    return {
      ok: false,
      origen: 'platforma',
      local: true,
      detalle: 'la plataforma no respondio tras varios intentos',
      intentos,
    };
  }

  /**
   * Precalentamiento: GET a /status en segundo plano, con presupuesto por
   * encima del wake medido.
   *
   * Nunca lanza y nunca bloquea a quien la llama. Si falla, el chat seguira
   * intentando por su cuenta: un precalentamiento que puede romper la pantalla
   * es peor que no tenerlo.
   *
   * Un exito CIERRA el breaker, y conviene ser honesto sobre lo que eso
   * significa: /status prueba que el proceso vive, no que tenga modelos. Lo que
   * se compra es que un fallo de capacidad viejo no siga penalizando a un
   * backend que acaba de despertar. Reintentar un chat cuesta una peticion, y
   * esa peticion es exactamente eliejemplo de que el servicio responde.
   */
  async precalentar(): Promise<{ despierto: boolean; detalle?: string }> {
    try {
      const carrera = await this.conPresupuesto(
        this.transport(RUTA_STATUS, { method: 'GET' }),
        TIMEOUT_PREWARM_MS
      );

      if (!carrera.ok) {
        return { despierto: false, detalle: 'timeout' };
      }

      const res = carrera.valor;
      const body = await res.json().catch(() => null);

      if (esSobreExito(body)) {
        this.registrarExito();
        return { despierto: true };
      }

      const fallo = clasificarFallo({ status: res.status, body, headers: res.headers });
      return { despierto: false, detalle: fallo.origen };
    } catch {
      return { despierto: false, detalle: 'red' };
    }
  }
  /**
   * Transcribe un archivo de audio dividiéndolo en trozos y enviándolos al backend.
   * Utiliza el presupuesto TIMEOUT_PREWARM_MS por trozo ya que la subida puede ser lenta.
   */
  async transcribeChunked(audioUri: string, onProgress?: (percent: number) => void): Promise<ResultadoChat> {
    if (this.breakerAbierto()) {
      return {
        ok: false,
        origen: 'app',
        codigo: 'BREAKER_OPEN',
        local: true,
        detalle: 'circuito abierto por fallos de capacidad del backend',
        intentos: 0,
      };
    }

    const FileSystem = require('expo-file-system/legacy');
    let fileInfo;
    try {
      fileInfo = await FileSystem.getInfoAsync(audioUri);
    } catch (e) {
      return { ok: false, origen: 'app', local: true, detalle: 'Error leyendo archivo', intentos: 0 };
    }

    if (!fileInfo.exists) {
      return { ok: false, origen: 'app', local: true, detalle: 'Archivo no encontrado', intentos: 0 };
    }

    const uploadId = 'up_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const chunkSize = 4 * 1024 * 1024; // 4MB
    const totalChunks = Math.ceil(fileInfo.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      let chunkUri = audioUri;

      if (totalChunks > 1) {
        // Si hay mas de 1 chunk, cortamos usando read/write en Base64
        const position = i * chunkSize;
        let length = chunkSize;
        if (position + length > fileInfo.size) {
          length = fileInfo.size - position;
        }

        const b64 = await FileSystem.readAsStringAsync(audioUri, {
          encoding: FileSystem.EncodingType.Base64,
          position,
          length
        });
        chunkUri = FileSystem.documentDirectory + `chunk_${uploadId}_${i}.m4a`;
        await FileSystem.writeAsStringAsync(chunkUri, b64, { encoding: FileSystem.EncodingType.Base64 });
      }

      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(i));
      formData.append('totalChunks', String(totalChunks));
      formData.append('chunk', {
        uri: chunkUri,
        name: `chunk_${i}.m4a`,
        type: 'audio/mp4',
      } as any);

      let status = 0;
      let body: unknown = null;
      let headers: { get(n: string): string | null } | undefined;
      let peticionOk = false;
      let finalResult = null;

      try {
        const peticion = this.transport('/ai/v2/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'multipart/form-data' },
          body: formData,
        });

        // Damos bastante margen a la subida (75s por trozo)
        const carrera = await this.conPresupuesto(peticion, TIMEOUT_PREWARM_MS);
        
        if (totalChunks > 1) {
          await FileSystem.deleteAsync(chunkUri, { idempotent: true });
        }

        if (!carrera.ok) {
           return { ok: false, origen: 'red', local: true, detalle: 'timeout subiendo trozo', intentos: 1 };
        }

        const res = carrera.valor;
        status = res.status;
        headers = res.headers;
        body = await res.json().catch(() => null);
        
        if (status === 200 && esSobreExito(body)) {
          if (i === totalChunks - 1) {
             finalResult = { ok: true as const, data: adaptarChat(body.data), intentos: 1 };
          }
          peticionOk = true;
        }
      } catch (err) {
        if (totalChunks > 1) await FileSystem.deleteAsync(chunkUri, { idempotent: true });
        return { ok: false, origen: 'red', local: true, detalle: 'error de red', intentos: 1 };
      }

      if (!peticionOk) {
        const fallo = clasificarFallo({ status, body, headers });
        if (fallo.origen === 'app') this.registrarFalloDeApp();
        return {
          ok: false,
          origen: fallo.origen,
          codigo: fallo.codigo,
          local: true,
          detalle: `el backend respondio ${status}`,
          intentos: 1,
        };
      }

      if (onProgress) {
        onProgress((i + 1) / totalChunks);
      }

      if (finalResult) {
        this.registrarExito();
        return finalResult;
      }
    }

    return { ok: false, origen: 'app', local: true, detalle: 'Finalizo sin resultado', intentos: 1 };
  }
}
