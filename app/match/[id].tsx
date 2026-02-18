import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeams } from '@/contexts/TeamContext';
import { getTimeUntilMatch, canEditTeam, getRoleColor, Match, Player, ContestTeam } from '@/lib/mock-data';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';

type TabKey = 'overview' | 'scorecard' | 'players' | 'participants';

interface ScorecardBatter {
  name: string;
  r: number;
  b: number;
  fours: number;
  sixes: number;
  sr: number;
  dismissal: string;
  fantasyPoints: number;
}

interface ScorecardBowler {
  name: string;
  o: number;
  m: number;
  r: number;
  w: number;
  eco: number;
  fantasyPoints: number;
}

interface ScorecardInning {
  inning: string;
  batting: ScorecardBatter[];
  bowling: ScorecardBowler[];
}

interface LiveScorecard {
  score: Array<{ r: number; w: number; o: number; inning: string }>;
  innings: ScorecardInning[];
  status: string;
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { getTeamsForMatch, deleteTeam } = useTeams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [timeLeft, setTimeLeft] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedInning, setSelectedInning] = useState(0);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const { data: matchData, isLoading: matchLoading } = useQuery<{ match: Match }>({
    queryKey: ['/api/matches', id],
    enabled: !!id,
  });

  const { data: playersData, isLoading: playersLoading } = useQuery<{ players: Player[] }>({
    queryKey: ['/api/matches', id, 'players'],
    enabled: !!id,
  });

  const matchStarted = matchData?.match?.startTime ? new Date(matchData.match.startTime).getTime() <= Date.now() : false;
  const isLiveOrCompleted = matchData?.match?.status === 'live' || matchData?.match?.status === 'completed' || (matchData?.match?.status === 'delayed' && matchStarted);
  const effectiveStatus = matchData?.match?.status === 'delayed' && matchStarted ? 'live' : matchData?.match?.status;

  const { data: scorecardData, isLoading: scorecardLoading } = useQuery<{ scorecard: LiveScorecard | null }>({
    queryKey: ['/api/matches', id, 'live-scorecard'],
    enabled: !!id && activeTab === 'scorecard' && isLiveOrCompleted,
    refetchInterval: isLiveOrCompleted && matchData?.match?.status === 'live' ? 30000 : false,
  });

  const { data: contestData } = useQuery<{ teams: ContestTeam[]; visibility: string }>({
    queryKey: ['/api/matches', id, 'teams'],
    enabled: !!id && activeTab === 'participants',
  });

  const match = matchData?.match;
  const players = playersData?.players || [];
  const userTeams = id ? getTeamsForMatch(id) : [];
  const scorecard = scorecardData?.scorecard;
  const contestTeams = contestData?.teams || [];
  const teamsVisibility = contestData?.visibility || 'hidden';

  const pickedPlayerNames = new Set<string>();
  for (const team of userTeams) {
    for (const pid of team.playerIds) {
      const p = players.find((pl) => pl.id === pid);
      if (p) pickedPlayerNames.add(p.name.toLowerCase());
    }
  }

  useEffect(() => {
    if (!match) return;
    setTimeLeft(getTimeUntilMatch(match.startTime, match.status));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMatch(match.startTime, match.status));
    }, 1000);
    return () => clearInterval(interval);
  }, [match?.startTime, match?.status]);

  useEffect(() => {
    if (isLiveOrCompleted) {
      setActiveTab('scorecard');
    }
  }, [isLiveOrCompleted]);

  if (matchLoading || playersLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text, fontFamily: 'Inter_500Medium' }}>Match not found</Text>
      </View>
    );
  }

  const canEdit = canEditTeam(match.startTime, match.status);
  const canCreateMore = userTeams.length < 3;
  const filledPercent = (match.spotsFilled / match.spotsTotal) * 100;
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'overview', label: 'Overview', icon: 'grid-outline' },
    { key: 'participants', label: 'Contest', icon: 'trophy-outline' },
    { key: 'scorecard', label: 'Scorecard', icon: 'stats-chart-outline' },
    { key: 'players', label: 'Players', icon: 'people-outline' },
  ];

  const renderOverviewTab = () => (
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
              {match.spotsFilled} joined
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
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/create-team/[matchId]', params: { matchId: match.id, editTeamId: team.id } });
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      deleteTeam(team.id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              )}
            </View>
            <View style={[styles.teamCardDetails, { borderTopColor: colors.border }]}>
              <Text style={[styles.teamDetailText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                {team.playerIds.length} players selected
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
    </View>
  );

  const renderScorecardTab = () => {
    if (!isLiveOrCompleted) {
      return (
        <View style={[styles.contentSection, { alignItems: 'center', paddingTop: 40 }]}>
          <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.noTeamsText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 12 }]}>
            Scorecard will be available once the match starts
          </Text>
        </View>
      );
    }

    if (scorecardLoading) {
      return (
        <View style={[styles.contentSection, { alignItems: 'center', paddingTop: 40 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.noTeamsText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 12 }]}>
            Loading scorecard...
          </Text>
        </View>
      );
    }

    if (!scorecard || !scorecard.innings || scorecard.innings.length === 0) {
      return (
        <View style={[styles.contentSection, { alignItems: 'center', paddingTop: 40 }]}>
          <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.noTeamsText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 12 }]}>
            Scorecard data not available yet
          </Text>
        </View>
      );
    }

    const currentInning = scorecard.innings[selectedInning] || scorecard.innings[0];

    return (
      <View style={styles.contentSection}>
        {scorecard.score && scorecard.score.length > 0 && (
          <View style={[styles.liveScoreBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {scorecard.score.map((s, i) => (
              <View key={i} style={styles.liveScoreItem}>
                <Text style={[styles.liveScoreInning, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
                  {s.inning}
                </Text>
                <Text style={[styles.liveScoreValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                  {s.r}/{s.w}
                </Text>
                <Text style={[styles.liveScoreOvers, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                  ({s.o} ov)
                </Text>
              </View>
            ))}
          </View>
        )}

        {effectiveStatus === 'live' && (
          <View style={[styles.liveBadgeRow, { marginBottom: 12 }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { fontFamily: 'Inter_600SemiBold' }]}>LIVE</Text>
          </View>
        )}

        {scorecard.innings.length > 1 && (
          <View style={styles.inningsTabs}>
            {scorecard.innings.map((inn, i) => (
              <Pressable
                key={i}
                onPress={() => setSelectedInning(i)}
                style={[
                  styles.inningsTab,
                  {
                    backgroundColor: selectedInning === i ? colors.primary : colors.surface,
                    borderColor: selectedInning === i ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.inningsTabText,
                    {
                      color: selectedInning === i ? '#FFF' : colors.textSecondary,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {inn.inning.length > 20 ? inn.inning.substring(0, 18) + '...' : inn.inning}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {currentInning.batting && currentInning.batting.length > 0 && (
          <>
            <View style={[styles.scorecardHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', flex: 2 }]}>
                Batter
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                R
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                B
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                4s
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                6s
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                SR
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
                FP
              </Text>
            </View>
            {currentInning.batting.map((bat, i) => {
              const isPicked = pickedPlayerNames.has(bat.name.toLowerCase());
              return (
                <View key={i} style={[styles.scorecardRow, { borderBottomColor: colors.border + '40' }, isPicked && { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scorecardName, { color: isPicked ? '#22C55E' : colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                        {bat.name}
                      </Text>
                      <Text style={[styles.scorecardDismissal, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>
                        {bat.dismissal}
                      </Text>
                    </View>
                    {isPicked && <Ionicons name="checkmark-circle" size={14} color="#22C55E" />}
                  </View>
                  <Text style={[styles.scorecardStat, { color: colors.text, fontFamily: bat.r >= 50 ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                    {bat.r}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bat.b}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bat.fours}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bat.sixes}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bat.sr.toFixed(1)}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: bat.fantasyPoints >= 30 ? colors.success : colors.accent, fontFamily: 'Inter_700Bold' }]}>
                    {bat.fantasyPoints}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {currentInning.bowling && currentInning.bowling.length > 0 && (
          <>
            <View style={[styles.scorecardHeader, { borderBottomColor: colors.border, marginTop: 20 }]}>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', flex: 2 }]}>
                Bowler
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                O
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                M
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                R
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                W
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                ECO
              </Text>
              <Text style={[styles.scorecardHeaderText, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
                FP
              </Text>
            </View>
            {currentInning.bowling.map((bowl, i) => {
              const isPicked = pickedPlayerNames.has(bowl.name.toLowerCase());
              return (
                <View key={i} style={[styles.scorecardRow, { borderBottomColor: colors.border + '40' }, isPicked && { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.scorecardName, { color: isPicked ? '#22C55E' : colors.text, fontFamily: 'Inter_600SemiBold', flex: 1 }]} numberOfLines={1}>
                      {bowl.name}
                    </Text>
                    {isPicked && <Ionicons name="checkmark-circle" size={14} color="#22C55E" />}
                  </View>
                  <Text style={[styles.scorecardStat, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bowl.o}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bowl.m}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bowl.r}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: bowl.w >= 3 ? colors.success : colors.text, fontFamily: bowl.w >= 3 ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                    {bowl.w}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: bowl.eco < 7 ? colors.success : bowl.eco > 10 ? colors.error : colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {bowl.eco.toFixed(1)}
                  </Text>
                  <Text style={[styles.scorecardStat, { color: bowl.fantasyPoints >= 30 ? colors.success : colors.accent, fontFamily: 'Inter_700Bold' }]}>
                    {bowl.fantasyPoints}
                  </Text>
                </View>
              );
            })}
          </>
        )}
      </View>
    );
  };

  const renderParticipantsTab = () => {
    const grouped: Record<string, { username: string; userTeamName: string; teams: ContestTeam[] }> = {};
    for (const t of contestTeams) {
      if (!grouped[t.userId]) {
        grouped[t.userId] = { username: t.username, userTeamName: t.userTeamName, teams: [] };
      }
      grouped[t.userId].teams.push(t);
    }
    const participants = Object.entries(grouped);
    const canViewDetails = teamsVisibility === 'full';

    if (participants.length === 0) {
      return (
        <View style={[styles.contentSection, { alignItems: 'center', paddingTop: 40 }]}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.noTeamsText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 12 }]}>
            No one has joined this contest yet
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.contentSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            {participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
          </Text>
        </View>

        {!canViewDetails && (
          <View style={[styles.visibilityNote, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Inter_500Medium' as const, flex: 1 }}>
              Team details will be visible after the first ball is bowled
            </Text>
          </View>
        )}

        {participants.map(([userId, data]) => {
          const isCurrentUser = userId === user?.id;
          return (
            <View key={userId} style={[styles.participantCard, { backgroundColor: colors.card, borderColor: isCurrentUser ? colors.accent + '60' : colors.cardBorder }]}>
              <View style={styles.participantHeader}>
                <View style={styles.participantInfo}>
                  <View style={[styles.participantAvatar, { backgroundColor: isCurrentUser ? colors.accent + '20' : colors.primary + '20' }]}>
                    <Text style={{ color: isCurrentUser ? colors.accent : colors.primary, fontSize: 14, fontFamily: 'Inter_700Bold' as const }}>
                      {data.username[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' as const }}>
                        {data.userTeamName || data.username}
                      </Text>
                      {isCurrentUser && (
                        <View style={[styles.youBadge, { backgroundColor: colors.accent + '20' }]}>
                          <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'Inter_700Bold' as const }}>YOU</Text>
                        </View>
                      )}
                    </View>
                    {data.userTeamName ? (
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>
                        @{data.username}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.teamCountBadge, { backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_600SemiBold' as const }}>
                    {data.teams.length} {data.teams.length === 1 ? 'team' : 'teams'}
                  </Text>
                </View>
              </View>

              {data.teams.map((team) => {
                const isExpanded = expandedTeamId === team.id && canViewDetails;
                const teamPlayers = isExpanded ? team.playerIds.map(pid => players.find(p => p.id === pid)).filter(Boolean) : [];
                const captain = isExpanded ? players.find(p => p.id === team.captainId) : null;
                const viceCaptain = isExpanded ? players.find(p => p.id === team.viceCaptainId) : null;

                return (
                  <Pressable
                    key={team.id}
                    onPress={() => {
                      if (canViewDetails) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setExpandedTeamId(expandedTeamId === team.id ? null : team.id);
                      }
                    }}
                    style={[styles.contestTeamRow, { borderTopColor: colors.border }]}
                  >
                    <View style={styles.contestTeamHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="shield-outline" size={16} color={colors.textSecondary} />
                        <Text style={{ color: colors.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' as const }}>
                          {team.name}
                        </Text>
                      </View>
                      {canViewDetails && (
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={colors.textTertiary}
                        />
                      )}
                    </View>

                    {isExpanded && teamPlayers.length > 0 && (
                      <View style={[styles.expandedTeamDetails, { backgroundColor: colors.surface }]}>
                        {captain && (
                          <View style={styles.cvRow}>
                            <View style={[styles.cvBadge, { backgroundColor: colors.accent + '20' }]}>
                              <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'Inter_700Bold' as const }}>C</Text>
                            </View>
                            <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_500Medium' as const }}>{captain.name}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>({captain.teamShort})</Text>
                          </View>
                        )}
                        {viceCaptain && (
                          <View style={styles.cvRow}>
                            <View style={[styles.cvBadge, { backgroundColor: colors.primary + '20' }]}>
                              <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' as const }}>VC</Text>
                            </View>
                            <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_500Medium' as const }}>{viceCaptain.name}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>({viceCaptain.teamShort})</Text>
                          </View>
                        )}
                        <View style={{ height: 8 }} />
                        {teamPlayers.map((p) => {
                          if (!p) return null;
                          const isCaptain = p.id === team.captainId;
                          const isVC = p.id === team.viceCaptainId;
                          return (
                            <View key={p.id} style={styles.expandedPlayerRow}>
                              <View style={[styles.miniRoleBadge, { backgroundColor: getRoleColor(p.role, isDark) + '20' }]}>
                                <Text style={{ color: getRoleColor(p.role, isDark), fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>{p.role}</Text>
                              </View>
                              <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_500Medium' as const, flex: 1 }} numberOfLines={1}>
                                {p.name}
                              </Text>
                              <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>{p.teamShort}</Text>
                              {isCaptain && (
                                <View style={[styles.miniCVBadge, { backgroundColor: colors.accent + '30' }]}>
                                  <Text style={{ color: colors.accent, fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>C</Text>
                                </View>
                              )}
                              {isVC && (
                                <View style={[styles.miniCVBadge, { backgroundColor: colors.primary + '30' }]}>
                                  <Text style={{ color: colors.primary, fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>VC</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  const renderPlayersTab = () => {
    const playingXI = players.filter((p) => p.isPlayingXI);
    const bench = players.filter((p) => !p.isPlayingXI);
    const hasPlayingXI = playingXI.length > 0;

    const renderPlayerCard = (player: Player) => (
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
    );

    return (
      <View style={styles.contentSection}>
        {hasPlayingXI ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.playingXIBadge, { backgroundColor: colors.success + '20' }]}>
                  <View style={[styles.playingXIDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.playingXIText, { color: colors.success, fontFamily: 'Inter_700Bold' }]}>
                    Playing XI
                  </Text>
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                  ({playingXI.length})
                </Text>
              </View>
            </View>
            {playingXI.map(renderPlayerCard)}

            {bench.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                    Bench ({bench.length})
                  </Text>
                </View>
                {bench.map(renderPlayerCard)}
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                Squad ({players.length})
              </Text>
            </View>
            {players.map(renderPlayerCard)}
          </>
        )}
      </View>
    );
  };

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
              {effectiveStatus === 'live' ? (
                <View style={styles.liveBadgeRow}>
                  <View style={styles.liveDot} />
                  <Text style={[styles.liveText, { fontFamily: 'Inter_700Bold' }]}>LIVE</Text>
                </View>
              ) : match.status === 'delayed' ? (
                <View style={styles.liveBadgeRow}>
                  <Ionicons name="rainy-outline" size={14} color="#F39C12" />
                  <Text style={[styles.liveText, { fontFamily: 'Inter_700Bold', color: '#F39C12' }]}>DELAYED</Text>
                </View>
              ) : (
                <Text style={[styles.heroVs, { fontFamily: 'Inter_700Bold' }]}>VS</Text>
              )}
              {match.status === 'delayed' && !matchStarted && match.statusNote ? (
                <Text style={{ color: '#F39C12', fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
                  {match.statusNote}
                </Text>
              ) : (
                <View style={styles.timerPill}>
                  <Ionicons name="time" size={14} color="#FFD130" />
                  <Text style={[styles.timerPillText, { fontFamily: 'Inter_600SemiBold' }]}>
                    {timeLeft}
                  </Text>
                </View>
              )}
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

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.key);
              }}
              style={[
                styles.tabItem,
                activeTab === tab.key && { borderBottomColor: colors.accent, borderBottomWidth: 3 },
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.key ? colors.accent : colors.textTertiary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === tab.key ? colors.accent : colors.textTertiary,
                    fontFamily: activeTab === tab.key ? 'Inter_700Bold' : 'Inter_500Medium',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'participants' && renderParticipantsTab()}
        {activeTab === 'scorecard' && renderScorecardTab()}
        {activeTab === 'players' && renderPlayersTab()}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 13,
    color: '#EF4444',
    letterSpacing: 1,
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
  liveScoreBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 16,
  },
  liveScoreItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  liveScoreInning: {
    fontSize: 11,
  },
  liveScoreValue: {
    fontSize: 20,
  },
  liveScoreOvers: {
    fontSize: 11,
  },
  inningsTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  inningsTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  inningsTabText: {
    fontSize: 12,
  },
  scorecardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  scorecardHeaderText: {
    fontSize: 11,
    flex: 1,
    textAlign: 'center',
  },
  scorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scorecardName: {
    fontSize: 13,
  },
  scorecardDismissal: {
    fontSize: 10,
    marginTop: 2,
  },
  scorecardStat: {
    fontSize: 13,
    flex: 1,
    textAlign: 'center',
  },
  playingXIBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  playingXIDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playingXIText: {
    fontSize: 12,
  },
  visibilityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  participantCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  teamCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contestTeamRow: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  contestTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedTeamDetails: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  cvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cvBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  miniRoleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 30,
    alignItems: 'center',
  },
  miniCVBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
