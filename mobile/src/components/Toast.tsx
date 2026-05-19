import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Animated, Text, StyleSheet, Easing } from 'react-native';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ToastMethods {
  show: (message: string, durationMs?: number) => void;
}

// ─── Ref global (API imperativa) ──────────────────────────────────────────────
export const toastRef = React.createRef<ToastMethods>();

// ─── Componente ───────────────────────────────────────────────────────────────
export const Toast = forwardRef<ToastMethods>((_, ref) => {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const opacity  = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    show(msg: string, durationMs = 2000) {
      // Cancelar cualquier ocultamiento previo
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      setMessage(msg);
      setVisible(true);

      // Resetear posición antes de animar
      opacity.setValue(0);
      translateY.setValue(16);

      // Slide-up + fade in
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-ocultar
      hideTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 8,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => setVisible(false));
      }, durationMs);
    },
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
});

Toast.displayName = 'Toast';

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // Se posiciona justo encima de la tab bar (~80px) + margen
    bottom: 96,
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.88)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    maxWidth: '80%',
    // Z-order: encima de la tab bar y cualquier otro contenido
    zIndex: 9999,
    elevation: 20,
    // Sombra sutil
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});
