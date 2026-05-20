import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert, BackHandler } from 'react-native';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importación diferida para no bloquear el hilo principal en el milisegundo 0
import '../src/locales/i18n';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { CustomAlertProvider } from '../src/components/CustomAlert';
import NetInfo from '@react-native-community/netinfo';
import { flushOfflineQueue } from '../src/services/offlineQueue';
import { hasValidSession } from '../src/services/api/auth/session';

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
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string>('welcome');
  const router = useRouter();
  const pathname = usePathname();
  const backPressedOnce = useRef(false);
  const backPressTimer = useRef<NodeJS.Timeout>();

  // ── Handle Android Back Button ─────────────────────────────────────────────
  useEffect(() => {
    const backAction = () => {
      // Check if we're on the dashboard (home/index)
      const isDashboard = pathname === '/(tabs)' || pathname === '/(tabs)/index' || pathname === '/(tabs)/';
      
      if (isDashboard) {
        // On dashboard: require double tap to exit
        if (backPressedOnce.current) {
          // Second press within 2 seconds: exit app
          BackHandler.exitApp();
          return true;
        }

        // First press: set flag and show alert
        backPressedOnce.current = true;
        Alert.alert(
          '¡Espera!',
          'Presiona atrás nuevamente para salir de la app',
          [
            {
              text: 'Cancelar',
              onPress: () => {
                backPressedOnce.current = false;
              },
              style: 'cancel',
            },
          ],
          { cancelable: false }
        );

        // Reset flag after 2 seconds if not pressed again
        if (backPressTimer.current) {
          clearTimeout(backPressTimer.current);
        }
        backPressTimer.current = setTimeout(() => {
          backPressedOnce.current = false;
        }, 2000);

        return true;
      } else {
        // On other screens: normal back navigation
        router.back();
        return true;
      }
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      subscription.remove();
      if (backPressTimer.current) {
        clearTimeout(backPressTimer.current);
      }
    };
  }, [pathname, router]);

  useEffect(() => {
    async function prepare() {
      try {
        // Verificar si existe sesión válida al iniciar la app
        const hasSession = await hasValidSession();
        if (hasSession) {
          console.log('[RootLayout] ✅ Sesión válida encontrada, navegando a (tabs)');
          setInitialRoute('(tabs)');
        } else {
          console.log('[RootLayout] ❌ No hay sesión válida, navegando a welcome');
          setInitialRoute('welcome');
        }
      } catch (e) {
        console.warn('[RootLayout] Error verificando sesión:', e);
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
                  animationEnabled: false,
                }} 
              />
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
