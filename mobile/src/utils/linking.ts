import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const PLATFORM_DEEP_LINK: Record<string, (url: string) => string | null> = {
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

export const resolveDeepLink = (webUrl: string, platform?: string): string => {
  if (!webUrl || !platform) return webUrl;
  const resolver = PLATFORM_DEEP_LINK[platform];
  if (!resolver) return webUrl;
  return resolver(webUrl) || webUrl;
};

export const openCourseLink = async (url: string, platform?: string): Promise<void> => {
  if (!url) return;

  const targetUrl = resolveDeepLink(url, platform);

  try {
    const supported = await Linking.canOpenURL(targetUrl);
    if (supported) {
      await Linking.openURL(targetUrl);
    } else {
      console.log(`[Linking] No se puede abrir por intent nativo, usando WebBrowser fallback: ${targetUrl}`);
      await WebBrowser.openBrowserAsync(targetUrl, {
        enableBarCollapsing: true,
        showTitle: true,
      });
    }
  } catch (error) {
    console.error(`[Linking] Error al intentar abrir la URL ${targetUrl}:`, error);
    try {
      await WebBrowser.openBrowserAsync(targetUrl);
    } catch (fallbackError) {
      console.error('[Linking] Fallback total fallido:', fallbackError);
    }
  }
};

export const openCourseByLink = async (course: { deep_link_url?: string; main_url?: string; platform?: string }): Promise<void> => {
  const url = course.deep_link_url || course.main_url;
  if (url) {
    await openCourseLink(url, course.platform);
  }
};
