import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { detailStyles as styles } from '../../styles/RecordingDetailScreen.styles';

const WAVE_HEIGHTS = [12, 22, 32, 26, 40, 18, 36, 28, 44, 24, 34, 16, 38, 28, 20];

interface WaveformBarsProps {
  isPlaying: boolean;
}

/**
 * WaveformBars.tsx
 *
 * Simula de forma visual las ondas de sonido mientras un audio se reproduce.
 * Define un arreglo de alturas aleatorias y, si el prop `isPlaying` es true, 
 * anima las barras individualmente hacia arriba y abajo en un bucle infinito
 * para imitar los picos y valles de una señal de audio nativa.
 *
 * @param isPlaying - Si es `true`, las barras de onda se animan y aumentan su opacidad.
 */
export const WaveformBars: React.FC<WaveformBarsProps> = ({ isPlaying }) => {
  const anims = useRef(
    WAVE_HEIGHTS.map(() => new Animated.Value(0.3))
  ).current;
  const activeRef = useRef(false);

  useEffect(() => {
    if (!isPlaying) {
      activeRef.current = false;
      Animated.parallel(
        anims.map((anim) =>
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          })
        )
      ).start();
      return;
    }

    activeRef.current = true;

    // Usar Animated.loop para ejecutar todo nativamente sin bloquear el bridge de JS
    anims.forEach((anim, i) => {
      setTimeout(() => {
        if (!activeRef.current) return;
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1.0, // Altura máxima
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3, // Altura mínima
              duration: 250,
              useNativeDriver: true,
            })
          ])
        ).start();
      }, i * 50); // Desfase inicial para efecto visual
    });

    return () => {
      activeRef.current = false;
      anims.forEach(anim => anim.stopAnimation());
    };
  }, [isPlaying]);

  return (
    <View style={styles.waveformRow} pointerEvents="none">
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            { 
              height: WAVE_HEIGHTS[i], 
              opacity: isPlaying ? 0.65 : 0.2,
              transform: [
                { scaleY: anim },
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [WAVE_HEIGHTS[i] / 2, 0] }) }
              ]
            },
          ]}
        />
      ))}
    </View>
  );
};
