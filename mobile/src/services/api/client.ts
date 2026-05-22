/**
 * client.ts
 *
 * Núcleo HTTP de la capa de servicios. Centraliza la lógica de:
 * - Detección automática de la IP LAN del servidor en desarrollo.
 * - Construcción de las URLs base de la API (soporta varios puertos y env. de producción).
 * - `fetchWithFallback`: intenta todos los candidatos de URL en orden, rotando
 *   el servidor activo para las llamadas siguientes si uno falla.
 * - `parseJsonSafely`: evita que errores de parseo de JSON rompan el flujo.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storageService } from '../storageService';

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

if (__DEV__) {
  API_BASE_URLS = API_PORTS.map((port) => `http://${DEFAULT_LAN_IP}:${port}/api`);
  if (process.env.EXPO_PUBLIC_API_URL) {
    API_BASE_URLS.push(process.env.EXPO_PUBLIC_API_URL);
  }
} else {
  API_BASE_URLS = process.env.EXPO_PUBLIC_API_URL 
    ? [process.env.EXPO_PUBLIC_API_URL]
    : API_PORTS.map((port) => `http://${DEFAULT_LAN_IP}:${port}/api`);
}

export let activeBaseUrl = API_BASE_URLS[0];

export const buildApiError = (message: string): Error => new Error(message);

/**
 * Realiza la petición HTTP probándolas todas las URLs base en orden.
 * Implementa una estrategia "Network First, Fallback to Cache" para offline.
 */
export const fetchWithFallback = async (path: string, init?: RequestInit): Promise<Response> => {
  const method = init?.method?.toUpperCase() || 'GET';
  
  // 🛡️ Rutas excluidas de cache (IA, OCR, etc.)
  // Nota: YouTube videos INCLUYEN caché para fallback cuando hay error de conexión
  const isExcluded = path.includes('/ocr') || 
                     path.includes('/ai') || 
                     path.includes('/transcribe') || 
                     path.includes('/generate') ||
                     path.includes('/analyze') ||
                     path.includes('/pdf-extract') ||
                     path.includes('/youtube-transcripts'); // Solo excluir transcripts, no videos
                     
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
      const response = await fetch(`${base}${path}`, customInit);
      activeBaseUrl = base;
      // ✅ Interceptar 304 Not Modified y servir desde caché
      if (response.status === 304 && isCacheable) {
        console.log(`[Cache] 304 Not Modified interceptado para ${path}. Sirviendo caché local.`);
        const cachedText = await storageService.getLocal(cacheKey);
        if (cachedText) {
          return new Response(cachedText, {
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'application/json' })
          });
        }
      }

      // ✅ Guardar en cache si es exitosa y cacheable
      if (response.ok && isCacheable) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          await storageService.saveLocal(cacheKey, text);
        } catch (e) {
          console.error('[Cache] Error guardando cache para', path, e);
        }
      }
      
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  // 🛡️ Fallback: Si no hay conexión (fallaron las URLs) y es cacheable, devolvemos del cache local
  if (isCacheable) {
    try {
      const cachedText = await storageService.getLocal(cacheKey);
      if (cachedText) {
        console.log(`[Cache Fallback] Modo Offline. Sirviendo desde cache: ${path}`);
        return new Response(cachedText, {
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
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
