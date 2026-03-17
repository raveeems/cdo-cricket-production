import React, { useState, useMemo } from 'react';
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
import { SkeletonBox } from '@/components/SkeletonBox';
import type { Match } from '@/lib/mock-data';

const isWeb = Platform.OS === 'web';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout, isAdmin, updateTeamName } = useAuth();
  const { teams } = useTeams();
  const insets = useSafeAreaInsets();

  const [editingTeamName, setEditingTeamName] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState(user?.teamName || '');
  const [teamNameSaving, setTeamNameSaving] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const webTopInset = isWeb ? 67 : 0;

  const { data: myRewardsData, isLoading: rewardsLoading } = useQuery<{ rewards: any[] }>({
    queryKey: ['/api/rewards/my'],
    staleTime: 30000,
  });
  const myRewards = myRewardsData?.rewards || [];

  const { data: allMatchesData, isLoading: matchesLoading } = useQuery<{ matches: Match[] }>({
    queryKey: ['/api/matches'],
    staleTime: 60000,
  });
  const allMatches = allMatchesData?.matches || [];

  const matchesJoined = new Set(teams.map((t) => t.matchId)).size;
  const totalTeams = teams.length;

  const tournamentHistory = useMemo(() => {
    const grouped: Record<string, { matchId: string; label: string; teamCount: number; bestPoints: number; status: string }> = {};
    for (const t of teams) {
      const matchInfo = allMatches.find(m => m.id === t.matchId);
      if (!grouped[t.matchId]) {
        grouped[t.matchId] = {
          matchId: t.matchId,
          label: matchInfo ? `${matchInfo.team1Short} vs ${matchInfo.team2Short}` : `Match`,
          teamCount: 0,
          bestPoints: 0,
          status: matchInfo?.status || 'upcoming',
        };
      }
      grouped[t.matchId].teamCount++;
      const pts = t.totalPoints || 0;
      if (pts > grouped[t.matchId].bestPoints) grouped[t.matchId].bestPoints = pts;
    }
    return Object.values(grouped).sort((a, b) => {
      const order = ['live', 'completed', 'upcoming', 'delayed'];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });
  }, [teams, allMatches]);

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

  const webHover = (key: string) => isWeb ? {
    onMouseEnter: () => setHoveredRow(key),
    onMouseLeave: () => setHoveredRow(null),
  } : {};

  const statCards = [
    { icon: <MaterialCommunityIcons name="cricket" size={24} color={colors.accent} />, value: matchesJoined, label: 'Matches', accentColor: colors.accent },
    { icon: <Ionicons name="people" size={24} color={colors.primary} />, value: totalTeams, label: 'Teams', accentColor: colors.primary },
    { icon: <Ionicons name="trophy" size={24} color={colors.success} />, value: myRewards.length, label: 'Wins', accentColor: colors.success },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.innerContainer, { paddingTop: insets.top + webTopInset + 8 }]}>
          <View style={styles.pageTitleRow}>
            <View style={[styles.pageTitleAccent, { backgroundColor: colors.accent }]} />
            <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Profile
            </Text>
          </View>

          <LinearGradient
            colors={colors.profileGradient as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.profileCardOverlay}>
              <View style={[styles.profileGlowOrb, { backgroundColor: colors.accent + '10', top: -15, right: -15 }]} />
            </View>
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
                  style={[styles.teamNameSaveBtn, { backgroundColor: colors.primary, opacity: teamNameInput.trim() ? 1 : 0.5, ...(isWeb ? { cursor: 'pointer' as any } : {}) }]}
                >
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                </Pressable>
                <Pressable
                  onPress={() => { setEditingTeamName(false); setTeamNameInput(user?.teamName || ''); }}
                  style={[styles.teamNameCancelBtn, { borderColor: colors.border, ...(isWeb ? { cursor: 'pointer' as any } : {}) }]}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => { setTeamNameInput(user?.teamName || ''); setEditingTeamName(true); }}
              style={[
                styles.teamNameCard,
                {
                  backgroundColor: hoveredRow === 'teamName' ? colors.cardHover : colors.card,
                  borderColor: colors.cardBorder,
                  ...(isWeb ? { cursor: 'pointer' as any, transition: 'background-color 0.15s ease' as any } : {}),
                },
              ]}
              {...webHover('teamName')}
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
            {statCards.map((stat, i) => (
              <View
                key={i}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    borderTopWidth: 3,
                    borderTopColor: stat.accentColor + '50',
                  },
                ]}
              >
                {stat.icon}
                <Text style={[styles.statValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {tournamentHistory.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionAccent, { backgroundColor: colors.accent }]} />
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                  My Matches
                </Text>
              </View>
              {matchesLoading ? (
                <>
                  <SkeletonBox width="100%" height={56} borderRadius={12} style={{ marginBottom: 8 }} colors={colors} />
                  <SkeletonBox width="100%" height={56} borderRadius={12} style={{ marginBottom: 8 }} colors={colors} />
                </>
              ) : (
                tournamentHistory.map((entry) => {
                  const statusColor = entry.status === 'live' ? '#22C55E' : entry.status === 'completed' ? colors.textTertiary : colors.primary;
                  const statusLabel = entry.status === 'live' ? 'LIVE' : entry.status === 'completed' ? 'DONE' : entry.status === 'delayed' ? 'DELAYED' : 'SOON';
                  return (
                    <Pressable
                      key={entry.matchId}
                      onPress={() => router.push({ pathname: '/(tabs)/match/[id]', params: { id: entry.matchId } })}
                      style={[styles.historyRow, {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                        ...(isWeb ? { cursor: 'pointer' as any } : {}),
                      }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' as const }} numberOfLines={1}>
                          {entry.label}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const, marginTop: 2 }}>
                          {entry.teamCount} {entry.teamCount === 1 ? 'team' : 'teams'}
                          {entry.bestPoints > 0 ? ` · ${entry.bestPoints} pts best` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={{ backgroundColor: statusColor + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ color: statusColor, fontSize: 10, fontFamily: 'Inter_700Bold' as const }}>{statusLabel}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          {myRewards.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionAccent, { backgroundColor: colors.accent }]} />
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                  My Rewards
                </Text>
              </View>
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
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.primary + '10', borderRadius: 8, ...(isWeb ? { cursor: 'pointer' as any } : {}) }}
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
            <Pressable
              style={[
                styles.settingRow,
                hoveredRow === 'darkMode' && isWeb ? { backgroundColor: colors.cardHover } : {},
              ]}
              {...webHover('darkMode')}
            >
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
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable
              style={[
                styles.settingRow,
                hoveredRow === 'howToPlay' && isWeb ? { backgroundColor: colors.cardHover } : {},
                isWeb ? { cursor: 'pointer' as any } : {},
              ]}
              onPress={() => router.push('/how-to-play')}
              {...webHover('howToPlay')}
            >
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
                  style={[
                    styles.settingRow,
                    hoveredRow === 'admin' && isWeb ? { backgroundColor: colors.cardHover } : {},
                    isWeb ? { cursor: 'pointer' as any } : {},
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/admin');
                  }}
                  {...webHover('admin')}
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
            style={({ pressed }) => [
              styles.logoutButton,
              {
                backgroundColor: colors.error + '15',
                borderColor: colors.error + '30',
                opacity: pressed ? 0.8 : 1,
                ...(isWeb ? { cursor: 'pointer' as any } : {}),
              },
            ]}
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
  innerContainer: {
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center' as const,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  pageTitleAccent: {
    width: 3,
    height: 24,
    borderRadius: 2,
  },
  pageTitle: {
    fontSize: 24,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  profileCard: {
    borderRadius: 18,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  profileCardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  profileGlowOrb: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 1,
  },
  profileInitial: {
    fontSize: 26,
    color: '#FFF',
  },
  profileInfo: {
    flex: 1,
    zIndex: 1,
  },
  profileName: {
    fontSize: 21,
    color: '#FFF',
    marginBottom: 2,
  },
  profileTeamName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
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
    padding: 16,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: 64,
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
