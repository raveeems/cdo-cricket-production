import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function IndexScreen() {
  const { isLoading, isAuthenticated, isVerified } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (!isVerified) {
      router.replace('/reference-code');
    } else {
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated, isVerified]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
