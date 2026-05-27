import React from 'react';
import { View, Text, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { aboutHeroStyles as styles } from '../../styles/AboutHero.styles';

interface AboutHeroProps {
  paddingTop: number;
  heroScale: Animated.AnimatedInterpolation<string | number>;
  heroOpacity: Animated.AnimatedInterpolation<string | number>;
}

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
          source={require('../../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
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
