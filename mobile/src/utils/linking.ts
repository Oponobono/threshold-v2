import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { MediaPlaybackService } from '../services/media/MediaPlaybackService';

/**
 * Esquemas nativos VERIFICADOS que sí existen en las apps.
 * Solo se incluyen plataformas cuyo esquema custom está confirmado y
 * requieren declaración en LSApplicationQueriesSchemes / <queries>.
 *
 * La mayoría de plataformas modernas (Udemy, Coursera, Platzi, LinkedIn
 * Learning, etc.) usan Universal Links (iOS) / App Links (Android) con
 * URLs https:// estándar — el SO las intercepta y abre la app directamente.
 */
const NATIVE_SCHEME_RESOLVERS: Record<string, (url: string) => string | null> = {
  // YouTube: único esquema custom masivamente soportado
  YouTube: (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (match) return `vnd.youtube:${match[1]}`;
    return null;
  },
};

/**
 * Extrae el dominio de una URL para identificar la plataforma.
 * Permite detectar plataformas incluso si no se pasa el campo `platform`.
 */
const extractDomain = (url: string): string => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

/**
 * Mapeo de dominios a nombres de plataforma normalizados.
 * Usado para resolver el resolver correcto cuando `platform` no se pasa.
 */
const DOMAIN_TO_PLATFORM: Record<string, string> = {
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'm.youtube.com': 'YouTube',
};

/**
 * Intenta abrir una URL con Linking.openURL.
 * Retorna true si tuvo éxito, false si falló.
 */
const tryNativeOpen = async (url: string): Promise<boolean> => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // esquema no disponible o app no instalada
  }
  return false;
};

/**
 * openCourseLink — Estrategia de apertura en capas:
 *
 * 1. Reproductor in-app global para YouTube (NUEVO)
 *
 * 2. Esquema nativo custom (solo YouTube vnd.youtube:// por ahora)
 *    → abre la app directamente sin pasar por el navegador (Fallback)
 *
 * 3. Linking.openURL(https_url) directamente
 *    → En iOS: Universal Links → abre la app si está instalada
 *    → En Android: App Links → abre la app si está instalada
 *    → Si no hay app: el SO abre el navegador nativo del dispositivo
 *    → Este comportamiento es CORRECTO y el esperado para Udemy,
 *      Coursera, Platzi, LinkedIn Learning, edX, Skillshare, etc.
 *
 * 4. WebBrowser in-app (expo-web-browser) — solo si Linking falla
 *    completamente (URL malformada, sin conectividad, etc.)
 *
 * Nota: Ya NO se usan esquemas inventados como `coursera://`,
 * `udemy://`, `platzi://` porque esas apps no los registran
 * públicamente y causan que canOpenURL devuelva false en todos los
 * dispositivos, impidiendo llegar al paso de Universal Links.
 */
export const openCourseLink = async (url: string, platform?: string, options?: { subjectId?: string | null, courseId?: string | null, onVideoEnd?: () => void }): Promise<void> => {
  if (!url) return;

  // Normalizar nombre de plataforma (case-insensitive → title-case canónico)
  const normalizePlatform = (p?: string | null): string | null => {
    if (!p) return null;
    const lower = p.toLowerCase();
    if (lower === 'youtube') return 'YouTube';
    // Capitalizar primera letra para el resto
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  const resolvedPlatform =
    normalizePlatform(platform) ||
    DOMAIN_TO_PLATFORM[extractDomain(url)] ||
    null;

  // Paso 1: Intentar manejar como Media Playback In-App (YouTube, etc)
  const isHandledByMediaService = await MediaPlaybackService.handleUrl(url, options);
  if (isHandledByMediaService) {
    return;
  }

  // Paso 2: esquema nativo custom (solo para plataformas confirmadas).
  if (resolvedPlatform) {
    const resolver = NATIVE_SCHEME_RESOLVERS[resolvedPlatform];
    if (resolver) {
      const nativeUrl = resolver(url);
      if (nativeUrl) {
        const opened = await tryNativeOpen(nativeUrl);
        if (opened) {
          console.log(`[Linking] Abierto con esquema nativo: ${nativeUrl}`);
          return;
        }
        console.log(`[Linking] Esquema nativo no disponible, usando URL web: ${url}`);
      }
    }
  }

  // Paso 3: Linking.openURL con la URL HTTPS original.
  // El SO intercepta Universal Links / App Links si la app está instalada.
  // Si no está instalada, el SO la abre en el navegador nativo del dispositivo.
  // Este es el comportamiento CORRECTO para Udemy, Coursera, Platzi, etc.
  try {
    await Linking.openURL(url);
    console.log(`[Linking] Abierto con Linking.openURL: ${url}`);
    return;
  } catch (err) {
    console.warn(`[Linking] Linking.openURL falló para: ${url}`, err);
  }

  // Paso 4: Fallback final con navegador in-app (solo si Linking.openURL falla)
  try {
    await WebBrowser.openBrowserAsync(url, {
      enableBarCollapsing: true,
      showTitle: true,
    });
    console.log(`[Linking] Abierto con WebBrowser (fallback): ${url}`);
  } catch (error) {
    console.error('[Linking] Fallback total fallido:', error);
  }
};

/**
 * Conveniencia: abre el link de un curso dado el objeto curso.
 * Prefiere deep_link_url sobre main_url.
 */
export const openCourseByLink = async (course: {
  deep_link_url?: string;
  main_url?: string;
  platform?: string;
  id?: string;
  course_id?: string;
}, options?: { onVideoEnd?: () => void }): Promise<void> => {
  const url = course.deep_link_url || course.main_url;
  if (url) {
    await openCourseLink(url, course.platform, {
      subjectId: course.id,
      courseId: course.course_id,
      onVideoEnd: options?.onVideoEnd
    });
  }
};
