/**
 * ConnectivityBanner.tsx
 *
 * Banner persistente que muestra el estado de conectividad y sincronización.
 * Se coloca en la parte superior de la app sin obstruir otros elementos.
 *
 * Estados:
 * - offline: Rojo, ícono de desconexión
 * - syncing: Azul, ícono de loading
 * - success: Verde, ícono de checkmark
 * - online: Oculto (no se muestra)
 */

import React, { useEffect } from 'react';
import { Animated, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useConnectivityStore } from '../store/useConnectivityStore';

export const ConnectivityBanner: React.FC = () => {
  const { state, syncMessage, pendingCount } = useConnectivityStore();
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Mostrar o esconder el banner según el estado
    const shouldShow = state !== 'online';

    if (shouldShow) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [state, slideAnim, opacityAnim]);

  const getBannerStyle = () => {
    switch (state) {
      case 'offline':
        return {
          backgroundColor: 'rgba(244,67,54,0.10)',
          borderColor: 'rgba(244,67,54,0.25)',
          textColor: '#C62828',
          iconColor: '#F44336',
        };
      case 'syncing':
        return {
          backgroundColor: 'rgba(33,150,243,0.10)',
          borderColor: 'rgba(33,150,243,0.25)',
          textColor: '#1565C0',
          iconColor: '#2196F3',
        };
      case 'success':
        return {
          backgroundColor: 'rgba(76,175,80,0.10)',
          borderColor: 'rgba(76,175,80,0.25)',
          textColor: '#2E7D32',
          iconColor: '#4CAF50',
        };
      default:
        return {
          backgroundColor: 'rgba(255,149,0,0.10)',
          borderColor: 'rgba(255,149,0,0.25)',
          textColor: '#E65100',
          iconColor: '#FF9500',
        };
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'offline':
        return <Ionicons name="wifi-outline" size={14} color={getBannerStyle().iconColor} />;
      case 'syncing':
        return (
          <Animated.View
            style={{
              transform: [
                {
                  rotate: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            }}
          >
            <Ionicons name="sync" size={14} color={getBannerStyle().iconColor} />
          </Animated.View>
        );
      case 'success':
        return <Ionicons name="checkmark-circle" size={14} color={getBannerStyle().iconColor} />;
      default:
        return <Ionicons name="sync" size={14} color={getBannerStyle().iconColor} />;
    }
  };

  const getMessage = () => {
    switch (state) {
      case 'offline':
        return `Sin conexión${pendingCount > 0 ? ` (${pendingCount} pendiente${pendingCount > 1 ? 's' : ''})` : ''}`;
      case 'syncing':
        return syncMessage || 'Sincronizando...';
      case 'success':
        return syncMessage || '✓ Sincronización completada';
      default:
        return '';
    }
  };

  const bannerStyle = getBannerStyle();

  return (
    <Animated.View
      style={[
        s.container,
        {
          opacity: opacityAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-80, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          s.banner,
          {
            backgroundColor: bannerStyle.backgroundColor,
            borderColor: bannerStyle.borderColor,
          },
        ]}
      >
        <View style={s.iconContainer}>{getIcon()}</View>
        <Text style={[s.message, { color: bannerStyle.textColor }]}>
          {getMessage()}
        </Text>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
