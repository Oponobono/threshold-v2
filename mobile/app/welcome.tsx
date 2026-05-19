import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, Easing, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getItemAsync } from 'expo-secure-store';
import { welcomeStyles as styles } from '../src/styles/Welcome.styles';

/**
 * Pantalla de bienvenida (WelcomeScreen).
 * Renderiza la animación inicial de presentación de la app (logo, título y eslogan).
 *
 * Persistencia de sesión:
 * - Si el usuario ya tiene un JWT guardado de una sesión anterior, se redirige
 *   directamente a /(tabs) sin pasar por login.
 * - Si no hay token, se redirige a /login como de costumbre.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  const fadeTitle = useRef(new Animated.Value(0)).current;
  const fadeSlogan = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.timing(fadeTitle, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(fadeSlogan, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    ]).start();

    // Verificar sesión en paralelo con la animación.
    // La resolución ocurre al finalizar el fade-out (~2.8s), tiempo más que suficiente.
    const sessionCheckPromise = Promise.all([
      getItemAsync('jwt_token'),
      getItemAsync('app_user_id'),
    ]);

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeTitle, { toValue: 0, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeSlogan, { toValue: 0, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      ]).start(async () => {
        try {
          const [token, userId] = await sessionCheckPromise;
          if (token && userId) {
            // Sesión activa: pequeño delay para que expo-router inicialice
            // su keep-awake interno antes de la navegación (evita race condition en dev)
            await new Promise(resolve => setTimeout(resolve, 80));
            console.log('[WelcomeScreen] Sesión activa detectada, saltando login.');
            router.replace('/(tabs)');
          } else {
            router.replace('/login');
          }
        } catch {
          // En caso de error al leer SecureStore, ir a login de forma segura
          router.replace('/login');
        }
      });
    }, 2800);

    return () => clearTimeout(timer);
  }, [fadeTitle, fadeSlogan, translateY, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Contenedor del Logo Inline y Título Principal */}
        <Animated.View style={[styles.logoContainer, { opacity: fadeTitle }]}>
          <View style={styles.titleRow}>
            <Image 
              source={require('../src/images/logo_threshold.png')} 
              style={[styles.logoIcon, { width: 78, height: 78 }]}
              resizeMode="contain"
            />
            <Text style={styles.appName}>hreshold</Text>
          </View>
        </Animated.View>

        {/* Eslogan independiente con animación de elevación */}
        <Animated.View style={{ opacity: fadeSlogan, transform: [{ translateY }] }}>
          <Text style={styles.phraseText}>BEYOND THE LIMIT</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
