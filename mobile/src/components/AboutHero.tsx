import React from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

interface AboutHeroProps {
  paddingTop: number;
  heroScale: Animated.AnimatedInterpolation<string | number>;
  heroOpacity: Animated.AnimatedInterpolation<string | number>;
}

/**
 * Componente superior (Hero) de la pantalla "Acerca de".
 * Contiene el isotipo animado con efecto parallax de MAPUVIA Labs.
 */
export const AboutHero: React.FC<AboutHeroProps> = ({ paddingTop, heroScale, heroOpacity }) => {
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={['#FFFFFF', '#FCFCFB', '#F9F9F7']}
      style={[styles.hero, { paddingTop }]}
    >
      <View style={styles.glowRing} />

      <Animated.View style={{ transform: [{ scale: heroScale }], opacity: heroOpacity, alignItems: 'center' }}>
        <Image
          source={require('../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
          style={styles.heroLogoLabs}
          resizeMode="contain"
        />
      </Animated.View>

      <Text style={styles.heroEyebrow}>{t('about.productOf', 'un producto de')}</Text>

      <LinearGradient
        colors={['transparent', '#F9F9F7']}
        style={styles.fadeBottom}
        pointerEvents="none"
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 80,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  glowRing: {
    position: 'absolute',
    top: 80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(197, 160, 89, 0.08)',
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 10,
  },
  heroLogoLabs: {
    width: 160,
    height: 32,
    opacity: 0.9,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
});
