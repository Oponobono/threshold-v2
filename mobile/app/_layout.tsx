import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, router } from 'expo-router';
import { storageService } from '../src/services/storageService';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importación diferida para no bloquear el hilo principal en el milisegundo 0
import '../src/locales/i18n';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { CustomAlertProvider } from '../src/components/CustomAlert';
import NetInfo from '@react-native-community/netinfo';
import { flushOfflineQueue } from '../src/services/offlineQueue';

// Mantener el Splash Screen visible hasta que decidamos ocultarlo
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error */
});

/**
 * Configuración de navegación de Expo Router. Define la ruta inicial como 'welcome'.
 */
export const unstable_settings = {
  initialRouteName: 'welcome',
};

/**
 * Componente principal de enrutamiento y layout (RootLayout).
 * Se encarga de inicializar los proveedores de estado globales (Theme, SafeArea, CustomAlerts),
 * configurar la navegación en Stack y gestionar el ciclo de vida del Splash Screen
 * durante la carga inicial de recursos.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('[RootLayout] Starting preparation...');
        
        // 🚀 Capa 5: Lectura síncrona/rápida de sesión
        // Antes de que el Splash Screen desaparezca, validamos si hay token.
        // Si lo hay, saltamos el WelcomeScreen directo al Dashboard (0ms percibido)
        const token = await storageService.getSecure('auth_token');
        if (token) {
          router.replace('/(tabs)');
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // ── Offline Queue: flush card_logs when connectivity is restored ─────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        flushOfflineQueue()
          .then(({ sent, remaining }) => {
            if (sent > 0) {
              console.log(`[RootLayout] 🔁 Offline queue flushed: ${sent} log(s) synced, ${remaining} remaining.`);
            }
          })
          .catch(e => console.warn('[RootLayout] Flush error:', e));
      }
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (appIsReady) {
      console.log('[RootLayout] App is ready, hiding splash screen');
      // Ocultamos el splash screen inmediatamente después de que el primer render sea posible
      // Usamos un pequeño delay para asegurar que el motor JSI de la Nueva Arquitectura esté estable
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CustomAlertProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack initialRouteName="welcome">
              <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="register" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="about" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </CustomAlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
