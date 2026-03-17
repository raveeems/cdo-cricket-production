import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.surfaceElevated,
          borderRadius,
          height,
          width: width ?? '100%',
          opacity,
        },
        style,
      ]}
    />
  );
}
