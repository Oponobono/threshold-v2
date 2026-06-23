import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export const openCourseLink = async (url: string): Promise<void> => {
  if (!url) return;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.log(`[Linking] No se puede abrir por intent nativo, usando WebBrowser fallback: ${url}`);
      await WebBrowser.openBrowserAsync(url, {
        enableBarCollapsing: true,
        showTitle: true,
      });
    }
  } catch (error) {
    console.error(`[Linking] Error al intentar abrir la URL ${url}:`, error);
    // Ultimate fallback si ambos fallan
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (fallbackError) {
      console.error('[Linking] Fallback total fallido:', fallbackError);
    }
  }
};
