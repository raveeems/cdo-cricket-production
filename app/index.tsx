import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Image, Text, Platform, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PHRASES = [
  { text: 'Vettu', size: 16, color: '#FFD700' },
  { text: 'Cha', size: 14, color: '#FF6B6B' },
  { text: 'Vettu Kili', size: 15, color: '#4ECDC4' },
  { text: 'RCB fan daa', size: 13, color: '#EE1C25' },
  { text: 'Kholi fan daa', size: 12, color: '#1A6FBF' },
  { text: 'Thala', size: 18, color: '#FFD700' },
  { text: 'Jadeja all rounder?', size: 11, color: '#2ECC71' },
  { text: 'Best captain ever', size: 12, color: '#E67E22' },
  { text: 'Star the message', size: 11, color: '#9B59B6' },
  { text: 'Evolo sambathichi enna panna pora', size: 10, color: '#FF69B4' },
];

const PHRASE_POSITIONS = [
  { top: '8%', left: '5%', rotate: '-12deg' },
  { top: '12%', right: '8%', rotate: '8deg' },
  { top: '22%', left: '2%', rotate: '-5deg' },
  { top: '18%', right: '3%', rotate: '15deg' },
  { top: '68%', left: '4%', rotate: '10deg' },
  { top: '75%', right: '5%', rotate: '-8deg' },
  { top: '62%', right: '2%', rotate: '6deg' },
  { top: '82%', left: '8%', rotate: '-10deg' },
  { top: '88%', right: '10%', rotate: '12deg' },
  { top: '55%', left: '1%', rotate: '-15deg' },
];

function FloatingPhrase({ phrase, position, index }: {
  phrase: typeof PHRASES[0];
  position: typeof PHRASE_POSITIONS[0];
  index: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const translateY = useSharedValue(15);

  useEffect(() => {
    const delay = 600 + index * 150;
    opacity.value = withDelay(delay, withSequence(
      withTiming(0.85, { duration: 400 }),
      withDelay(1200 - index * 80, withTiming(0, { duration: 500 })),
    ));
    scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 100 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 12 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const posStyle: any = {
    position: 'absolute' as const,
    ...(position.top ? { top: position.top } : {}),
    ...(position.left ? { left: position.left } : {}),
    ...(position.right ? { right: position.right } : {}),
  };

  return (
    <Animated.View style={[posStyle, animStyle]}>
      <View style={[styles.phraseChip, { borderColor: phrase.color + '40' }]}>
        <Text
          style={[
            styles.phraseText,
            {
              color: phrase.color,
              fontSize: phrase.size,
              fontFamily: 'Inter_600SemiBold',
              transform: [{ rotate: position.rotate }],
            },
          ]}
        >
          {phrase.text}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function IndexScreen() {
  const { isLoading, isAuthenticated, isVerified } = useAuth();
  const { colors, isDark } = useTheme();
  const [animDone, setAnimDone] = useState(false);

  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);
  const containerOpacity = useSharedValue(1);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  const onAnimEnd = useCallback(() => {
    setAnimDone(true);
  }, []);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 100 }),
      withSpring(1, { damping: 12, stiffness: 120 }),
    );

    ringScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 80 }));
    ringOpacity.value = withDelay(200, withSequence(
      withTiming(0.5, { duration: 400 }),
      withTiming(0, { duration: 600 }),
    ));

    titleOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(500, withSpring(0, { damping: 12 }));

    subtitleOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));

    shimmerTranslate.value = withDelay(600,
      withTiming(SCREEN_WIDTH, { duration: 1000, easing: Easing.inOut(Easing.ease) })
    );

    containerOpacity.value = withDelay(3400,
      withTiming(0, { duration: 400 }, () => {
        runOnJS(onAnimEnd)();
      })
    );
  }, []);

  useEffect(() => {
    if (!animDone || isLoading) return;

    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (!isVerified) {
      router.replace('/reference-code');
    } else {
      router.replace('/(tabs)');
    }
  }, [animDone, isLoading, isAuthenticated, isVerified]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const ringAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerAnimStyle]}>
      <LinearGradient
        colors={isDark ? ['#060918', '#0A0E1A', '#0D1530', '#0A0E1A'] : ['#E8EBF5', '#F0F2F7', '#F5F7FC', '#F0F2F7']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.glowOrb, styles.glowOrb1, { backgroundColor: colors.primary }]} />
      <View style={[styles.glowOrb, styles.glowOrb2, { backgroundColor: colors.accent }]} />
      <View style={[styles.glowOrb, styles.glowOrb3, { backgroundColor: colors.primary }]} />

      {PHRASES.map((phrase, i) => (
        <FloatingPhrase
          key={phrase.text}
          phrase={phrase}
          position={PHRASE_POSITIONS[i]}
          index={i}
        />
      ))}

      <View style={styles.center}>
        <View style={styles.logoWrapper}>
          <Animated.View style={[styles.ring, ringAnimStyle, { borderColor: colors.accent }]} />
          <Animated.View style={[styles.logoBox, logoAnimStyle]}>
            <Image
              source={require('@/assets/images/cdo-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Animated.View style={[styles.shimmer, shimmerStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,215,0,0.15)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shimmerGrad}
              />
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.title,
            titleAnimStyle,
            { color: colors.text, fontFamily: 'Inter_700Bold' },
          ]}
        >
          CDO Cricket
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            subtitleAnimStyle,
            { color: colors.textSecondary, fontFamily: 'Inter_400Regular' },
          ]}
        >
          Fantasy Cricket for Your Squad
        </Animated.Text>
      </View>

      <Animated.View style={[styles.bottomDots, subtitleAnimStyle]}>
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
        <View style={[styles.dot, styles.dotMid, { backgroundColor: colors.primary }]} />
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.06,
  },
  glowOrb1: {
    width: 350,
    height: 350,
    top: -100,
    right: -80,
  },
  glowOrb2: {
    width: 200,
    height: 200,
    bottom: 100,
    left: -60,
  },
  glowOrb3: {
    width: 180,
    height: 180,
    top: '40%',
    left: '60%',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
  },
  logoBox: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerGrad: {
    width: 60,
    height: '100%',
  },
  title: {
    fontSize: 34,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  bottomDots: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotMid: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phraseChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  phraseText: {
    letterSpacing: 0.5,
  },
});
