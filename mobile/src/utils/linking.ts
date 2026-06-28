import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const KNOWN_DEEP_LINKS: Record<string, (url: string) => string | null> = {
  YouTube: (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (match) return `youtube://watch?v=${match[1]}`;
    return null;
  },
  Udemy: (url) => {
    const match = url.match(/udemy\.com\/course\/([^/?]+)/);
    if (match) return `udemy://course/${match[1]}`;
    return null;
  },
  Platzi: (url) => {
    const match = url.match(/platzi\.com\/(?:cursos|clases)\/([^/?]+)/);
    if (match) return `platzi://clases/${match[1]}/`;
    return null;
  },
  Coursera: (url) => {
    const match = url.match(/coursera\.org\/learn\/([^/?]+)/);
    if (match) return `coursera://course/${match[1]}`;
    return null;
  },
};

const tryOpenUrl = async (url: string): Promise<boolean> => {
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return true;
    }
  } catch {}
  return false;
};

export const openCourseLink = async (url: string, platform?: string): Promise<void> => {
  if (!url) return;

  // 1. Intentar deep link específico por plataforma (YouTube, Udemy, Platzi, Coursera…)
  if (platform) {
    const resolver = KNOWN_DEEP_LINKS[platform];
    const customUrl = resolver?.(url);
    if (customUrl && await tryOpenUrl(customUrl)) return;
  }

  // 2. Intentar deep link genérico derivado del nombre de la plataforma
  //    Ej: "Skillshare" → skillshare://dominio/ruta
  if (platform) {
    const scheme = platform.toLowerCase().replace(/[^a-z0-9]/g, '');
    const genericUrl = url.replace(/^https?:\/\//, `${scheme}://`);
    if (genericUrl !== url && await tryOpenUrl(genericUrl)) return;
  }

  // 3. Intentar abrir la URL web directamente (funciona con apps que registran
  //    Universal Links / App Links, ej: YouTube, LinkedIn, Instagram…)
  if (await tryOpenUrl(url)) return;

  // 4. Fallback final: navegador integrado
  try {
    await WebBrowser.openBrowserAsync(url, {
      enableBarCollapsing: true,
      showTitle: true,
    });
  } catch (error) {
    console.error('[Linking] Fallback total fallido:', error);
  }
};

export const openCourseByLink = async (course: { deep_link_url?: string; main_url?: string; platform?: string }): Promise<void> => {
  const url = course.deep_link_url || course.main_url;
  if (url) {
    await openCourseLink(url, course.platform);
  }
};
