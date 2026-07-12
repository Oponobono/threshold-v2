import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importación diferida para no bloquear el hilo principal en el milisegundo 0
import '../src/locales/i18n';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { CustomAlertProvider } from '../src/components/ui/CustomAlert';
import { useAutoSync } from '../src/hooks/useAutoSync';
import { useCacheCleanup } from '../src/hooks/useCacheCleanup';
import { DatabaseProvider, useDatabaseReady } from '../src/context/DatabaseContext';

import { hasValidSession } from '../src/services/api/auth/session';
import { requestPermissions } from '../src/services/notificationService';
import { registerScheduledBackup } from '../src/services/backup/scheduledBackupService';
import { parseDeeplink, getTargetRoute } from '../src/services/reminders/NavigationContract';
import { getScheduledBackupConfig } from '../src/services/backup/backupService';
import { FloatingYouTubePlayer } from '../src/components/player/FloatingYouTubePlayer';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';

// [BOOT 00] — Module-level code: se ejecuta DURANTE la evaluación del bundle JS
// Si la app se queda en blanco sin llegar al splash, el problema está en módulo previo
console.log('[BOOT 00d] _layout.tsx module evaluating. All static imports resolved.');

// Mantener el Splash Screen visible hasta que decidamos ocultarlo
SplashScreen.preventAutoHideAsync().then(() => {
  console.log('[BOOT 00e] SplashScreen.preventAutoHideAsync succeeded');
}).catch((err: any) => {
  console.warn('[BOOT 00e!] SplashScreen.preventAutoHideAsync failed:', err?.message || err);
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
  console.log('[BOOT 01b] RootLayout mounted');
  return (
    <ErrorBoundary>
      <DatabaseProvider>
        <RootNavigator />
      </DatabaseProvider>
    </ErrorBoundary>
  );
}

/**
 * Componente interno que usa DatabaseProvider para garantizar BD inicializada
 */
function RootNavigator() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string>('welcome');
  const { isReady: isDatabaseReady, error: databaseError } = useDatabaseReady();

  useEffect(() => {
    console.log('[BOOT 01] RootNavigator mounted — React está renderizando');
  }, []);

  // Activar sincronización automática cuando recupere internet
  useAutoSync();

  // Limpieza automática de caché al iniciar y periódicamente
  useCacheCleanup();

  useEffect(() => {
    async function prepare() {
      try {
        // 🔷 0. Esperar a que BD local esté lista
        if (!isDatabaseReady) {
          console.log('[RootLayout] Esperando a que BD local esté lista...');
          return;
        }

        if (databaseError) {
          console.error('[RootLayout] ❌ Error inicializando BD local:', databaseError);
          // Intentar continuar de todas formas (puede usar API fallback)
        }

        // 🔷 1. Verificar si existe sesión válida al iniciar la app
        const hasSession = await hasValidSession();
        if (hasSession) {
          console.log('[RootLayout] ✅ Sesión válida encontrada, navegando a (tabs)');
          setInitialRoute('(tabs)');
        } else {
          console.log('[RootLayout] ❌ No hay sesión válida, navegando a welcome');
          setInitialRoute('welcome');
        }

        // 🔷 2. Solicitar permiso de notificaciones al iniciar (no bloquea)
        requestPermissions().then(granted => {
          console.log(`[RootLayout] 📱 Permiso de notificaciones: ${granted ? 'concedido' : 'denegado'}`);
        });

        // 🔷 3. Registrar backup automático si está habilitado
        // IMPORTANTE: Esto debe ocurrir DESPUÉS de que BD esté inicializada
        // ya que getScheduledBackupConfig() necesita acceso al almacenamiento seguro
        try {
          const cfg = await getScheduledBackupConfig();
          console.log(`[RootLayout] 🔄 Config de backup programado leída: enabled=${cfg.enabled}, hora=${cfg.hour}:${cfg.minute}, tipo=${cfg.type}`);
          if (cfg.enabled) {
            console.log('[RootLayout] ✅ Registrando backup programado...');
            await registerScheduledBackup();
            console.log('[RootLayout] ✅ Backup programado registrado correctamente');
          } else {
            console.log('[RootLayout] ⏭️ Backup programado desactivado, no registrando task');
          }
        } catch (err) {
          console.warn('[RootLayout] ⚠️ Error al registrar backup programado:', err);
        }
      } catch (e) {
        console.warn('[RootLayout] Error durante preparación:', e);
        setInitialRoute('welcome');
      } finally {
        setAppIsReady(true);
      }
    }

    // Solo ejecutar preparación si BD está lista
    if (isDatabaseReady) {
      prepare();
    }
  }, [isDatabaseReady, databaseError]);

  // ── Offline Queue: Sincronización automática delegada a useAutoSync() ───



  const router = useRouter();

  // ── Notification response listener ─────────────────────────────────────
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, any>;

      // 1. Intentar deeplink del ReminderEngine (threshold://...)
      const rawDeeplink = data?.deeplink as string | undefined;
      if (rawDeeplink) {
        const parsed = parseDeeplink(rawDeeplink);
        if (parsed) {
          const route = getTargetRoute(parsed.entityType);
          router.push({ pathname: route, params: { entityId: parsed.entityId, entityType: parsed.entityType } });
          return;
        }
      }

      // Fallback: legacy notification types (por migrar al Engine)
      const type = data?.type as string | undefined;
      if (type === 'deadline') {
        router.push('/calendar');
      } else if (type === 'class') {
        router.push('/');
      }
    });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, [router]);

  useEffect(() => {
    // Mostrar splash mientras BD se inicializa
    if (!isDatabaseReady || !appIsReady) {
      return;
    }

    console.log('[RootLayout] App está lista, ocultando splash screen');
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 100);
    return () => clearTimeout(timer);
  }, [isDatabaseReady, appIsReady]);

  // Mostrar error si BD falla
  if (isDatabaseReady === false || (isDatabaseReady && databaseError)) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              Error inicializando aplicación
            </Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 20 }}>
              {databaseError?.message || 'No se pudo inicializar la base de datos local'}
            </Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 10 }}>
              Por favor, reinicia la aplicación
            </Text>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // No renderizar nada hasta que BD esté lista
  if (!isDatabaseReady || !appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0E0E18' }}>
      <SafeAreaProvider>
        <CustomAlertProvider>
          <ThemeProvider value={colorScheme !== 'light' ? DarkTheme : DefaultTheme}>
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
              <Stack.Screen name="developer" options={{ headerShown: false }} />
            </Stack>
            <FloatingYouTubePlayer />
            <StatusBar style="auto" />
          </ThemeProvider>
        </CustomAlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
