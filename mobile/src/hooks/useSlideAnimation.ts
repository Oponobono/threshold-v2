import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export function useSlideAnimation(visible: boolean, slideDistance: number = 600) {
  const slideAnim = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: slideDistance,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, slideDistance]);

  return slideAnim;
}
