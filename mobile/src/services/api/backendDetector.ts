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

export interface BackendConfig {
  url: string;
  source: 'render' | 'local' | 'env';
  isAvailable: boolean;
  timestamp: number;
}

const HEALTH_CHECK_TIMEOUT = 3000; // Aumentado a 3 segundos (emuladores pueden ser lentos)
const HEALTH_CHECK_CACHE_DURATION = 30000; // 30 segundos (cachear decisión localmente)
const HEALTH_CHECK_ENDPOINT = '/health'; // Endpoint público (sin /api, sin autenticación)

// Timeout para localhost/10.0.2.2 en emuladores (fail fast pero con tiempo suficiente)
const LOCALHOST_TIMEOUT = 1500; // 1.5s para localhost/10.0.2.2

let cachedBackendConfig: BackendConfig | null = null;
let lastHealthCheckTime = 0;

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
    
    // 4. localhost (funciona solo en emuladores, no en dispositivos físicos)
    for (const port of ports) {
      candidates.push(`http://localhost:${port}`);
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
async function isBackendAvailable(baseUrl: string, timeout: number = HEALTH_CHECK_TIMEOUT): Promise<boolean> {
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);
    
    const response = await fetch(`${baseUrl}${HEALTH_CHECK_ENDPOINT}`, {
      method: 'GET',
      signal: abortController.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`[Health Check] ✅ ${baseUrl} - OK (${response.status})`);
      return true;
    }

    // Render puede no tener /health en la raíz; considerarlo disponible si responde (incluso 404)
    const isRenderUrl = process.env.EXPO_PUBLIC_API_URL &&
      baseUrl === process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    if (response.status === 404 && isRenderUrl) {
      console.log(`[Health Check] ✅ ${baseUrl} - HTTP 404 (asumido disponible — Render sin /health)`);
      return true;
    }

    console.warn(`[Health Check] ⚠️ ${baseUrl} - HTTP ${response.status}`);
    return false;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'Unknown';
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Distinguir tipos de error
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
  
  // Si hay solo una URL, no parallelizar
  if (urls.length === 1) {
    const timeout = getTimeoutForUrl(urls[0], defaultTimeout);
    const available = await isBackendAvailable(urls[0], timeout);
    return available ? urls[0] : null;
  }
  
  // Hacer health checks en paralelo
  const checks = urls.map((url) => {
    const startTime = Date.now();
    const timeout = getTimeoutForUrl(url, defaultTimeout);
    return isBackendAvailable(url, timeout)
      .then((available) => {
        const elapsed = Date.now() - startTime;
        console.log(`[Health Check] ⏱️  ${url} took ${elapsed}ms`);
        return { url, available };
      })
      .catch((error) => {
        const elapsed = Date.now() - startTime;
        console.error(`[Health Check] ❌ Error en ${url} (${elapsed}ms):`, error);
        return { url, available: false };
      });
  });
  
  const results = await Promise.all(checks);
  
  // Retornar la primera disponible (en orden de prioridad)
  const available = results.find((r) => r.available);
  return available?.url || null;
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
  
  // 1. Si tenemos caché válido, retornarlo
  if (cachedBackendConfig && now - lastHealthCheckTime < HEALTH_CHECK_CACHE_DURATION) {
    console.log(`[Backend Detector] ⚡ Usando caché (${(now - lastHealthCheckTime) / 1000}s atrás):`, cachedBackendConfig.url);
    return cachedBackendConfig;
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
  console.log(`[Backend Detector] 🔄 Caché de detección resetado.`);
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
