import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, Easing, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { welcomeStyles as styles } from '../src/styles/Welcome.styles';

/**
 * Pantalla de bienvenida (WelcomeScreen).
 * Renderiza la animación inicial de presentación de la app (logo, título y eslogan)
 * usando Animated de React Native. Después de un temporizador de ~2.8s, redirige
 * automáticamente al usuario hacia la pantalla de `/login`.
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

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeTitle, { toValue: 0, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeSlogan, { toValue: 0, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      ]).start(() => {
        router.replace('/login');
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
