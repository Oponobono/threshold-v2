import React, { useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../src/styles/theme';
import { AboutHero, AboutThreshold, AboutFeatures, AboutDragonfly, AboutMapuvia } from '../src/components/about';

/**
 * Pantalla "Acerca de" (AboutScreen)
 *
 * Muestra la información corporativa, de marca y filosofía del producto (Threshold)
 * y la empresa creadora (MAPUVIA Labs). Implementa un efecto parallax suave
 * en el isotipo superior (Hero) que reacciona al scroll.
 */
export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Hero parallax: isotipo se aleja al hacer scroll
  const heroScale = scrollY.interpolate({ inputRange: [0, 200], outputRange: [1, 0.8], extrapolate: 'clamp' });
  const heroOpacity = scrollY.interpolate({ inputRange: [0, 180], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── BOTÓN CERRAR flotante ─────────────────────────────── */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
      </TouchableOpacity>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >

        <AboutHero paddingTop={insets.top + 72} heroScale={heroScale} heroOpacity={heroOpacity} />
        <AboutThreshold />
        <AboutDragonfly />
        <AboutMapuvia />
        <AboutFeatures />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── CLOSE BUTTON ──────────────────────────────────────────────
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

});
