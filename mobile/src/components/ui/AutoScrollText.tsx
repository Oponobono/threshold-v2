import React, { useEffect, useState } from 'react';
import { View, Text, LayoutChangeEvent, TextStyle, StyleProp } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing, 
  withSequence, 
  withDelay,
  cancelAnimation
} from 'react-native-reanimated';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  lineHeight?: number;
  numberOfVisibleLines?: number;
}

/**
 * AutoScrollText
 * Mantiene una altura fija basada en el número de líneas visibles.
 * Si el texto ocupa menos espacio, se renderiza normalmente.
 * Si el texto ocupa MÁS espacio (ej. 3+ líneas), se activa un scroll vertical automático (efecto Marquee vertical)
 * garantizando que nunca se rompa la armonía visual de las columnas en el Dashboard.
 */
export function AutoScrollText({ 
  text, 
  style, 
  lineHeight = 20, 
  numberOfVisibleLines = 2 
}: Props) {
  const [contentHeight, setContentHeight] = useState(0);
  const containerHeight = lineHeight * numberOfVisibleLines;
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Si el contenido real es más alto que nuestro contenedor fijo (ej. > 40px)
    if (contentHeight > containerHeight + 2) { // +2 de margen de error por redondeos
      const scrollDistance = contentHeight - containerHeight;
      const duration = scrollDistance * 60; // 60ms por pixel para un scroll suave
      
      translateY.value = withRepeat(
        withSequence(
          withDelay(1500, withTiming(-scrollDistance, { duration, easing: Easing.linear })),
          withDelay(1500, withTiming(0, { duration: 0 }))
        ),
        -1, // infinito
        false
      );
    } else {
      cancelAnimation(translateY);
      translateY.value = 0;
    }

    return () => {
      cancelAnimation(translateY);
    };
  }, [contentHeight, containerHeight, translateY, text]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height: containerHeight, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.View style={animatedStyle}>
        <Text 
          style={[style, { lineHeight }]} 
          onLayout={(e: LayoutChangeEvent) => setContentHeight(e.nativeEvent.layout.height)}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}
