import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextStyle,
  StyleProp,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withSequence,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  lineHeight?: number;
  pixelsPerSecond?: number;
}

export function AutoScrollText({
  text,
  style,
  lineHeight = 20,
  pixelsPerSecond = 50,
}: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const translateX = useSharedValue(0);

  const containerWidthRef = useRef(0);
  const textWidthRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  containerWidthRef.current = containerWidth;
  textWidthRef.current = textWidth;

  const isMeasured = containerWidth > 0 && textWidth > 0;
  const overflows = isMeasured && textWidth > containerWidth + 2;

  const typographyStyle: TextStyle = (() => {
    const flat = StyleSheet.flatten(style) ?? {};
    return {
      fontFamily: flat.fontFamily,
      fontSize: flat.fontSize,
      fontWeight: flat.fontWeight,
      fontStyle: flat.fontStyle,
      letterSpacing: flat.letterSpacing,
      textTransform: flat.textTransform,
    };
  })();

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const triggerScroll = useCallback(() => {
    const tw = textWidthRef.current;
    const cw = containerWidthRef.current;

    if (tw <= cw + 2) return;

    setIsAnimating(true);
    // Distancia exacta hasta el último caracter
    const dist = tw - cw;
    const scrollMs = (dist / pixelsPerSecond) * 1000;
    const pauseAtEnd = 1000;
    const returnMs = 600;

    cancelAnimation(translateX);
    translateX.value = 0;

    translateX.value = withSequence(
      withDelay(100, withTiming(-dist, { duration: scrollMs, easing: Easing.linear })),
      withDelay(pauseAtEnd, withTiming(0, { duration: returnMs, easing: Easing.out(Easing.quad) })),
    );

    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 100 + scrollMs + pauseAtEnd + returnMs + 50);
  }, [pixelsPerSecond, translateX]);

  useEffect(() => {
    clearTimer();
    cancelAnimation(translateX);
    translateX.value = 0;
    setIsAnimating(false);
    setTextWidth(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    return () => {
      clearTimer();
      cancelAnimation(translateX);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (!isAnimating && overflows) {
          triggerScroll();
        }
      }}
      delayPressIn={0}
      style={{ overflow: 'hidden', paddingVertical: 1, minHeight: lineHeight }}
      onLayout={(e: LayoutChangeEvent) =>
        setContainerWidth(e.nativeEvent.layout.width)
      }
    >
      {/* 
        Medición Infalible: 
        Al usar un ScrollView horizontal oculto, garantizamos que el Text 
        NUNCA sea estirado por flexbox ni recortado por anchos de pantalla. 
        Nos dará el ancho exacto del texto, caracter por caracter.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ position: 'absolute', opacity: 0 }}
        pointerEvents="none"
      >
        <Text
          style={[typographyStyle, { lineHeight }]}
          onLayout={(e: LayoutChangeEvent) =>
            setTextWidth(e.nativeEvent.layout.width)
          }
        >
          {text}
        </Text>
      </ScrollView>

      {isAnimating ? (
        <Animated.View style={[{ width: textWidth }, animatedStyle]}>
          <Text style={[style, { lineHeight }]}>{text}</Text>
        </Animated.View>
      ) : (
        <View pointerEvents="none">
          <Text
            style={[style, { lineHeight }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {text}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
