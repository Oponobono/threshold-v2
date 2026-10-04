import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Text,
  TextStyle,
  StyleProp,
  Pressable,
  ScrollView,
  AccessibilityInfo,
  View,
} from 'react-native';
import { useAutoScroller } from '../../hooks/useAutoScroller';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  lineHeight?: number;
  pixelsPerSecond?: number;
  pauseAtEnd?: number;
  returnDuration?: number;
  maxLoops?: number;
  autoplay?: boolean;
  pointerEvents?: 'auto' | 'none';
  direction?: 'horizontal' | 'vertical';
  numberOfLines?: number;
}

export function AutoScrollText({
  text,
  style,
  lineHeight = 20,
  pixelsPerSecond = 30, // Más lento para vertical
  pauseAtEnd = 1500,
  returnDuration = 800,
  maxLoops = 0,
  autoplay = false,
  pointerEvents = 'auto',
  direction = 'horizontal',
  numberOfLines,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [containerSize, setContainerSize] = useState(0);
  const [contentSize, setContentSize] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const isHorizontal = direction === 'horizontal';
  const overflows = containerSize > 0 && contentSize > containerSize;
  const dist = contentSize - containerSize;

  const scrollTo = useCallback(
    (val: number) => {
      if (isHorizontal) {
        scrollRef.current?.scrollTo({ x: val, animated: false });
      } else {
        scrollRef.current?.scrollTo({ y: val, animated: false });
      }
    },
    [isHorizontal]
  );

  const { trigger, cancel } = useAutoScroller(overflows && !reduceMotion, scrollTo, {
    pixelsPerSecond,
    pauseAtEnd,
    returnDuration,
    maxLoops,
  });

  const handlePress = useCallback(() => {
    if (!reduceMotion) trigger(dist);
  }, [trigger, dist, reduceMotion]);

  const hasAutoplayedRef = useRef(false);
  useEffect(() => {
    hasAutoplayedRef.current = false;
  }, [text]); // Resetear autoplay si cambia el texto

  useEffect(() => {
    if (!autoplay || !overflows || reduceMotion || hasAutoplayedRef.current) return;
    hasAutoplayedRef.current = true;
    trigger(dist);
    return () => {
      hasAutoplayedRef.current = false;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, overflows, dist, reduceMotion]);

  const Container = pointerEvents === 'none' ? View : Pressable;

  return (
    <Container
      onPress={autoplay || pointerEvents === 'none' ? undefined : handlePress}
      pointerEvents={pointerEvents}
      style={{ overflow: 'hidden', minHeight: isHorizontal ? lineHeight : undefined }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal={isHorizontal}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        onLayout={(e) => {
          const val = isHorizontal ? e.nativeEvent.layout.width : e.nativeEvent.layout.height;
          setContainerSize(Math.round(val));
        }}
      >
        <Text
          style={[style, { lineHeight }]}
          numberOfLines={numberOfLines}
          onLayout={(e) => {
            const val = isHorizontal ? e.nativeEvent.layout.width : e.nativeEvent.layout.height;
            setContentSize(Math.round(val));
          }}
        >
          {text}
        </Text>
      </ScrollView>
    </Container>
  );
}
