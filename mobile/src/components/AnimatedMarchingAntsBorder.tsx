import React, { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { theme } from '../styles/theme';

interface AnimatedMarchingAntsBorderProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
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
 * @param width - Ancho opcional del contenedor (si se omite, se calcula dinámicamente)
 * @param height - Alto opcional del contenedor (si se omite, se calcula dinámicamente)
 * @param borderRadius - Radio de borde redondeado (default: 12)
 * @param strokeColor - Color del borde (default: color primario del tema)
 * @param strokeWidth - Grosor del borde (default: 1)
 * @param always - Si true, siempre muestra la animación; si false, depende de su use case (default: true)
 */
export const AnimatedMarchingAntsBorder: React.FC<AnimatedMarchingAntsBorderProps> = ({
  children,
  width: propWidth,
  height: propHeight,
  borderRadius = 12,
  strokeColor = theme.colors.primary,
  strokeWidth = 1,
  always = true,
}) => {
  const dashOffsetAnim = useRef(new Animated.Value(0)).current;
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });

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

  // Si se pasan por props dimensiones válidas y mayores que 0, las usamos.
  // De lo contrario, usamos las dimensiones obtenidas dinámicamente mediante onLayout.
  const finalWidth = (propWidth && propWidth > 0) ? propWidth : layoutSize.width;
  const finalHeight = (propHeight && propHeight > 0) ? propHeight : layoutSize.height;

  const parsedStrokeWidth = typeof strokeWidth === 'number' ? strokeWidth : parseFloat(strokeWidth) || 1;

  return (
    <View
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        // Evitamos bucles infinitos validando diferencias
        if (Math.abs(layoutSize.width - w) > 0.1 || Math.abs(layoutSize.height - h) > 0.1) {
          setLayoutSize({ width: w, height: h });
        }
      }}
      style={{ position: 'relative' }}
    >
      {always && finalWidth > 0 && finalHeight > 0 && (
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
            x={parsedStrokeWidth / 2}
            y={parsedStrokeWidth / 2}
            width={finalWidth - parsedStrokeWidth}
            height={finalHeight - parsedStrokeWidth}
            fill="none"
            stroke={strokeColor}
            strokeWidth={parsedStrokeWidth}
            rx={borderRadius}
            ry={borderRadius}
            strokeDasharray="4,4"
            strokeDashoffset={dashOffsetAnim as any}
            strokeLinecap="round"
          />
        </Svg>
      )}

      {/* Contenido */}
      {children}
    </View>
  );
};
