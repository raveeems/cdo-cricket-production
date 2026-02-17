import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function ReferenceCodeScreen() {
  const { verifyReferenceCode, logout, isVerified } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  if (isVerified) {
    router.replace('/(tabs)');
    return null;
  }

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setLoading(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const valid = await verifyReferenceCode(fullCode);
      if (valid) {
        setSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 600);
      } else {
        setError('Invalid code. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth');
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset + 60,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.iconBg}
          >
            <Ionicons name="key" size={36} color="#FFF" />
          </LinearGradient>
        </View>

        <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
          Enter Reference Code
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          Ask your group admin for the 4-digit code to unlock access to the platform.
        </Text>

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[
                styles.codeInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: digit ? colors.accent : colors.border,
                  color: colors.text,
                  fontFamily: 'Inter_700Bold',
                },
                success && { borderColor: colors.success },
              ]}
              value={digit}
              onChangeText={(v) => handleCodeChange(v, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {!!error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error, fontFamily: 'Inter_400Regular' }]}>
              {error}
            </Text>
          </View>
        )}

        {success && (
          <View style={styles.errorRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success, fontFamily: 'Inter_500Medium' }]}>
              Access granted!
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleVerify}
          disabled={loading || success}
          style={({ pressed }) => [
            styles.verifyButton,
            { opacity: pressed || loading ? 0.8 : 1 },
          ]}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.verifyGradient}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={[styles.verifyText, { fontFamily: 'Inter_700Bold' }]}>
                Verify Code
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={[styles.logoutText, { color: colors.textTertiary, fontFamily: 'Inter_500Medium' }]}>
            Use a different account
          </Text>
        </Pressable>

        <View style={[styles.hintCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Demo codes: 1234, 5678, 9012, 3456
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    maxWidth: 280,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  codeInput: {
    width: 60,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 24,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
  },
  successText: {
    fontSize: 14,
  },
  verifyButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
  },
  verifyGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  verifyText: {
    fontSize: 16,
    color: '#000',
  },
  logoutBtn: {
    marginTop: 16,
    padding: 8,
  },
  logoutText: {
    fontSize: 14,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintText: {
    fontSize: 13,
  },
});
