import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function PendingApprovalScreen() {
  const { logout, isVerified } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (isVerified) {
      router.replace('/(tabs)');
    }
  }, [isVerified]);

  if (isVerified) return null;

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
    router.replace('/auth');
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#0A0E1A', '#0D1530', '#0A0E1A'] : ['#F0F2F7', '#E8EBF5', '#F0F2F7']}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset + 80,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.iconBg}
          >
            <Ionicons name="hourglass" size={40} color="#FFF" />
          </LinearGradient>
        </View>

        <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
          Approval Pending
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          Your account has been created successfully. An admin will review and approve your signup shortly.
        </Text>

        <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.06)', borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)' }]}>
          <Ionicons name="information-circle" size={20} color="#F59E0B" />
          <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Once approved, you can log in and start creating fantasy teams. This usually takes a few minutes.
          </Text>
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.backBtn,
            { opacity: pressed ? 0.7 : 1, borderColor: colors.border },
          ]}
        >
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={[styles.backBtnText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            Back to Login
          </Text>
        </Pressable>
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
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 28,
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 300,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: 14,
  },
});
