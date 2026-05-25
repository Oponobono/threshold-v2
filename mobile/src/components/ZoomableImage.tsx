import React, { useRef } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { Image, type ImageContentFit } from 'expo-image';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface ZoomableImageProps {
  uri: string;
  resizeMode?: 'contain' | 'cover' | 'stretch';
}

const CONTENT_FIT_MAP: Record<string, ImageContentFit> = {
  contain: 'contain',
  cover: 'cover',
  stretch: 'fill',
};

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  uri,
  resizeMode = 'contain',
}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  const clampTranslation = (translation: number, currentScale: number) => {
    const maxTranslation = (SCREEN_WIDTH * (currentScale - 1)) / 2;
    return Math.max(-maxTranslation, Math.min(maxTranslation, translation));
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(5, Math.max(1, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.1) {
        translationX.value = withSpring(0, { damping: 10, mass: 1 });
        translationY.value = withSpring(0, { damping: 10, mass: 1 });
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslationX.value = translationX.value;
      savedTranslationY.value = translationY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1.1) {
        translationX.value = clampTranslation(
          savedTranslationX.value + event.translationX,
          scale.value,
        );
        translationY.value = clampTranslation(
          savedTranslationY.value + event.translationY,
          scale.value,
        );
      }
    })
    .onEnd(() => {
      savedTranslationX.value = translationX.value;
      savedTranslationY.value = translationY.value;
    })
    .minPointers(1)
    .maxPointers(2);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1.5) {
        scale.value = withSpring(1, { damping: 10, mass: 1, overshootClamping: true });
        translationX.value = withSpring(0, { damping: 10, mass: 1, overshootClamping: true });
        translationY.value = withSpring(0, { damping: 10, mass: 1, overshootClamping: true });
        savedScale.value = 1;
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else {
        scale.value = withSpring(2.5, { damping: 10, mass: 1, overshootClamping: true });
        savedScale.value = 2.5;
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={[{ width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit={CONTENT_FIT_MAP[resizeMode] ?? 'contain'}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};
