import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeams } from '@/contexts/TeamContext';
import { MOCK_MATCHES, MOCK_PLAYERS, getTimeUntilMatch, canEditTeam, getRoleColor } from '@/lib/mock-data';
import { LinearGradient } from 'expo-linear-gradient';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { getTeamsForMatch, deleteTeam } = useTeams();
  const insets = useSafeAreaInsets();
  const [timeLeft, setTimeLeft] = useState('');

  const match = MOCK_MATCHES.find((m) => m.id === id);
  const players = id ? (MOCK_PLAYERS[id] || []) : [];
  const userTeams = id ? getTeamsForMatch(id) : [];

  useEffect(() => {
    if (!match) return;
    setTimeLeft(getTimeUntilMatch(match.startTime));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMatch(match.startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [match?.startTime]);

  if (!match) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text, fontFamily: 'Inter_500Medium' }}>Match not found</Text>
      </View>
    );
  }

  const canEdit = canEditTeam(match.startTime);
  const canCreateMore = userTeams.length < 3;
  const filledPercent = (match.spotsFilled / match.spotsTotal) * 100;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primary, '#1E40AF']}
          style={[styles.hero, { paddingTop: insets.top + webTopInset + 8 }]}
        >
          <View style={styles.heroHeader}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </Pressable>
            <Text style={[styles.heroLeague, { fontFamily: 'Inter_500Medium' }]}>
              {match.league}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.heroTeams}>
            <View style={styles.heroTeamInfo}>
              <View style={[styles.heroTeamCircle, { backgroundColor: match.team1Color }]}>
                <Text style={[styles.heroTeamInitial, { fontFamily: 'Inter_700Bold' }]}>
                  {match.team1Short[0]}
                </Text>
              </View>
              <Text style={[styles.heroTeamShort, { fontFamily: 'Inter_700Bold' }]}>
                {match.team1Short}
              </Text>
            </View>

            <View style={styles.heroCenter}>
              <Text style={[styles.heroVs, { fontFamily: 'Inter_700Bold' }]}>VS</Text>
              <View style={styles.timerPill}>
                <Ionicons name="time" size={14} color="#FFD130" />
                <Text style={[styles.timerPillText, { fontFamily: 'Inter_600SemiBold' }]}>
                  {timeLeft}
                </Text>
              </View>
            </View>

            <View style={[styles.heroTeamInfo, { alignItems: 'flex-end' }]}>
              <View style={[styles.heroTeamCircle, { backgroundColor: match.team2Color }]}>
                <Text style={[styles.heroTeamInitial, { fontFamily: 'Inter_700Bold' }]}>
                  {match.team2Short[0]}
                </Text>
              </View>
              <Text style={[styles.heroTeamShort, { fontFamily: 'Inter_700Bold' }]}>
                {match.team2Short}
              </Text>
            </View>
          </View>

          <View style={styles.heroMeta}>
            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={[styles.heroVenue, { fontFamily: 'Inter_400Regular' }]}>
              {match.venue}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.contentSection}>
          <View style={styles.contestRow}>
            <View style={[styles.contestCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.contestHeader}>
                <Text style={[styles.contestLabel, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Prize Pool
                </Text>
                <Text style={[styles.contestValue, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>
                  {match.totalPrize}
                </Text>
              </View>
              <View style={[styles.contestBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.contestBarFill,
                    {
                      width: `${filledPercent}%`,
                      backgroundColor: filledPercent > 80 ? colors.error : colors.success,
                    },
                  ]}
                />
              </View>
              <View style={styles.contestMeta}>
                <Text style={[styles.contestMetaText, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                  {match.spotsFilled}/{match.spotsTotal} joined
                </Text>
                <Text style={[styles.contestMetaText, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                  Entry: {match.entryFee} coins
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Your Teams ({userTeams.length}/3)
            </Text>
          </View>

          {userTeams.length === 0 ? (
            <View style={[styles.noTeams, { backgroundColor: colors.surface }]}>
              <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.noTeamsText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                Create your first team for this match
              </Text>
            </View>
          ) : (
            userTeams.map((team, idx) => (
              <View
                key={team.id}
                style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <View style={styles.teamCardHeader}>
                  <View style={styles.teamCardLeft}>
                    <View style={[styles.teamBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.teamBadgeText, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
                        T{idx + 1}
                      </Text>
                    </View>
                    <Text style={[styles.teamCardName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                      {team.name}
                    </Text>
                  </View>
                  {canEdit && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        deleteTeam(team.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                  )}
                </View>
                <View style={[styles.teamCardDetails, { borderTopColor: colors.border }]}>
                  <Text style={[styles.teamDetailText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {team.players.length} players selected
                  </Text>
                  <View style={styles.captainRow}>
                    <Text style={[styles.captainLabel, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
                      C
                    </Text>
                    <Text style={[styles.captainName, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                      {players.find((p) => p.id === team.captainId)?.name || 'N/A'}
                    </Text>
                    <Text style={[styles.captainLabel, { color: colors.primary, fontFamily: 'Inter_600SemiBold', marginLeft: 12 }]}>
                      VC
                    </Text>
                    <Text style={[styles.captainName, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                      {players.find((p) => p.id === team.viceCaptainId)?.name || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}

          {canEdit && canCreateMore && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: '/create-team/[matchId]', params: { matchId: match.id } });
              }}
              style={styles.createTeamBtn}
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createTeamGradient}
              >
                <Ionicons name="add" size={22} color="#000" />
                <Text style={[styles.createTeamText, { fontFamily: 'Inter_700Bold' }]}>
                  Create Team
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {!canEdit && (
            <View style={[styles.deadlinePassed, { backgroundColor: colors.error + '15' }]}>
              <Ionicons name="lock-closed" size={18} color={colors.error} />
              <Text style={[styles.deadlineText, { color: colors.error, fontFamily: 'Inter_500Medium' }]}>
                Entry deadline has passed
              </Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Players
            </Text>
          </View>

          {players.slice(0, 12).map((player) => (
            <View
              key={player.id}
              style={[styles.playerRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <View style={styles.playerLeft}>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(player.role, isDark) + '20' }]}>
                  <Text style={[styles.roleText, { color: getRoleColor(player.role, isDark), fontFamily: 'Inter_700Bold' }]}>
                    {player.role}
                  </Text>
                </View>
                <View>
                  <View style={styles.playerNameRow}>
                    <Text style={[styles.playerName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                      {player.name}
                    </Text>
                    {player.isImpactPlayer && (
                      <View style={[styles.impactBadge, { backgroundColor: colors.warning + '20' }]}>
                        <MaterialCommunityIcons name="lightning-bolt" size={10} color={colors.warning} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.playerTeam, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                    {player.teamShort} | {player.credits} Cr
                  </Text>
                </View>
              </View>
              <View style={styles.playerRight}>
                <Text style={[styles.playerPoints, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                  {player.points}
                </Text>
                <Text style={[styles.playerPointsLabel, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                  pts
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLeague: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  heroTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroTeamInfo: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  heroTeamCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTeamInitial: {
    fontSize: 24,
    color: '#FFF',
  },
  heroTeamShort: {
    fontSize: 18,
    color: '#FFF',
  },
  heroCenter: {
    alignItems: 'center',
    gap: 8,
  },
  heroVs: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerPillText: {
    fontSize: 13,
    color: '#FFD130',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  heroVenue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  contestRow: {
    marginBottom: 20,
  },
  contestCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  contestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contestLabel: {
    fontSize: 13,
  },
  contestValue: {
    fontSize: 22,
  },
  contestBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  contestBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  contestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contestMetaText: {
    fontSize: 12,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  noTeams: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  noTeamsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  teamCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  teamCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamBadge: {
    width: 36,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamBadgeText: {
    fontSize: 13,
  },
  teamCardName: {
    fontSize: 15,
  },
  teamCardDetails: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  teamDetailText: {
    fontSize: 12,
  },
  captainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  captainLabel: {
    fontSize: 12,
  },
  captainName: {
    fontSize: 12,
  },
  createTeamBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  createTeamGradient: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
  },
  createTeamText: {
    fontSize: 16,
    color: '#000',
  },
  deadlinePassed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  deadlineText: {
    fontSize: 14,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  roleText: {
    fontSize: 10,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerName: {
    fontSize: 14,
  },
  impactBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playerTeam: {
    fontSize: 11,
    marginTop: 2,
  },
  playerRight: {
    alignItems: 'flex-end',
  },
  playerPoints: {
    fontSize: 16,
  },
  playerPointsLabel: {
    fontSize: 10,
  },
});
