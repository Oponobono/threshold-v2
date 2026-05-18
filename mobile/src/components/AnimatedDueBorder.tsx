import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { theme } from '../styles/theme';

interface AnimatedDueBorderProps {
  children: React.ReactNode;
  isDue: boolean;
  borderRadius?: number;
  width: number;
  height: number;
}

// Crear componente Rect animado
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * AnimatedDueBorder
 * Crea un borde animado tipo "marching ants" alrededor de tarjetas
 * cuando tienen tarjetas vencidas (isDue = true)
 */
export const AnimatedDueBorder: React.FC<AnimatedDueBorderProps> = ({
  children,
  isDue,
  borderRadius = 12,
  width,
  height,
}) => {
  const dashOffsetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isDue) {
      dashOffsetAnim.setValue(0);
      return;
    }

    // Animar el dashOffset para crear efecto de marching ants
    Animated.loop(
      Animated.timing(dashOffsetAnim, {
        toValue: -12, // Longitud del patrón de guiones
        duration: 800,
        useNativeDriver: false,
      })
    ).start();
  }, [isDue, dashOffsetAnim]);

  if (!isDue) {
    return <View style={{ width, height }}>{children}</View>;
  }

  return (
    <View style={{ width, height, position: 'relative' }}>
      {/* SVG overlay con borde animado */}
      <Svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        <AnimatedRect
          x={0.5}
          y={0.5}
          width={width - 1}
          height={height - 1}
          fill="none"
          stroke={theme.colors.danger}
          strokeWidth="1"
          rx={borderRadius}
          ry={borderRadius}
          strokeDasharray="4,4"
          strokeDashoffset={dashOffsetAnim as any}
        />
      </Svg>

      {/* Contenido */}
      {children}
    </View>
  );
};
