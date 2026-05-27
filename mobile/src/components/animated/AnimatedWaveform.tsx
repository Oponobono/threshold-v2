import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing } from 'react-native';

const BARS = [0.3, 0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.8, 0.6, 0.3, 0.5, 0.9, 0.7, 0.4];

/**
 * AnimatedWaveform.tsx
 *
 * Renderiza una representación visual animada de una forma de onda (waveform) de audio.
 * Genera múltiples barras verticales que oscilan en altura de manera asíncrona
 * (utilizando `Animated.loop` y variaciones aleatorias controladas matemáticamente)
 * para simular la reproducción de sonido en vivo de forma realista y fluida.
 *
 * @param color - Color de las barras de la onda (hex, rgb, etc.).
 * @param height - Altura máxima que puede alcanzar la barra más alta en píxeles.
 */
export function AnimatedWaveform({ color = '#fff', height = 36 }: { color?: string; height?: number }) {
  const anims = useRef(BARS.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 60),
          Animated.timing(anim, {
            toValue: 0.9 + Math.random() * 0.1,
            duration: 400 + i * 30,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.2,
            duration: 400 + i * 30,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: color,
            height: height * BARS[i],
            transform: [{ scaleY: anim }],
          }}
        />
      ))}
    </View>
  );
}
