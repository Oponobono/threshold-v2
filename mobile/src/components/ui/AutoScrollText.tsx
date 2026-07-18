import React, { useState, useRef, useCallback } from 'react';
import {
  Text,
  TextStyle,
  StyleProp,
  Pressable,
  ScrollView,
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
}

export function AutoScrollText({
  text,
  style,
  lineHeight = 20,
  pixelsPerSecond = 50,
  pauseAtEnd = 1000,
  returnDuration = 600,
  maxLoops = 0,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const overflows = containerWidth > 0 && contentWidth > containerWidth;
  const dist = contentWidth - containerWidth;

  const scrollTo = useCallback(
    (x: number) => scrollRef.current?.scrollTo({ x, animated: false }),
    [],
  );

  const { trigger, cancel } = useAutoScroller(overflows, scrollTo, {
    pixelsPerSecond,
    pauseAtEnd,
    returnDuration,
    maxLoops,
  });

  const handlePress = useCallback(() => {
    trigger(dist);
  }, [trigger, dist]);

  return (
    <Pressable
      onPress={handlePress}
      style={{ overflow: 'hidden', paddingVertical: 1, minHeight: lineHeight }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <Text
          style={[style, { lineHeight }]}
          onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </ScrollView>
    </Pressable>
  );
}
