/**
 * backendDetector.ts
 *
 * Módulo de detección inteligente de backend disponible.
 * Realiza health checks rápidos al servidor local y Render para determinar
 * cuál usar sin bloquear la app.
 *
 * Estrategia:
 * 1. Si EXPO_PUBLIC_API_URL está configurada y es accesible → úsala
 * 2. Si no, intenta local con timeout de 1s
 * 3. Si local está disponible → úsalo (desarrollo)
 * 4. Si local no está disponible → fallback a Render (producción)
 */

import { Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

export interface BackendConfig {
  url: string;
  source: 'render' | 'local' | 'env';
  isAvailable: boolean;
  timestamp: number;
}

const HEALTH_CHECK_TIMEOUT = 3000;
const HEALTH_CHECK_CACHE_DURATION = 30000;
const HEALTH_CHECK_ENDPOINT = '/health';
const LOCALHOST_TIMEOUT = 1500;

/** MMKV key para persistir el último backend exitoso entre sesiones */
const LAST_BACKEND_KEY = 'last_successful_backend_url';

let lastSuccessfulBackendUrl: string | null = null;
let cachedBackendConfig: BackendConfig | null = null;
let lastHealthCheckTime = 0;

/** Guarda la URL del último backend que respondió OK, en MMKV y en memoria */
function saveSuccessfulBackend(url: string): void {
  lastSuccessfulBackendUrl = url;
  try {
    const mmkv = createMMKV();
    mmkv.set(LAST_BACKEND_KEY, url);
  } catch {
    // Fallback silencioso — si MMKV falla, seguimos con la cache en memoria
  }
}

/** Lee la URL del último backend exitoso desde MMKV */
function loadLastSuccessfulBackend(): string | null {
  if (lastSuccessfulBackendUrl) return lastSuccessfulBackendUrl;
  try {
    const mmkv = createMMKV();
    const stored = mmkv.getString(LAST_BACKEND_KEY);
    if (stored) lastSuccessfulBackendUrl = stored;
    return lastSuccessfulBackendUrl;
  } catch {
    return null;
  }
}

/**
 * Obtiene todas las URLs base candidatas (sin /api ni /health).
 * El detector intentará conectar a ${baseUrl}/health
 * Y el cliente usará ${baseUrl}/api para requests normales.
 */
function getCandidateBaseUrls(localIp: string, ports: number[]): string[] {
  const candidates: string[] = [];
  
  if (__DEV__) {
    // 1. IP explícita del servidor backend (mayor prioridad en dev)
    //    Soporta tanto EXPO_PUBLIC_API_HOST como EXPO_PUBLIC_LOCAL_SERVER_IP
    const serverIp =
      process.env.EXPO_PUBLIC_API_HOST ||
      process.env.EXPO_PUBLIC_LOCAL_SERVER_IP ||
      null;
    if (serverIp && serverIp !== '127.0.0.1') {
      for (const port of ports) {
        candidates.push(`http://${serverIp}:${port}`);
      }
    }
    
    // 2. IP detectada de Expo Metro (IP de la PC en la red local)
    //    Solo la agregamos si es diferente a la del env var
    if (localIp && localIp !== '127.0.0.1' && localIp !== serverIp) {
      for (const port of ports) {
        candidates.push(`http://${localIp}:${port}`);
      }
    }

    // 3. Para emulador Android: 10.0.2.2 es la IP del host desde el emulador
    if (Platform.OS === 'android') {
      for (const port of ports) {
        candidates.push(`http://10.0.2.2:${port}`);
      }
    }
    
    // 4. localhost (solo funciona en iOS Simulator, nunca en Android)
    if (Platform.OS !== 'android') {
      for (const port of ports) {
        candidates.push(`http://localhost:${port}`);
      }
    }
  }
  
  // Siempre intentar Render como último recurso
  if (process.env.EXPO_PUBLIC_API_URL) {
    // Remover /api del final si existe (ya lo agregaremos después)
    const renderBase = process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    candidates.push(renderBase);
  }
  
  return candidates.filter((url, idx, arr) => arr.indexOf(url) === idx); // Eliminar duplicados
}

/**
 * Realiza un health check a una URL específica con timeout.
 * Retorna true si el endpoint responde, false si falla o timeout.
 */
async function isBackendAvailable(
  baseUrl: string,
  timeout: number = HEALTH_CHECK_TIMEOUT,
  cancelSignal?: AbortSignal
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Si nos cancelan desde fuera (otra URL ya ganó la race), abortamos también
    if (cancelSignal) {
      if (cancelSignal.aborted) return false;
      cancelSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      }, { once: true });
    }

    const response = await fetch(`${baseUrl}${HEALTH_CHECK_ENDPOINT}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);
    if (cancelSignal?.aborted) return false;

    if (response.ok) {
      console.log(`[Health Check] ✅ ${baseUrl} - OK (${response.status})`);
      return true;
    }

    const isRenderUrl = process.env.EXPO_PUBLIC_API_URL &&
      baseUrl === process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    if (response.status === 404 && isRenderUrl) {
      console.log(`[Health Check] ✅ ${baseUrl} - HTTP 404 (asumido disponible — Render sin /health)`);
      return true;
    }

    console.warn(`[Health Check] ⚠️ ${baseUrl} - HTTP ${response.status}`);
    return false;
  } catch (error) {
    // Si la cancelación externa ya ocurrió, salimos en silencio
    if (cancelSignal?.aborted) return false;

    const errorName = error instanceof Error ? error.name : 'Unknown';
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorName === 'AbortError') {
      console.warn(`[Health Check] ⏱️ ${baseUrl} - TIMEOUT (${timeout}ms)`);
    } else if (errorMsg.includes('Network') || errorMsg.includes('Failed to fetch')) {
      console.warn(`[Health Check] 🌐 ${baseUrl} - Network error: ${errorMsg}`);
    } else {
      console.warn(`[Health Check] ❌ ${baseUrl} - ${errorName}: ${errorMsg}`);
    }

    return false;
  }
}

/**
 * Realiza health checks en paralelo a múltiples URLs y retorna la primera disponible.
 * Utiliza timeouts variables dependiendo de la URL:
 * - localhost/10.0.2.2: 500ms (fail fast si no está disponible en emulador)
 * - otras: 3000ms (IP local y Render)
 */
async function findAvailableBackendParallel(
  urls: string[],
  defaultTimeout: number = HEALTH_CHECK_TIMEOUT
): Promise<string | null> {
  if (urls.length === 0) return null;
  
  if (urls.length === 1) {
    const timeout = getTimeoutForUrl(urls[0], defaultTimeout);
    const available = await isBackendAvailable(urls[0], timeout);
    return available ? urls[0] : null;
  }
  
  // Competitive race: la primera URL que responda 200 gana.
  // Las demás se abortan vía AbortController para no desperdiciar recursos.
  return new Promise<string | null>((resolve) => {
    const controllers: AbortController[] = [];
    let settled = false;
    let pending = urls.length;

    function abortAll(): void {
      for (const c of controllers) {
        try { c.abort(); } catch { /* ignore */ }
      }
    }

    for (const url of urls) {
      const controller = new AbortController();
      controllers.push(controller);

      const startTime = Date.now();
      const timeout = getTimeoutForUrl(url, defaultTimeout);
      isBackendAvailable(url, timeout, controller.signal)
        .then((available) => {
          if (settled) return; // Descarte silencioso: otro backend ya ganó

          const elapsed = Date.now() - startTime;
          if (available) {
            console.log(`[Health Check] ⏱️  ${url} took ${elapsed}ms  ← GANADOR`);
            settled = true;
            abortAll();
            resolve(url);
          } else {
            console.log(`[Health Check] ⏱️  ${url} took ${elapsed}ms`);
            pending--;
            if (pending === 0) resolve(null);
          }
        });
    }
  });
}

/**
 * Determina el timeout apropriado para una URL.
 * localhost/10.0.2.2: 500ms (fail fast)
 * otras: 3000ms
 */
function getTimeoutForUrl(url: string, defaultTimeout: number): number {
  if (url.includes('localhost') || url.includes('10.0.2.2')) {
    return LOCALHOST_TIMEOUT;
  }
  return defaultTimeout;
}

/**
 * Detecta qué backend está disponible y retorna su URL base.
 * Primero verifica si tenemos un backend en caché (válido), luego hace health checks.
 *
 * @param localIp - Dirección IP local (para URLs locales)
 * @param ports - Puertos locales a intentar
 * @returns BackendConfig con la URL base disponible y metadata
 */
export async function detectAvailableBackend(
  localIp: string,
  ports: number[]
): Promise<BackendConfig> {
  const now = Date.now();
  
  // 1. Si tenemos caché en memoria válido, retornarlo
  if (cachedBackendConfig && now - lastHealthCheckTime < HEALTH_CHECK_CACHE_DURATION) {
    console.log(`[Backend Detector] ⚡ Usando caché (${(now - lastHealthCheckTime) / 1000}s atrás):`, cachedBackendConfig.url);
    return cachedBackendConfig;
  }
  
  // 2. Fast path: último backend exitoso persistido en MMKV
  //    Probamos una sola URL en vez de la race paralela.
  //    Si responde, listo. Si falla, recién ejecutamos la detección completa.
  const t0 = performance.now();
  const lastUrl = loadLastSuccessfulBackend();
  const mmkvElapsed = performance.now() - t0;

  if (lastUrl) {
    console.log(`[Backend Detector] ⚡ Intentando último backend exitoso: ${lastUrl} (MMKV: ${mmkvElapsed.toFixed(1)}ms)`);
    const t1 = performance.now();
    const fastTimeout = getTimeoutForUrl(lastUrl, HEALTH_CHECK_TIMEOUT);
    const available = await isBackendAvailable(lastUrl, fastTimeout);
    const healthElapsed = performance.now() - t1;
    const totalElapsed = performance.now() - t0;

    if (available) {
      let source: 'render' | 'local' | 'env' = 'env';
      const renderBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/?$/, '');
      if (lastUrl === renderBase) source = 'render';
      else if (lastUrl.includes('http://')) source = 'local';

      cachedBackendConfig = {
        url: lastUrl,
        source,
        isAvailable: true,
        timestamp: now,
      };
      lastHealthCheckTime = now;
      console.log(`[Backend Detector] ✅ Fast path — ${lastUrl} (MMKV: ${mmkvElapsed.toFixed(1)}ms | Health: ${healthElapsed.toFixed(0)}ms | Total: ${totalElapsed.toFixed(0)}ms)`);
      return cachedBackendConfig;
    }

    const fastTotal = performance.now() - t0;
    console.log(`[Backend Detector] ⏩ Fast path falló (${fastTotal.toFixed(0)}ms), ejecutando detección completa`);
  }
  
  const candidates = getCandidateBaseUrls(localIp, ports);
  console.log(`[Backend Detector] 🔍 Detectando backend disponible...`);
  console.log(`[Backend Detector] 📋 Candidatos (base URLs):`, candidates);
  console.log(`[Backend Detector] ⏱️  Timeout por URL: ${HEALTH_CHECK_TIMEOUT}ms`);
  
  // Obtener base URL del env una sola vez
  const renderBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/?$/, '');
  
  // 2. Health checks en paralelo
  console.log(`[Backend Detector] 🚀 Iniciando health checks en paralelo...`);
  const startTime = Date.now();
  
  const availableUrl = await findAvailableBackendParallel(candidates, HEALTH_CHECK_TIMEOUT);
  
  const elapsed = Date.now() - startTime;
  console.log(`[Backend Detector] ⏱️  Health checks completados en ${elapsed}ms`);
  
  if (availableUrl) {
    // Determinar la fuente del URL disponible
    let source: 'render' | 'local' | 'env' = 'env';
    if (availableUrl === renderBase) {
      source = 'render';
    } else if (availableUrl.includes('http://')) {
      source = 'local';
    }
    
    cachedBackendConfig = {
      url: availableUrl,
      source,
      isAvailable: true,
      timestamp: now,
    };
    
    lastHealthCheckTime = now;
    
    saveSuccessfulBackend(availableUrl);
    
    const emoji = source === 'local' ? '🖥️ Local' : '☁️ Render';
    console.log(`[Backend Detector] ✅ Backend disponible: ${emoji}`, availableUrl);
    
    return cachedBackendConfig;
  }
  
  // 3. Si nada está disponible, usar la primera candidata como fallback
  // (probablemente Render, que debería estar siempre disponible en producción)
  const fallbackUrl = candidates[0] || 'http://localhost:3000';
  
  cachedBackendConfig = {
    url: fallbackUrl,
    source: fallbackUrl === renderBase ? 'render' : 'local',
    isAvailable: false,
    timestamp: now,
  };
  
  lastHealthCheckTime = now;
  
  console.warn(
    `[Backend Detector] ⚠️ No hay backend disponible. Usando fallback:`,
    fallbackUrl,
    '(puede no estar disponible)'
  );
  
  // 🔧 DEBUG: Información adicional
  console.warn(
    `[Backend Detector] 🔧 DEBUG INFO:`,
    `\n  EXPO_PUBLIC_API_HOST: ${process.env.EXPO_PUBLIC_API_HOST || 'NO CONFIGURADA'}`,
    `\n  localIp (Expo Metro): ${localIp}`,
    `\n  Puertos a intentar: ${ports.join(', ')}`,
    `\n  EXPO_PUBLIC_API_URL: ${process.env.EXPO_PUBLIC_API_URL || 'NO CONFIGURADA'}`,
    `\n  __DEV__: ${__DEV__}`
  );
  
  return cachedBackendConfig;
}

/**
 * Resetea el caché de detección para forzar un nuevo health check.
 * Útil para testing o cuando el usuario cambia de red.
 */
export function resetBackendDetectionCache(): void {
  cachedBackendConfig = null;
  lastHealthCheckTime = 0;
  lastSuccessfulBackendUrl = null;
  try {
    const mmkv = createMMKV();
    mmkv.delete(LAST_BACKEND_KEY);
  } catch { /* ignore */ }
  console.log(`[Backend Detector] 🔄 Caché de detección y MMKV resetados.`);
}

/**
 * Retorna la URL del último backend exitoso persistido en MMKV, o null si no existe.
 */
export function getLastSuccessfulBackendUrl(): string | null {
  return loadLastSuccessfulBackend();
}

/**
 * Retorna la configuración del backend en caché (si existe).
 * No hace health checks, solo retorna lo que ya se detectó.
 */
export function getCachedBackendConfig(): BackendConfig | null {
  return cachedBackendConfig;
}

/**
 * Retorna una descripción amigable del estado del backend.
 */
export function getBackendStatusMessage(config: BackendConfig): string {
  const statusEmoji = config.isAvailable ? '✅' : '⚠️';
  const sourceLabel = {
    local: '🖥️ Servidor Local',
    render: '☁️ Render Remoto',
    env: '🔧 Configurado',
  }[config.source];
  
  const availabilityMsg = config.isAvailable
    ? 'disponible'
    : 'no verificado (puede estar desconectado)';
  
  return `${statusEmoji} ${sourceLabel} - ${availabilityMsg}`;
}
