import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { theme } from '../styles/theme';

interface AnimatedMarchingAntsBorderProps {
  children: React.ReactNode;
  width: number;
  height: number;
  borderRadius?: number;
  strokeColor?: string;
  strokeWidth?: number | string;
  always?: boolean;
}

// Crear componente Rect animado
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * AnimatedMarchingAntsBorder
 * Crea un borde animado tipo "marching ants" (líneas discontinuas en movimiento)
 * Similar al que aparece en el chat de Copilot en VS Code cuando construye una respuesta.
 * 
 * @param children - Contenido dentro del borde
 * @param width - Ancho del contenedor
 * @param height - Alto del contenedor
 * @param borderRadius - Radio de borde redondeado (default: 12)
 * @param strokeColor - Color del borde (default: color primario del tema)
 * @param strokeWidth - Grosor del borde (default: 1)
 * @param always - Si true, siempre muestra la animación; si false, depende de su use case (default: true)
 */
export const AnimatedMarchingAntsBorder: React.FC<AnimatedMarchingAntsBorderProps> = ({
  children,
  width,
  height,
  borderRadius = 12,
  strokeColor = theme.colors.primary,
  strokeWidth = 1,
  always = true,
}) => {
  const dashOffsetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!always) {
      dashOffsetAnim.setValue(0);
      return;
    }

    // Animar el dashOffset para crear efecto de marching ants
    // El patrón se mueve continuamente de forma suave
    Animated.loop(
      Animated.timing(dashOffsetAnim, {
        toValue: -12, // Longitud del patrón de guiones
        duration: 1200, // Duración más larga para movimiento suave
        useNativeDriver: false,
      })
    ).start();
  }, [always, dashOffsetAnim]);

  if (!always) {
    return <View style={{ width, height }}>{children}</View>;
  }

  return (
    <View style={{ width, height, position: 'relative' }}>
      {/* SVG overlay con borde animado tipo marching ants */}
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
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={width - strokeWidth}
          height={height - strokeWidth}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          rx={borderRadius}
          ry={borderRadius}
          strokeDasharray="4,4"
          strokeDashoffset={dashOffsetAnim as any}
          strokeLinecap="round"
        />
      </Svg>

      {/* Contenido */}
      {children}
    </View>
  );
};
