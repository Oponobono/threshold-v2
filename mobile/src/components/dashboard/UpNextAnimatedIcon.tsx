import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import Reanimated, {
  Easing as ReanimatedEasing,
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Reanimated.createAnimatedComponent(Line);

interface AnimatedClockIconProps {
  color: string;
  size?: number;
  live?: boolean;
}

export function AnimatedClockIcon({ color, size = 20, live = false }: AnimatedClockIconProps) {
  const angle = useSharedValue(0);

  useEffect(() => {
    const duration = live ? 6000 : 12000;
    angle.value = withRepeat(withTiming(360, { duration, easing: ReanimatedEasing.linear }), -1, false);
    return () => cancelAnimation(angle);
  }, [live, angle]);

  const minuteProps = useAnimatedProps(() => {
    const rad = (angle.value * Math.PI) / 180;
    return {
      x2: 12 + 6.5 * Math.sin(rad),
      y2: 12 - 6.5 * Math.cos(rad),
    };
  });

  const hourProps = useAnimatedProps(() => {
    const rad = ((angle.value / 12) * Math.PI) / 180;
    return {
      x2: 12 + 2.8 * Math.cos(rad),
      y2: 12 - 2.8 * Math.sin(rad),
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.5} fill="none" />
      <AnimatedLine x1={12} y1={12} animatedProps={minuteProps} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <AnimatedLine x1={12} y1={12} animatedProps={hourProps} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={1.3} fill={color} />
    </Svg>
  );
}

const CHECK_LEN = 9;

interface AnimatedTaskIconProps {
  color: string;
  size?: number;
}

export function AnimatedTaskIcon({ color, size = 20 }: AnimatedTaskIconProps) {
  const dashOffset = useRef(new Animated.Value(CHECK_LEN)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(dashOffset, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(dashOffset, {
          toValue: CHECK_LEN,
          duration: 400,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dashOffset]);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 2.5 h9.2 L19.5 6.8 V20 a1.5 1.5 0 0 1 -1.5 1.5 H6 A1.5 1.5 0 0 1 4.5 20 V4 A1.5 1.5 0 0 1 6 2.5 Z"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
      />
      <Path d="M15.2 2.5 V6.8 H19.5" stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      <Line x1={7.5} y1={10.5} x2={16.5} y2={10.5} stroke={color} strokeWidth={1.3} strokeLinecap="round" opacity={0.55} />
      <Line x1={7.5} y1={13} x2={13.5} y2={13} stroke={color} strokeWidth={1.3} strokeLinecap="round" opacity={0.55} />
      <AnimatedPath
        d="M8.2 15.2 l2.3 2.3 4.6-4.7"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={CHECK_LEN}
        strokeDashoffset={dashOffset as any}
      />
    </Svg>
  );
}
