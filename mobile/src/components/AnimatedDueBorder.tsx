import React, { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { theme } from '../styles/theme';

interface AnimatedDueBorderProps {
  children: React.ReactNode;
  isDue: boolean;
  borderRadius?: number;
  width?: number;
  height?: number;
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
  width: propWidth,
  height: propHeight,
}) => {
  const dashOffsetAnim = useRef(new Animated.Value(0)).current;
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });

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

  // Si se pasan por props dimensiones válidas y mayores que 0, las usamos.
  // De lo contrario, usamos las dimensiones obtenidas dinámicamente mediante onLayout.
  const finalWidth = (propWidth && propWidth > 0) ? propWidth : layoutSize.width;
  const finalHeight = (propHeight && propHeight > 0) ? propHeight : layoutSize.height;

  return (
    <View
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (Math.abs(layoutSize.width - w) > 0.1 || Math.abs(layoutSize.height - h) > 0.1) {
          setLayoutSize({ width: w, height: h });
        }
      }}
      style={{ position: 'relative' }}
    >
      {isDue && finalWidth > 0 && finalHeight > 0 && (
        <Svg
          width={finalWidth}
          height={finalHeight}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <AnimatedRect
            x={0.5}
            y={0.5}
            width={finalWidth - 1}
            height={finalHeight - 1}
            fill="none"
            stroke={theme.colors.danger}
            strokeWidth="1"
            rx={borderRadius}
            ry={borderRadius}
            strokeDasharray="4,4"
            strokeDashoffset={dashOffsetAnim as any}
          />
        </Svg>
      )}

      {/* Contenido */}
      {children}
    </View>
  );
};
