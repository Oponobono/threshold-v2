import React, { useCallback, useRef } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPRING_CONFIG = { damping: 18, stiffness: 180 };
const SWIPE_THRESHOLD = 40;

interface HeroCarouselProps<T> {
  items: T[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onHeightChange?: (height: number) => void;
  renderItem: (item: T) => React.ReactNode;
}

export function HeroCarousel<T>({ items, currentIndex, onIndexChange, onHeightChange, renderItem }: HeroCarouselProps<T>) {
  const isAnimating = useRef(false);
  const prevHeight = useRef(0);

  const goTo = useCallback((targetIndex: number) => {
    if (isAnimating.current || targetIndex === currentIndex) return;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    isAnimating.current = true;
    onIndexChange(targetIndex);
    setTimeout(() => { isAnimating.current = false; }, 350);
  }, [currentIndex, items.length, onIndexChange]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-25, 25])
    .onEnd((e) => {
      'worklet';
      if (isAnimating.current) return;
      if (e.translationX < -SWIPE_THRESHOLD && currentIndex < items.length - 1) {
        runOnJS(goTo)(currentIndex + 1);
      } else if (e.translationX > SWIPE_THRESHOLD && currentIndex > 0) {
        runOnJS(goTo)(currentIndex - 1);
      }
    });

  const handleCardLayout = useCallback((height: number) => {
    onHeightChange?.(height);
    prevHeight.current = height;
  }, [onHeightChange]);

  if (!items.length) return null;

  const item = items[currentIndex];
  const direction = 'right';

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ paddingHorizontal: 24 }}>
        <Animated.View
          key={`hero-card-${currentIndex}`}
          entering={SlideInRight.springify().damping(SPRING_CONFIG.damping).stiffness(SPRING_CONFIG.stiffness)}
          exiting={SlideOutLeft.springify().damping(SPRING_CONFIG.damping).stiffness(SPRING_CONFIG.stiffness)}
          onLayout={(e) => handleCardLayout(e.nativeEvent.layout.height)}
        >
          {renderItem(item)}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
