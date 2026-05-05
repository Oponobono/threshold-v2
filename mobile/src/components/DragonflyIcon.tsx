import React from 'react';
import { Animated } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);

interface DragonflyIconProps {
  size?: number;
  color?: string;
  style?: any;
  wingOpacity?: Animated.Value | number;
}

/**
 * DragonflyIcon.tsx
 *
 * Componente que dibuja un ícono de libélula personalizado mediante SVG vectorial.
 * Creado específicamente como identidad gráfica o mascota (Dragonfly) para ciertas
 * partes de la interfaz, como la pantalla de carga (PremiumLoader) o interacciones de IA.
 * Incluye soporte para alas con opacidad animada mediante `AnimatedG`.
 *
 * @param size - Tamaño base (ancho) del ícono. La altura escala proporcionalmente.
 * @param color - Color del contorno (stroke) del SVG vectorial.
 * @param style - Estilos adicionales inyectados al contenedor.
 * @param wingOpacity - Valor (animable) para aplicar una transparencia o efecto de aleteo a las alas.
 */
export const DragonflyIcon: React.FC<DragonflyIconProps> = ({ 
  size = 42, 
  color = '#F5F5F0', 
  style,
  wingOpacity = 1
}) => {
  // viewBox: 100 wide, 120 tall (centrada en x=50)
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 100 120" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>

      {/* 1. Cabeza — óvalo pequeño */}
      <Path d="M 46 8 C 46 4, 54 4, 54 8 C 54 12, 46 12, 46 8 Z" />

      {/* 2. Tórax superior — dos lóbulos tipo corazón invertido */}
      <Path d="M 50 12 C 44 12, 41 16, 43 19 C 45 22, 49 21, 50 19 C 51 21, 55 22, 57 19 C 59 16, 56 12, 50 12 Z" />

      {/* 3. Cuerpo principal — rombo esbelto */}
      <Path d="M 50 19 L 44 32 L 50 44 L 56 32 Z" />

      {/* 4. Cola — triángulo muy largo y afilado */}
      <Path d="M 49.2 44 L 50 116 L 50.8 44 Z" />

      {/* === ALAS === */}
      <AnimatedG opacity={wingOpacity}>
        {/* === ALAS SUPERIORES === */}
        {/* Ala superior izquierda — amplia, con curva y vena */}
        <Path d="M 46 17 C 36 10, 14 6, 2 12 C 8 18, 28 24, 44 30 Z" />
        {/* Vena superior izquierda */}
        <Path d="M 45 22 C 32 17, 14 13, 4 16" />

        {/* Ala superior derecha */}
        <Path d="M 54 17 C 64 10, 86 6, 98 12 C 92 18, 72 24, 56 30 Z" />
        {/* Vena superior derecha */}
        <Path d="M 55 22 C 68 17, 86 13, 96 16" />

        {/* === ALAS INFERIORES === */}
        {/* Ala inferior izquierda — más corta y ancha */}
        <Path d="M 44 32 C 30 28, 10 32, 2 38 C 8 46, 28 44, 46 40 Z" />
        {/* Vena inferior izquierda */}
        <Path d="M 44 36 C 30 34, 12 36, 4 41" />

        {/* Ala inferior derecha */}
        <Path d="M 56 32 C 70 28, 90 32, 98 38 C 92 46, 72 44, 54 40 Z" />
        {/* Vena inferior derecha */}
        <Path d="M 56 36 C 70 34, 88 36, 96 41" />
      </AnimatedG>

    </Svg>
  );
};
