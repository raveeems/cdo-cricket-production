import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout, isAdmin, updateTeamName } = useAuth();
  const { teams } = useTeams();
  const insets = useSafeAreaInsets();

  const [editingTeamName, setEditingTeamName] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState(user?.teamName || '');
  const [teamNameSaving, setTeamNameSaving] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const { data: myRewardsData, isLoading: rewardsLoading } = useQuery<{ rewards: any[] }>({
    queryKey: ['/api/rewards/my'],
    staleTime: 30000,
  });
  const myRewards = myRewardsData?.rewards || [];

  const matchesJoined = new Set(teams.map((t) => t.matchId)).size;
  const totalTeams = teams.length;

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/auth');
  };

  const handleSaveTeamName = async () => {
    if (!teamNameInput.trim()) return;
    setTeamNameSaving(true);
    const ok = await updateTeamName(teamNameInput.trim());
    setTeamNameSaving(false);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingTeamName(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8, paddingHorizontal: 16 }}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            Profile
          </Text>

          <LinearGradient
            colors={[colors.primary, '#1E40AF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.profileAvatar}>
              <Text style={[styles.profileInitial, { fontFamily: 'Inter_700Bold' }]}>
                {(user?.username || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { fontFamily: 'Inter_700Bold' }]}>
                {user?.username || 'Player'}
              </Text>
              {user?.teamName ? (
                <Text style={[styles.profileTeamName, { fontFamily: 'Inter_500Medium' }]}>
                  {user.teamName}
                </Text>
              ) : null}
              {isAdmin && (
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#FFD130" />
                  <Text style={[styles.adminBadgeText, { fontFamily: 'Inter_600SemiBold' }]}>
                    Admin
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>

          {editingTeamName ? (
            <View style={[styles.teamNameEditCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.teamNameEditLabel, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                Team Name
              </Text>
              <View style={styles.teamNameEditRow}>
                <TextInput
                  value={teamNameInput}
                  onChangeText={setTeamNameInput}
                  placeholder="Enter your team name"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={30}
                  style={[styles.teamNameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated, fontFamily: 'Inter_500Medium' }]}
                  autoFocus
                />
                <Pressable
                  onPress={handleSaveTeamName}
                  disabled={teamNameSaving || !teamNameInput.trim()}
                  style={[styles.teamNameSaveBtn, { backgroundColor: colors.primary, opacity: teamNameInput.trim() ? 1 : 0.5 }]}
                >
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                </Pressable>
                <Pressable
                  onPress={() => { setEditingTeamName(false); setTeamNameInput(user?.teamName || ''); }}
                  style={[styles.teamNameCancelBtn, { borderColor: colors.border }]}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => { setTeamNameInput(user?.teamName || ''); setEditingTeamName(true); }}
              style={[styles.teamNameCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <View style={styles.teamNameCardLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.accent + '20' }]}>
                  <MaterialCommunityIcons name="cricket" size={18} color={colors.accent} />
                </View>
                <View>
                  <Text style={[styles.teamNameLabel, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    Team Name
                  </Text>
                  <Text style={[styles.teamNameValue, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                    {user?.teamName || 'Set your team name'}
                  </Text>
                </View>
              </View>
              <Ionicons name="pencil" size={16} color={colors.textTertiary} />
            </Pressable>
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <MaterialCommunityIcons name="cricket" size={24} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                {matchesJoined}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Matches
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="people" size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                {totalTeams}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Teams
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="trophy" size={24} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                {myRewards.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Wins
              </Text>
            </View>
          </View>

          {myRewards.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' as const, marginBottom: 10 }}>
                My Rewards
              </Text>
              {myRewards.map((r: any) => (
                <View
                  key={r.id}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: '#FFD70030',
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFD70015', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="gift" size={18} color="#FFD700" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' as const }}>
                        {r.brand} - {r.title}
                      </Text>
                      {r.matchLabel ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Inter_400Regular' as const, marginTop: 1 }}>
                          Won in: {r.matchLabel}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ color: colors.primary, fontSize: 15, fontFamily: 'Inter_700Bold' as const, letterSpacing: 2 }}>
                        {r.code}
                      </Text>
                    </View>
                    <Pressable
                      onPress={async () => {
                        await Clipboard.setStringAsync(r.code);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.primary + '10', borderRadius: 8 }}
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Inter_600SemiBold' as const }}>Copy</Text>
                    </Pressable>
                  </View>
                  {r.terms ? (
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const, marginTop: 6 }}>
                      {r.terms}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          <View style={[styles.settingsSection, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.accent} />
                </View>
                <Text style={[styles.settingText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                  Dark Mode
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleTheme();
                }}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.settingText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                  Notifications
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.settingRow} onPress={() => router.push('/how-to-play')}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.success + '20' }]}>
                  <Feather name="help-circle" size={18} color={colors.success} />
                </View>
                <Text style={[styles.settingText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                  How to Play
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </Pressable>

            {isAdmin && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Pressable
                  style={styles.settingRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/admin');
                  }}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIcon, { backgroundColor: colors.error + '20' }]}>
                      <Ionicons name="shield" size={18} color={colors.error} />
                    </View>
                    <Text style={[styles.settingText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                      Admin Panel
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </Pressable>
              </>
            )}
          </View>

          <Pressable
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: colors.error + '15', borderColor: colors.error + '30' }]}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error, fontFamily: 'Inter_600SemiBold' }]}>
              Log Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  profileCard: {
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 24,
    color: '#FFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    color: '#FFF',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: 'rgba(255,209,48,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  adminBadgeText: {
    fontSize: 11,
    color: '#FFD130',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 11,
  },
  settingsSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: 62,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
  },
  profileTeamName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  teamNameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  teamNameCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamNameLabel: {
    fontSize: 11,
  },
  teamNameValue: {
    fontSize: 15,
    marginTop: 1,
  },
  teamNameEditCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
  },
  teamNameEditLabel: {
    fontSize: 13,
  },
  teamNameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamNameInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  teamNameSaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamNameCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
