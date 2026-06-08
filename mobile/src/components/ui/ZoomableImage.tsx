import React, { memo, useRef, useState, useMemo } from 'react';
import { View, Dimensions, PanResponder } from 'react-native';
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

export const ZoomableImage: React.FC<ZoomableImageProps> = memo(function ZoomableImage({
  uri,
  resizeMode = 'contain',
}) {
  const scale = useRef(1);
  const translateX = useRef(0);
  const translateY = useRef(0);
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const initialPinchDist = useRef(0);
  const initialGsDx = useRef(0);
  const initialGsDy = useRef(0);
  const lastTapTime = useRef(0);

  const [transform, setTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });

  const panResponder = useMemo(() => {
    const getDist = (touches: any[]) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const clamp = (t: number, s: number) => {
      const max = (SCREEN_WIDTH * (s - 1)) / 2;
      return Math.max(-max, Math.min(max, t));
    };
    const update = () => {
      setTransform({
        scale: scale.current,
        translateX: translateX.current,
        translateY: translateY.current,
      });
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => scale.current > 1.1,
      onMoveShouldSetPanResponder: (evt, gs) => {
        if (evt.nativeEvent.touches.length >= 2) return true;
        if (scale.current > 1.1) return true;
        return Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10;
      },
      onPanResponderGrant: (evt, gs) => {
        lastScale.current = scale.current;
        lastTranslateX.current = translateX.current;
        lastTranslateY.current = translateY.current;
        initialGsDx.current = gs.dx;
        initialGsDy.current = gs.dy;
        if (evt.nativeEvent.touches.length >= 2) {
          initialPinchDist.current = getDist(evt.nativeEvent.touches);
        }
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const currentDist = getDist(touches);
          if (initialPinchDist.current > 0) {
            const newScale = Math.min(5, Math.max(1, lastScale.current * (currentDist / initialPinchDist.current)));
            scale.current = newScale;
            translateX.current = 0;
            translateY.current = 0;
            update();
          }
        } else if (scale.current > 1.1) {
          translateX.current = clamp(lastTranslateX.current + (gs.dx - initialGsDx.current), scale.current);
          translateY.current = clamp(lastTranslateY.current + (gs.dy - initialGsDy.current), scale.current);
          update();
        }
      },
      onPanResponderRelease: () => {
        const now = Date.now();
        if (now - lastTapTime.current < 300 && scale.current <= 1.1) {
          lastTapTime.current = 0;
          scale.current = 2.5;
          update();
          return;
        }
        lastTapTime.current = now;
        if (scale.current < 1.1) {
          scale.current = 1;
          translateX.current = 0;
          translateY.current = 0;
          lastScale.current = 1;
          update();
        }
      },
      onPanResponderTerminate: () => {
        if (scale.current < 1.1) {
          scale.current = 1;
          translateX.current = 0;
          translateY.current = 0;
          lastScale.current = 1;
          update();
        }
      },
    });
  }, []);

  return (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={[
          { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
          { transform: [{ scale: transform.scale }, { translateX: transform.translateX }, { translateY: transform.translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit={CONTENT_FIT_MAP[resizeMode] ?? 'contain'}
          transition={0}
        />
      </View>
    </View>
  );
});
