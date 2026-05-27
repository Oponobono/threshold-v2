import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { theme } from '../../styles/theme';
import { DragonflyIcon } from './DragonflyIcon';
import { styles } from '../../styles/PremiumLoader.styles';

interface PremiumLoaderProps {
  visible: boolean;
  text?: string;
}

/**
 * PremiumLoader.tsx
 *
 * Overlay de carga inline (no de pantalla completa) que se monta sobre el contenido
 * cuando se ejecutan operaciones intensivas como la generación de flashcards con IA.
 * A diferencia de `PremiumLoading`, este componente es controlado por un prop `visible`
 * y soporta transiciones de fade in/out al montarse y desmontarse.
 * Muestra el icón `DragonflyIcon` con un anillo de pulso expansivo y una barra
 * de progreso indeterminada animada en bucle.
 *
 * @param visible - Controla si el loader está visible (con animación de entrada/salida).
 * @param text - Texto descriptivo mostrado bajo el ícono (por defecto 'CARGANDO...').
 */
export const PremiumLoader: React.FC<PremiumLoaderProps> = ({ visible, text = 'CARGANDO...' }) => {
  const [isRendered, setIsRendered] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  // Manejar el montaje/desmontaje con fade
  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600, // Transición más suave al salir
        useNativeDriver: true,
      }).start(() => {
        setIsRendered(false);
      });
    }
  }, [visible]);

  // Animaciones continuas
  useEffect(() => {
    if (visible) {
      // Pulso del anillo
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseScale, {
              toValue: 1.5,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseScale, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            })
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.5,
              duration: 0,
              useNativeDriver: true,
            })
          ])
        ])
      ).start();

      // Barra de progreso infinita
      Animated.loop(
        Animated.sequence([
          Animated.timing(barWidth, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(barWidth, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          })
        ])
      ).start();
    } else {
      pulseScale.stopAnimation();
      pulseOpacity.stopAnimation();
      barWidth.stopAnimation();
    }
  }, [visible]);

  if (!isRendered) return null;

  const interpolatedBarWidth = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.pulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
          <View style={styles.circle}>
            <DragonflyIcon size={38} color={theme.colors.primary} />
          </View>
        </View>
        
        <Text style={styles.text}>{text}</Text>
        
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { left: interpolatedBarWidth, width: '40%' }]} />
        </View>
      </View>
    </Animated.View>
  );
};


