/**
 * client.ts
 *
 * Núcleo HTTP de la capa de servicios. Centraliza la lógica de:
 * - Detección automática inteligente del backend (local vs Render)
 * - Detección automática de la IP LAN del servidor en desarrollo.
 * - Construcción de las URLs base de la API (soporta varios puertos y env. de producción).
 * - `fetchWithFallback`: intenta todos los candidatos de URL en orden, rotando
 *   el servidor activo para las llamadas siguientes si uno falla.
 * - `parseJsonSafely`: evita que errores de parseo de JSON rompan el flujo.
 *
 * MEJORA: Ahora detecta automáticamente si el servidor local está disponible
 * con un health check rápido (1s timeout) antes de decidir.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storageService } from '../storageService';
import { detectAvailableBackend, resetBackendDetectionCache } from './backendDetector';
import { useLocalAIStore } from '../../store/useLocalAIStore';

/** Valida que un string tenga formato de dirección IPv4 válida */
export const isValidIpv4 = (value: string): boolean => {
  const parts = value.split('.');
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
};

/** Devuelve `true` si la IP pertenece a un rango privado LAN (10.x, 192.168.x, 172.16-31.x) */
export const isPrivateLanIpv4 = (value: string): boolean => {
  if (!isValidIpv4(value)) return false;

  if (value.startsWith('10.') || value.startsWith('192.168.')) return true;

  if (value.startsWith('172.')) {
    const secondOctet = Number(value.split('.')[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return false;
};

/** Extrae la IP LAN del host de Expo Metro para determinar la dirección del servidor de desarrollo */
export const getExpoHostIp = (): string | null => {
  if (Platform.OS === 'web') {
    return window.location.hostname || '127.0.0.1';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    null;

  if (!hostUri) return null;

  const match = hostUri.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  const candidateIp = match?.[0]?.trim();

  if (!candidateIp) return null;
  return isPrivateLanIpv4(candidateIp) ? candidateIp : null;
};

export const DEFAULT_LAN_IP =
  Platform.OS === 'web'
    ? (typeof window !== 'undefined' && window.location.hostname) || '127.0.0.1'
    : getExpoHostIp() || process.env.EXPO_PUBLIC_API_HOST || '127.0.0.1';

export const API_PORTS = [3000, 3001];

export let API_BASE_URLS: string[] = [];
export let activeBaseUrl = '';

// 🔷 Estado de inicialización
let isApiClientInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Inicializa el cliente API con detección automática del backend disponible.
 * Debe llamarse al inicio de la app (en RootLayout o similar).
 *
 * Flujo:
 * 1. Usa un backend por defecto inmediatamente (Render o localhost)
 * 2. En background, detecta qué backend está realmente disponible
 * 3. Cuando encuentra disponible, cambia automáticamente
 * 4. Esto no bloquea el startup de la app
 */
export async function initializeApiClient(): Promise<void> {
  // Si ya se está inicializando, esperar a que termine
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Si ya se inicializó, no hacer nada
  if (isApiClientInitialized) {
    console.log('[API Client] ✅ Ya inicializado.');
    return;
  }
  
  initializationPromise = (async () => {
    try {
      console.log('[API Client] 🚀 Inicializando...');
      
      // 1. Setup inicial rápido (no bloqueante)
      const localIp = getExpoHostIp() || process.env.EXPO_PUBLIC_API_HOST || '127.0.0.1';
      setupDefaultApiUrls();
      isApiClientInitialized = true;
      
      console.log(
        '[API Client] ✅ Inicialización rápida completada.',
        `\n  🎯 Usando: ${activeBaseUrl}`,
        `\n  🔄 Detectando en background...`
      );
      
      // 2. Detección en background (no bloquea)
      // Esta es una Promise que NO esperamos, para que no bloquee
      detectAvailableBackend(localIp, API_PORTS)
        .then((detectedBackend) => {
          if (detectedBackend.isAvailable) {
            // Convertir base URL a API URL agregando /api
            const apiUrl = detectedBackend.url.endsWith('/api') 
              ? detectedBackend.url 
              : `${detectedBackend.url}/api`;
            
            if (apiUrl !== activeBaseUrl) {
              console.log(`[API Client] 🔄 Cambiando a backend detectado: ${apiUrl}`);
              
              // Actualizar URLs con la detectada primero
              const newUrls: string[] = [apiUrl];
              
              // Agregar fallbacks (otras IPs locales)
              for (const port of API_PORTS) {
                const fallbackUrl = `http://${localIp}:${port}/api`;
                if (!newUrls.includes(fallbackUrl) && fallbackUrl !== apiUrl) {
                  newUrls.push(fallbackUrl);
                }
              }
              
              // Agregar Render si está configurada
              if (process.env.EXPO_PUBLIC_API_URL && !newUrls.includes(process.env.EXPO_PUBLIC_API_URL)) {
                newUrls.push(process.env.EXPO_PUBLIC_API_URL);
              }
              
              API_BASE_URLS = newUrls;
              activeBaseUrl = newUrls[0];
              
              console.log(`[API Client] ✅ Backend optimizado: ${activeBaseUrl}`);
            } else {
              console.log(`[API Client] ℹ️  Backend detectado es el mismo que está en uso`);
            }
          } else {
            console.log(`[API Client] ℹ️  No se detectó backend disponible, usando configuración por defecto`);
          }
        })
        .catch((error) => {
          console.error('[API Client] Error en detección background:', error);
        });
      
    } catch (error) {
      console.error('[API Client] ❌ Error durante inicialización:', error);
      setupDefaultApiUrls();
      isApiClientInitialized = true;
    } finally {
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
}

/**
 * Configura URLs por defecto si la detección falla.
 * Se usa como fallback en caso de error.
 */
function setupDefaultApiUrls(): void {
  const localIp = getExpoHostIp() || process.env.EXPO_PUBLIC_API_HOST || '127.0.0.1';
  
  API_BASE_URLS = [];
  
  if (__DEV__) {
    // 1. LAN IP primero (funciona en dispositivos físicos y simuladores)
    if (localIp && localIp !== '127.0.0.1') {
      API_BASE_URLS.push(...API_PORTS.map((port) => `http://${localIp}:${port}/api`));
    }
    
    // 2. 10.0.2.2 para Android emulator
    if (Platform.OS === 'android') {
      API_BASE_URLS.push(...API_PORTS.map((port) => `http://10.0.2.2:${port}/api`));
    }
    
    // 3. localhost al final (solo funciona en iOS simulator)
    API_BASE_URLS.push(...API_PORTS.map((port) => `http://localhost:${port}/api`));
  }
  
  // 4. Render como respaldo si internet está disponible
  if (process.env.EXPO_PUBLIC_API_URL) {
    API_BASE_URLS.push(process.env.EXPO_PUBLIC_API_URL);
  }
  
  // Si no hay URLs configuradas, fallback a localhost
  if (API_BASE_URLS.length === 0) {
    API_BASE_URLS = API_PORTS.map((port) => `http://localhost:${port}/api`);
  }
  
  activeBaseUrl = API_BASE_URLS[0];
}

/**
 * Resetea la detección de backend y fuerza un nuevo health check.
 * Útil cuando el usuario cambia de red o quiere reconectar.
 */
export async function resetApiClientDetection(): Promise<void> {
  isApiClientInitialized = false;
  initializationPromise = null;
  resetBackendDetectionCache();
  await initializeApiClient();
}

// ─── Setup inicial (fallback mientras se inicializa) ─────────────────────────
setupDefaultApiUrls();

// Log de configuración inicial
console.log(
  '[API Client] 📋 Setup inicial:',
  __DEV__ ? '🔨 Development Mode' : '🚀 Production Mode',
  '| EXPO_PUBLIC_API_URL:',
  process.env.EXPO_PUBLIC_API_URL ? '✓ Configurada' : '✗ No configurada',
  '| URLs base (antes de init):',
  API_BASE_URLS
);

export const buildApiError = (message: string): Error => new Error(message);

/**
 * Realiza la petición HTTP probándolas todas las URLs base en orden.
 * Implementa una estrategia "Network First, Fallback to Cache" para offline.
 */
export const fetchWithFallback = async (path: string, init?: RequestInit): Promise<Response> => {
  const method = init?.method?.toUpperCase() || 'GET';
  
  // 🛡️ Si el modo offline forzado está activo, no hacer llamadas de red
  const isOffline = useLocalAIStore.getState().forceOfflineMode;
  if (isOffline) {
    const isCacheable = method === 'GET';
    const cacheKey = `api_cache_${path}`;
    if (isCacheable) {
      try {
        const cachedEntry = await storageService.getLocal(cacheKey);
        if (cachedEntry) {
          let data: string | undefined;
          try {
            const parsed = JSON.parse(cachedEntry);
            data = parsed.data;
          } catch {
            data = cachedEntry;
          }
          if (data) {
            console.log(`[Offline] Sirviendo desde cache: ${path}`);
            return new Response(data, {
              status: 200,
              statusText: 'OK',
              headers: new Headers({ 'Content-Type': 'application/json' })
            });
          }
        }
      } catch {}
    }
    throw buildApiError('Modo offline forzado — no hay conexión al servidor.');
  }
  
  // 🛡️ Rutas excluidas de cache (IA, OCR, etc.)
  // Nota: YouTube videos INCLUYEN caché para fallback cuando hay error de conexión
  const isExcluded = path.includes('/ocr') || 
                     path.includes('/ai') || 
                     path.includes('/transcribe') || 
                     path.includes('/generate') ||
                     path.includes('/analyze') ||
                     path.includes('/pdf-extract') ||
                     path.includes('/youtube-transcripts'); // Solo excluir transcripts, no videos
                     
  const API_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const isCacheable = method === 'GET' && !isExcluded;
const cacheKey = `api_cache_${path}`;

  const candidates = [
    activeBaseUrl,
    ...API_BASE_URLS.filter((base) => base !== activeBaseUrl),
  ];

  let lastError: unknown = null;

  // 🛡️ Fase 5: Inyectar el Token JWT automáticamente en cada petición
  const token = await storageService.getSecure('jwt_token');
  const headers = new Headers(init?.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (method === 'GET') {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }

  const customInit = { ...init, headers };

  for (const base of candidates) {
    try {
      const fullUrl = `${base}${path}`;
      const response = await fetch(fullUrl, customInit);
      
      // ✅ Solo actualizar activeBaseUrl si la conexión fue exitosa
      if (response.ok) {
        activeBaseUrl = base;
        console.log(`[✓ API] ${method} ${path} → ${response.status} (${base.split('/api')[0]})`);
      } else {
        console.warn(`[⚠ API] ${method} ${path} → ${response.status} (${base.split('/api')[0]})`);
      }
      
      // ✅ Interceptar 304 Not Modified y servir desde caché
      if (response.status === 304 && isCacheable) {
        console.log(`[Cache] 304 Not Modified interceptado para ${path}. Sirviendo caché local.`);
        const cachedEntry = await storageService.getLocal(cacheKey);
        if (cachedEntry) {
          try {
            const parsed = JSON.parse(cachedEntry);
            const age = Date.now() - (parsed.timestamp || 0);
            if (age <= API_CACHE_TTL_MS) {
              return new Response(parsed.data, {
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' })
              });
            }
            console.log(`[Cache] Cache expirado para ${path}, ignorando 304`);
          } catch {
            // old format without TTL wrapper, serve it anyway
            return new Response(cachedEntry, {
              status: 200,
              statusText: 'OK',
              headers: new Headers({ 'Content-Type': 'application/json' })
            });
          }
        }
      }

      // ✅ Guardar en cache si es exitosa y cacheable (con timestamp para TTL)
      if (response.ok && isCacheable) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          await storageService.saveLocal(cacheKey, JSON.stringify({
            data: text,
            timestamp: Date.now(),
          }));
        } catch (e) {
          console.error('[Cache] Error guardando cache para', path, e);
        }
      }
      
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[✗ API] Fallo conectando a ${base}${path} — ${errorMsg}`);
      lastError = error;
    }
  }

  // 🛡️ Fallback: Si no hay conexión (fallaron las URLs) y es cacheable, devolvemos del cache local
  if (isCacheable) {
    try {
      const cachedEntry = await storageService.getLocal(cacheKey);
      if (cachedEntry) {
        let data: string | undefined;
        try {
          const parsed = JSON.parse(cachedEntry);
          const age = Date.now() - (parsed.timestamp || 0);
          if (age <= API_CACHE_TTL_MS) {
            data = parsed.data;
          } else {
            console.log(`[Cache Fallback] Cache expirado para ${path} (${Math.round(age / 60000)}min)`);
          }
        } catch {
          data = cachedEntry; // old format
        }
        if (data) {
          console.log(`[Cache Fallback] Modo Offline. Sirviendo desde cache: ${path}`);
          return new Response(data, {
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'application/json' })
          });
        }
      }
    } catch (cacheError) {
      console.error('[Cache Fallback] Error leyendo de cache', cacheError);
    }
  }

  throw lastError || buildApiError('No se pudo conectar con el servidor.');
};

/** Deserializa el cuerpo JSON de una `Response`. Retorna `null` si el cuerpo está vacío o es inválido */
export const parseJsonSafely = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};
