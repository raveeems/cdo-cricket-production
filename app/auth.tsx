import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PHRASES = [
  { text: 'Vettu', color: '#FFD700', size: 13 },
  { text: 'Cha', color: '#FF6B6B', size: 11 },
  { text: 'Vettu Kili', color: '#4ECDC4', size: 12 },
  { text: 'RCB fan daa', color: '#EE1C25', size: 10 },
  { text: 'Thala', color: '#FFD700', size: 14 },
  { text: 'Kholi fan daa', color: '#1A6FBF', size: 10 },
  { text: 'Jadeja all rounder?', color: '#2ECC71', size: 9 },
  { text: 'Best captain ever', color: '#E67E22', size: 10 },
  { text: 'Star the message', color: '#9B59B6', size: 9 },
  { text: 'Evolo sambathichi\nenna panna pora', color: '#FF69B4', size: 8 },
  { text: "Edhukaga sollren'na\nathukaga solren", color: '#00CED1', size: 10 },
  { text: 'Naan apave sonnen', color: '#FF4500', size: 12 },
  { text: 'Vanmam Pro Max', color: '#7B68EE', size: 13 },
  { text: 'Idho ungalukaga', color: '#32CD32', size: 11 },
];

const PHRASE_POSITIONS: { top?: string; bottom?: string; left?: string; right?: string; rotate: string }[] = [
  { top: '2%', left: '3%', rotate: '-8deg' },
  { top: '3%', right: '5%', rotate: '6deg' },
  { top: '10%', right: '2%', rotate: '10deg' },
  { top: '11%', left: '2%', rotate: '-5deg' },
  { bottom: '14%', right: '4%', rotate: '-7deg' },
  { bottom: '10%', left: '3%', rotate: '9deg' },
  { bottom: '5%', right: '6%', rotate: '5deg' },
  { bottom: '2%', left: '5%', rotate: '-10deg' },
  { bottom: '18%', left: '2%', rotate: '7deg' },
  { bottom: '7%', left: '20%', rotate: '-4deg' },
  { top: '5%', left: '25%', rotate: '4deg' },
  { top: '15%', left: '5%', rotate: '-6deg' },
  { bottom: '25%', left: '3%', rotate: '8deg' },
  { top: '8%', right: '20%', rotate: '-3deg' },
];

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (isLogin) {
      if (!phone || !password) {
        setError('Please fill in all fields');
        return;
      }
    } else {
      if (!username || !phone || !password) {
        setError('Please fill in all fields');
        return;
      }
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (isLogin) {
        const success = await login(phone, password);
        if (!success) {
          setError('Invalid phone number or password. Please try again.');
          setLoading(false);
          return;
        }
      } else {
        const success = await signup(username, email, phone, password);
        if (!success) {
          setError('Signup failed. Phone number may already be registered.');
          setLoading(false);
          return;
        }
      }
      router.replace('/reference-code');
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#0A0E1A', '#0D1530', '#0A0E1A'] : ['#F0F2F7', '#E8EBF5', '#F0F2F7']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.glowOrb, styles.glowOrb1, { backgroundColor: colors.primary }]} />
      <View style={[styles.glowOrb, styles.glowOrb2, { backgroundColor: colors.accent }]} />

      {PHRASES.map((phrase, i) => {
        const pos = PHRASE_POSITIONS[i];
        const posStyle: any = {
          position: 'absolute' as const,
          zIndex: 0,
          ...(pos.top ? { top: pos.top } : {}),
          ...(pos.bottom ? { bottom: pos.bottom } : {}),
          ...(pos.left ? { left: pos.left } : {}),
          ...(pos.right ? { right: pos.right } : {}),
        };
        return (
          <View key={phrase.text} style={posStyle}>
            <Text
              style={{
                color: phrase.color,
                fontSize: phrase.size,
                fontFamily: 'Inter_600SemiBold',
                opacity: 0.35,
                transform: [{ rotate: pos.rotate }],
                letterSpacing: 0.3,
              }}
            >
              {phrase.text}
            </Text>
          </View>
        );
      })}

      <KeyboardAvoidingView
        style={{ flex: 1, zIndex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + webTopInset + 30,
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={Platform.OS !== 'web' ? FadeInUp.duration(800).delay(200) : undefined}
            style={styles.headerSection}
          >
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/cdo-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              CDO Cricket
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Fantasy Cricket for Your Squad
            </Text>
          </Animated.View>

          <Animated.View
            entering={Platform.OS !== 'web' ? FadeInDown.duration(600).delay(400) : undefined}
          >
            <View style={[styles.formCard, { backgroundColor: isDark ? 'rgba(19, 24, 41, 0.9)' : 'rgba(255, 255, 255, 0.92)', borderColor: colors.border }]}>
              <View style={styles.tabRow}>
                <Pressable
                  style={[
                    styles.tab,
                    isLogin && { backgroundColor: isDark ? 'rgba(255, 215, 0, 0.12)' : 'rgba(0, 85, 165, 0.1)', borderRadius: 10 },
                  ]}
                  onPress={() => { setIsLogin(true); setError(''); }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: isLogin ? colors.accent : colors.textTertiary,
                        fontFamily: 'Inter_600SemiBold',
                      },
                    ]}
                  >
                    Log In
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.tab,
                    !isLogin && { backgroundColor: isDark ? 'rgba(255, 215, 0, 0.12)' : 'rgba(0, 85, 165, 0.1)', borderRadius: 10 },
                  ]}
                  onPress={() => { setIsLogin(false); setError(''); }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: !isLogin ? colors.accent : colors.textTertiary,
                        fontFamily: 'Inter_600SemiBold',
                      },
                    ]}
                  >
                    Sign Up
                  </Text>
                </Pressable>
              </View>

              <View style={styles.formSection}>
                {!isLogin && (
                  <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(10, 14, 26, 0.6)' : colors.background, borderColor: colors.border }]}>
                    <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
                    <TextInput
                      style={[styles.input, { color: colors.text, fontFamily: 'Inter_400Regular' }]}
                      placeholder="Username"
                      placeholderTextColor={colors.textTertiary}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                    />
                  </View>
                )}

                <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(10, 14, 26, 0.6)' : colors.background, borderColor: colors.border }]}>
                  <Ionicons name="call-outline" size={20} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontFamily: 'Inter_400Regular' }]}
                    placeholder="Phone Number"
                    placeholderTextColor={colors.textTertiary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                {!isLogin && (
                  <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(10, 14, 26, 0.6)' : colors.background, borderColor: colors.border }]}>
                    <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
                    <TextInput
                      style={[styles.input, { color: colors.text, fontFamily: 'Inter_400Regular' }]}
                      placeholder="Email (optional)"
                      placeholderTextColor={colors.textTertiary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                )}

                <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(10, 14, 26, 0.6)' : colors.background, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontFamily: 'Inter_400Regular' }]}
                    placeholder="Password"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </Pressable>
                </View>

                {!!error && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={[styles.errorText, { color: colors.error, fontFamily: 'Inter_400Regular' }]}>
                      {error}
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { opacity: pressed || loading ? 0.8 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={[colors.accent, colors.accentDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={[styles.submitText, { fontFamily: 'Inter_700Bold' }]}>
                        {isLogin ? 'Log In' : 'Create Account'}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={Platform.OS !== 'web' ? FadeInUp.duration(500).delay(700) : undefined}
            style={styles.footer}
          >
            <Text style={[styles.footerText, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
              Private league - Invite only
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.08,
  },
  glowOrb1: {
    width: 300,
    height: 300,
    top: -80,
    right: -60,
  },
  glowOrb2: {
    width: 250,
    height: 250,
    bottom: 60,
    left: -80,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    letterSpacing: 3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)' } : {}),
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
  },
  formSection: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 13,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  submitText: {
    fontSize: 16,
    color: '#000',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
});
