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
 * Si la URL activa falla, prueba las alternativas y actualiza `activeBaseUrl`
 * con la que responda para que las siguientes peticiones usen esa directamente.
 */
export const fetchWithFallback = async (path: string, init?: RequestInit): Promise<Response> => {
  const candidates = [
    activeBaseUrl,
    ...API_BASE_URLS.filter((base) => base !== activeBaseUrl),
  ];

  let lastError: unknown = null;

  // 🛡️ Fase 5: Inyectar el Token JWT automáticamente en cada petición
  const token = await storageService.getSecure('jwt_token');
  const headers = new Headers(init?.headers || {});
  
  // Si hay un token guardado, lo adjuntamos como un Bearer token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const customInit = { ...init, headers };

  for (const base of candidates) {
    try {
      console.log(`[API] Intentando: ${base}${path}`);
      const response = await fetch(`${base}${path}`, customInit);
      console.log(`[API] Respuesta de ${base}${path}: ${response.status} ${response.statusText}`);
      activeBaseUrl = base;
      return response;
    } catch (error) {
      console.warn(`[API] Falló conexión con ${base}:`, error);
      lastError = error;
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
