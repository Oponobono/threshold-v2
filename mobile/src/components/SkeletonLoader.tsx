import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../styles/theme';

/**
 * SkeletonLoader - Componente base para animaciones de carga estilo "skeleton"
 * con efecto shimmer suave. Perfecto para placeholders mientras se cargan datos.
 */

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  shimmer?: boolean;
}

const SHIMMER_START = -1;
const SHIMMER_END = 2;
const SHIMMER_DURATION = 1500;

/**
 * Componente base Skeleton
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  shimmer = true,
}) => {
  const shimmerAnim = useRef(new Animated.Value(SHIMMER_START)).current;

  useEffect(() => {
    if (!shimmer) return;

    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: SHIMMER_END,
        duration: SHIMMER_DURATION,
        useNativeDriver: false,
      })
    ).start();
  }, [shimmer, shimmerAnim]);

  const shimmerInterpolate = shimmerAnim.interpolate({
    inputRange: [SHIMMER_START, 0, SHIMMER_END],
    outputRange: [
      'rgba(255, 255, 255, 0)',
      'rgba(255, 255, 255, 0.3)',
      'rgba(255, 255, 255, 0)',
    ],
  });

  return (
    <Animated.View
      style={[
        s.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surface,
          shadowColor: shimmer ? shimmerInterpolate : 'transparent',
        },
        style,
      ]}
    />
  );
};

/**
 * SkeletonText - Línea de texto esqueleto
 */
export const SkeletonText: React.FC<{ width?: string | number; lines?: number }> = ({
  width = '100%',
  lines = 1,
}) => {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '70%' : width}
          height={14}
          borderRadius={4}
        />
      ))}
    </View>
  );
};

/**
 * SkeletonCard - Tarjeta esqueleto con título, descripción e ícono
 */
export const SkeletonCard: React.FC<{ variant?: 'small' | 'large' }> = ({
  variant = 'large',
}) => {
  const cardHeight = variant === 'small' ? 100 : 150;
  const padding = variant === 'small' ? 12 : 16;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding,
        gap: 12,
        height: cardHeight,
        justifyContent: 'space-between',
      }}
    >
      {/* Ícono */}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <Skeleton width="60%" height={16} borderRadius={4} />
      </View>

      {/* Descripción */}
      <SkeletonText lines={variant === 'small' ? 1 : 2} width="90%" />

      {/* Barra de progreso */}
      <Skeleton width="100%" height={4} borderRadius={2} />
    </View>
  );
};

/**
 * SkeletonAvatar - Avatar esqueleto circular
 */
export const SkeletonAvatar: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <Skeleton width={size} height={size} borderRadius={size / 2} />
);

/**
 * SkeletonListItem - Elemento de lista esqueleto
 */
export const SkeletonListItem: React.FC = () => (
  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 }}>
    <SkeletonAvatar size={40} />
    <View style={{ flex: 1 }}>
      <Skeleton width="80%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={12} borderRadius={4} />
    </View>
  </View>
);

/**
 * SkeletonGrid - Grid de 2 columnas para galerías
 */
export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={{ width: '48%' }}>
        <Skeleton width="100%" height={150} borderRadius={12} />
      </View>
    ))}
  </View>
);

const s = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.colors.surface,
  },
});
