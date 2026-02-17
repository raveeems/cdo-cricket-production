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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

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
      if (!email || !password) {
        setError('Please fill in all fields');
        return;
      }
    } else {
      if (!username || !email || !phone || !password) {
        setError('Please fill in all fields');
        return;
      }
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (isLogin) {
        const success = await login(email, password);
        if (!success) {
          setError('No account found. Please sign up first.');
          setLoading(false);
          return;
        }
      } else {
        await signup(username, email, phone, password);
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + webTopInset + 40,
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Ionicons name="trophy" size={32} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              CDO
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Fantasy Cricket for Your Squad
            </Text>
          </View>

          <View style={styles.tabRow}>
            <Pressable
              style={[
                styles.tab,
                isLogin && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
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
                !isLogin && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
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
              <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: 'Inter_400Regular' }]}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {!isLogin && (
              <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
            )}

            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 24,
    justifyContent: 'center',
  },
  tab: {
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 16,
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
    height: 54,
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
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  submitText: {
    fontSize: 16,
    color: '#000',
  },
});
