import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importación diferida para no bloquear el hilo principal en el milisegundo 0
import '../src/locales/i18n';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { CustomAlertProvider } from '../src/components/CustomAlert';
import { useAutoSync } from '../src/hooks/useAutoSync';
import { ConnectivityBanner } from '../src/components/ConnectivityBanner';
import NetInfo from '@react-native-community/netinfo';
import { flushOfflineQueue } from '../src/services/offlineQueue';
import { hasValidSession } from '../src/services/api/auth/session';
import { initializeApiClient } from '../src/services/api/client';

// Mantener el Splash Screen visible hasta que decidamos ocultarlo
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error */
});

/**
 * Configuración de navegación de Expo Router. Define la ruta inicial como 'welcome'.
 * Si hay sesión válida, será sobrescrita por hasSessionOnMount.
 */
export let unstable_settings = {
  initialRouteName: 'welcome',
};

/**
 * Componente principal de enrutamiento y layout (RootLayout).
 * Se encarga de inicializar los proveedores de estado globales (Theme, SafeArea, CustomAlerts),
 * configurar la navegación en Stack y gestionar el ciclo de vida del Splash Screen
 * durante la carga inicial de recursos.
 *
 * NOTA: El back handler (doble atrás para salir) vive en app/(tabs)/_layout.tsx
 * para no interferir con la navegación dentro de los tabs.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string>('welcome');

  // Activar sincronización automática cuando recupere internet
  useAutoSync();

  useEffect(() => {
    async function prepare() {
      try {
        // 🔷 1. Inicializar cliente API con detección de backend (local vs Render)
        console.log('[RootLayout] 🔄 Inicializando cliente API...');
        await initializeApiClient();
        console.log('[RootLayout] ✅ Cliente API inicializado');
        
        // 🔷 2. Verificar si existe sesión válida al iniciar la app
        const hasSession = await hasValidSession();
        if (hasSession) {
          console.log('[RootLayout] ✅ Sesión válida encontrada, navegando a (tabs)');
          setInitialRoute('(tabs)');
        } else {
          console.log('[RootLayout] ❌ No hay sesión válida, navegando a welcome');
          setInitialRoute('welcome');
        }
      } catch (e) {
        console.warn('[RootLayout] Error durante preparación:', e);
        setInitialRoute('welcome');
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
            <Stack initialRouteName={initialRoute}>
              <Stack.Screen 
                name="welcome" 
                options={{ 
                  headerShown: false, 
                  animation: 'fade',
                  gestureEnabled: false,
                }} 
              />
              <Stack.Screen 
                name="login" 
                options={{ 
                  headerShown: false, 
                  animation: 'fade',
                  gestureEnabled: false,
                }} 
              />
              <Stack.Screen 
                name="register" 
                options={{ 
                  headerShown: false,
                  gestureEnabled: false,
                }} 
              />
              {/* (tabs) es la pantalla principal - prevenir retroceso */}
              <Stack.Screen 
                name="(tabs)" 
                options={{ 
                  headerShown: false,
                  gestureEnabled: false,
                  animation: 'none',
                }} 
              />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="about" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
            {/* Banner persistente de conectividad */}
            <ConnectivityBanner />
          </ThemeProvider>
        </CustomAlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
