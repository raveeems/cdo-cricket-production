import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
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
import { getApiUrl } from '@/lib/query-client';

type TabKey = 'overview' | 'scorecard' | 'players' | 'participants' | 'standings';

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

interface StandingEntry {
  rank: number;
  teamId: string;
  teamName: string;
  userId: string;
  username: string;
  userTeamName: string;
  totalPoints: number;
  playerIds: string[];
  captainId: string | null;
  viceCaptainId: string | null;
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
  const [repairingTeams, setRepairingTeams] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: matchData, isLoading: matchLoading, refetch: refetchMatch } = useQuery<{ match: Match }>({
    queryKey: ['/api/matches', id],
    enabled: !!id,
    retry: 1,
    staleTime: 5000,
    refetchInterval: (query) => {
      const status = query.state.data?.match?.status;
      const startTime = query.state.data?.match?.startTime;
      const isPastStart = startTime ? new Date(startTime).getTime() <= Date.now() : false;
      if (status === 'live' || status === 'delayed' || (status === 'upcoming' && isPastStart)) return 10000;
      if (status === 'upcoming') return 30000;
      return false;
    },
  });

  const { data: playersData, isLoading: playersLoading } = useQuery<{ players: Player[] }>({
    queryKey: ['/api/matches', id, 'players'],
    enabled: !!id,
    retry: 1,
  });

  const matchStarted = matchData?.match?.startTime ? new Date(matchData.match.startTime).getTime() <= Date.now() : false;
  const isLiveOrCompleted = matchData?.match?.status === 'live' || matchData?.match?.status === 'completed' || ((matchData?.match?.status === 'delayed' || matchData?.match?.status === 'upcoming') && matchStarted);
  const effectiveStatus = (matchData?.match?.status === 'delayed' || matchData?.match?.status === 'upcoming') && matchStarted ? 'live' : matchData?.match?.status;

  const { data: scorecardData, isLoading: scorecardLoading } = useQuery<{ scorecard: LiveScorecard | null }>({
    queryKey: ['/api/matches', id, 'live-scorecard'],
    enabled: !!id && activeTab === 'scorecard' && isLiveOrCompleted,
    refetchInterval: isLiveOrCompleted && matchData?.match?.status === 'live' ? 30000 : false,
    retry: 1,
  });

  const { data: contestData } = useQuery<{ teams: ContestTeam[]; visibility: string; players?: Player[] }>({
    queryKey: ['/api/matches', id, 'teams'],
    enabled: !!id,
    retry: 1,
  });

  const { data: standingsData } = useQuery<{ standings: StandingEntry[]; isLive: boolean; players?: Player[] }>({
    queryKey: ['/api/matches', id, 'standings'],
    enabled: !!id && isLiveOrCompleted,
    refetchInterval: isLiveOrCompleted && matchData?.match?.status !== 'completed' ? 20000 : false,
    retry: 1,
  });

  const match = matchData?.match;

  const basePlayers = playersData?.players || [];
  const standingsPlayers = standingsData?.players || [];
  const players = standingsPlayers.length > 0 ? standingsPlayers : basePlayers;
  const userTeams = id ? getTeamsForMatch(id) : [];
  const scorecard = scorecardData?.scorecard;
  const contestTeams = contestData?.teams || [];
  const contestPlayers = contestData?.players || [];
  const teamsVisibility = contestData?.visibility || 'hidden';
  const allKnownPlayers = contestPlayers.length > 0 ? contestPlayers : players;

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
      setActiveTab('standings');
    }
  }, [isLiveOrCompleted]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchMatch();
    setRefreshing(false);
  }, [refetchMatch]);

  const lastUpdatedText = match?.lastSyncAt
    ? new Date(match.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

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

  const handleRepairTeams = async () => {
    if (!match) return;
    setRepairingTeams(true);
    setRepairResult(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/matches/${match.id}/repair-teams`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setRepairResult(data.message || 'Repair complete');
    } catch {
      setRepairResult('Failed to repair teams');
    }
    setRepairingTeams(false);
  };

  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = isLiveOrCompleted ? [
    { key: 'standings', label: 'Standings', icon: 'podium-outline' },
    { key: 'scorecard', label: 'Scorecard', icon: 'stats-chart-outline' },
    { key: 'participants', label: 'Contest', icon: 'trophy-outline' },
    { key: 'players', label: 'Players', icon: 'people-outline' },
  ] : [
    { key: 'overview', label: 'Overview', icon: 'grid-outline' },
    { key: 'participants', label: 'Contest', icon: 'trophy-outline' },
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

      {user?.isAdmin && (
        <View style={[styles.adminSection, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.adminHeader}>
            <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
            <Text style={[styles.adminTitle, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>
              Admin Tools
            </Text>
          </View>

          <View style={styles.adminBtnRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleRepairTeams();
              }}
              disabled={repairingTeams}
              style={[styles.verifyBtn, { flex: 1, backgroundColor: '#f59e0b15', borderColor: '#f59e0b40' }]}
            >
              {repairingTeams ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : (
                <Ionicons name="construct" size={16} color="#f59e0b" />
              )}
              <Text style={[styles.verifyBtnText, { color: '#f59e0b', fontFamily: 'Inter_600SemiBold' }]}>
                {repairingTeams ? 'Repairing...' : 'Repair Teams'}
              </Text>
            </Pressable>
          </View>

          {repairResult && (
            <View style={[styles.verifyResultBox, { backgroundColor: isDark ? '#1a1a2e' : '#fffbeb', borderColor: '#f59e0b40' }]}>
              <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_500Medium' as const }}>
                {repairResult}
              </Text>
            </View>
          )}
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
                    {(Number(bat.sr) || 0).toFixed(1)}
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
                  <Text style={[styles.scorecardStat, { color: (Number(bowl.eco) || 0) < 7 ? colors.success : (Number(bowl.eco) || 0) > 10 ? colors.error : colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {(Number(bowl.eco) || 0).toFixed(1)}
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

  const renderStandingsTab = () => {
    const standings = standingsData?.standings || [];

    if (!isLiveOrCompleted) {
      return (
        <View style={[styles.contentSection, { alignItems: 'center', paddingTop: 40 }]}>
          <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_500Medium' as const, marginTop: 12, textAlign: 'center' }}>
            Standings will be available once the match starts
          </Text>
        </View>
      );
    }

    if (standings.length === 0) {
      return (
        <View style={[styles.contentSection, { alignItems: 'center', paddingTop: 40 }]}>
          <Ionicons name="podium-outline" size={48} color={colors.textTertiary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_500Medium' as const, marginTop: 12, textAlign: 'center' }}>
            No teams have joined this contest yet
          </Text>
        </View>
      );
    }

    const userStandings = standings.filter(s => s.userId === user?.id);
    const bestUserRank = userStandings.length > 0 ? Math.min(...userStandings.map(s => s.rank)) : null;

    return (
      <View style={styles.contentSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            Live Standings
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: effectiveStatus === 'live' ? '#22C55E' : colors.textTertiary }} />
            <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>
              {effectiveStatus === 'live' ? 'Updates every 20s' : 'Final'}
            </Text>
          </View>
        </View>

        {bestUserRank !== null && (
          <View style={[styles.yourRankCard, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.rankCircle, { backgroundColor: colors.accent }]}>
                <Text style={{ color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold' as const }}>#{bestUserRank}</Text>
              </View>
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' as const }}>Your Best Rank</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular' as const }}>
                  {userStandings.length} {userStandings.length === 1 ? 'team' : 'teams'} in contest
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.accent, fontSize: 18, fontFamily: 'Inter_700Bold' as const }}>
              {Math.max(...userStandings.map(s => s.totalPoints))} pts
            </Text>
          </View>
        )}

        <View style={[styles.standingsHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_600SemiBold' as const, width: 36, textAlign: 'center' }}>#</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_600SemiBold' as const, flex: 1 }}>Team</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_600SemiBold' as const, width: 60, textAlign: 'right' }}>Points</Text>
        </View>

        {standings.map((entry, index) => {
          const isCurrentUser = entry.userId === user?.id;
          const getRankIcon = (rank: number) => {
            if (rank === 1) return { icon: 'trophy' as const, color: '#F59E0B' };
            if (rank === 2) return { icon: 'medal' as const, color: '#94A3B8' };
            if (rank === 3) return { icon: 'medal' as const, color: '#CD7F32' };
            return null;
          };
          const rankIcon = getRankIcon(entry.rank);

          return (
            <Pressable
              key={entry.teamId}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setExpandedTeamId(expandedTeamId === entry.teamId ? null : entry.teamId);
              }}
              style={[
                styles.standingRow,
                {
                  backgroundColor: isCurrentUser ? colors.accent + '08' : colors.card,
                  borderColor: isCurrentUser ? colors.accent + '30' : colors.cardBorder,
                  borderLeftColor: isCurrentUser ? colors.accent : 'transparent',
                  borderLeftWidth: isCurrentUser ? 3 : 0,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 36, alignItems: 'center' }}>
                  {rankIcon ? (
                    <Ionicons name={rankIcon.icon} size={18} color={rankIcon.color} />
                  ) : (
                    <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_600SemiBold' as const }}>{entry.rank}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' as const }} numberOfLines={1}>
                      {entry.teamName}
                    </Text>
                    {isCurrentUser && (
                      <View style={[styles.youBadge, { backgroundColor: colors.accent + '20' }]}>
                        <Text style={{ color: colors.accent, fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>
                    {entry.userTeamName || entry.username}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: isCurrentUser ? colors.accent : colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' as const, width: 60, textAlign: 'right' }}>
                  {entry.totalPoints}
                </Text>
                <Ionicons
                  name={expandedTeamId === entry.teamId ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textTertiary}
                />
              </View>

              {expandedTeamId === entry.teamId && (
                <View style={[styles.expandedTeamDetails, { backgroundColor: colors.surface, marginTop: 8 }]}>
                  {entry.playerIds.map((pid) => {
                    const p = players.find(pl => pl.id === pid);
                    if (!p) return null;
                    const isCaptain = pid === entry.captainId;
                    const isVC = pid === entry.viceCaptainId;
                    let multipliedPts = p.points || 0;
                    if (isCaptain) multipliedPts *= 2;
                    else if (isVC) multipliedPts *= 1.5;

                    return (
                      <View key={pid} style={styles.expandedPlayerRow}>
                        <View style={[styles.miniRoleBadge, { backgroundColor: getRoleColor(p.role, isDark) + '20' }]}>
                          <Text style={{ color: getRoleColor(p.role, isDark), fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>{p.role}</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_500Medium' as const, flex: 1 }} numberOfLines={1}>
                          {p.name}
                        </Text>
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
                        <Text style={{ color: multipliedPts > 0 ? '#22C55E' : colors.textTertiary, fontSize: 12, fontFamily: 'Inter_600SemiBold' as const, width: 40, textAlign: 'right' }}>
                          {multipliedPts}
                        </Text>
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
                const teamPlayers = isExpanded ? team.playerIds.map(pid => allKnownPlayers.find(p => p.id === pid)).filter(Boolean) : [];
                const captain = isExpanded ? allKnownPlayers.find(p => p.id === team.captainId) : null;
                const viceCaptain = isExpanded ? allKnownPlayers.find(p => p.id === team.viceCaptainId) : null;
                const hasOrphanedIds = isExpanded && teamPlayers.length < team.playerIds.length;

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

                    {isExpanded && hasOrphanedIds && teamPlayers.length === 0 && (
                      <View style={[styles.expandedTeamDetails, { backgroundColor: colors.surface }]}>
                        <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' as const, textAlign: 'center', paddingVertical: 12 }}>
                          Player data being refreshed. Points will update automatically.
                        </Text>
                      </View>
                    )}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFF"
            colors={[colors.primary]}
          />
        }
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
              {(() => {
                const rawScore = (match as any).scoreString || (match as any).score_string || (match as any).score || (match as any).liveScore || (match as any).status_overview || "";
                const hasScore = rawScore && rawScore.length > 3;
                const isLiveish = effectiveStatus === 'live' || match.status === 'completed';

                const parseScore = (raw: string) => {
                  const scoreMatch = raw.match(/(\d+\/\d+)\s*\(([^)]+)\)/);
                  if (!scoreMatch) return { scoreLine: raw, statusLine: '' };
                  const scoreLine = `${scoreMatch[1]} (${scoreMatch[2]})`;
                  let statusLine = '';
                  const innMatch = raw.match(/^(.+?)\s*(?:INN|Inn|Innings?)?\s*:/i) || raw.match(/^(.+?)\s+\d+\/\d+/);
                  const teamName = innMatch ? innMatch[1].replace(/\s*\d+\s*$/, '').trim() : '';
                  const afterScore = raw.substring(raw.indexOf(scoreMatch[0]) + scoreMatch[0].length).trim();
                  const statusPart = afterScore.replace(/^[—\-•|]\s*/, '').trim();
                  const parts: string[] = [];
                  if (teamName) parts.push(teamName);
                  if (statusPart) parts.push(statusPart);
                  statusLine = parts.join(' \u2022 ');
                  return { scoreLine, statusLine };
                };

                if (isLiveish && hasScore) {
                  const { scoreLine, statusLine } = parseScore(rawScore);
                  return (
                    <View style={{ alignItems: 'center' }}>
                      <View style={styles.liveBadgeRow}>
                        <View style={[styles.liveDot, match.status === 'completed' && { backgroundColor: '#9CA3AF' }]} />
                        <Text style={[styles.liveText, { fontFamily: 'Inter_700Bold' }]}>
                          {match.status === 'completed' ? 'COMPLETED' : 'LIVE'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 26, color: '#FFFFFF', fontFamily: 'Inter_700Bold' as const, textAlign: 'center' as const, marginTop: 4, letterSpacing: 1 }} numberOfLines={1}>
                        {scoreLine}
                      </Text>
                      {statusLine ? (
                        <Text style={{ fontSize: 12, color: '#FFD130', fontFamily: 'Inter_600SemiBold' as const, textAlign: 'center' as const, marginTop: 3, maxWidth: 180 }} numberOfLines={1}>
                          {statusLine}
                        </Text>
                      ) : null}
                    </View>
                  );
                } else if (effectiveStatus === 'live') {
                  return (
                    <View style={{ alignItems: 'center' }}>
                      <View style={styles.liveBadgeRow}>
                        <View style={styles.liveDot} />
                        <Text style={[styles.liveText, { fontFamily: 'Inter_700Bold' }]}>LIVE</Text>
                      </View>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Inter_500Medium' as const, marginTop: 4, textAlign: 'center' as const }}>
                        Syncing score...
                      </Text>
                    </View>
                  );
                } else if (match.status === 'delayed') {
                  return (
                    <View style={styles.liveBadgeRow}>
                      <Ionicons name="rainy-outline" size={14} color="#F39C12" />
                      <Text style={[styles.liveText, { fontFamily: 'Inter_700Bold', color: '#F39C12' }]}>DELAYED</Text>
                    </View>
                  );
                } else {
                  return <Text style={[styles.heroVs, { fontFamily: 'Inter_700Bold' }]}>VS</Text>;
                }
              })()}
              {match.status === 'delayed' && !matchStarted && match.statusNote ? (
                <Text style={{ color: '#F39C12', fontSize: 11, fontFamily: 'Inter_500Medium' as const, textAlign: 'center' as const, marginTop: 4 }} numberOfLines={2}>
                  {match.statusNote}
                </Text>
              ) : effectiveStatus !== 'live' && match.status !== 'completed' ? (
                <View style={styles.timerPill}>
                  <Ionicons name="time" size={14} color="#FFD130" />
                  <Text style={[styles.timerPillText, { fontFamily: 'Inter_600SemiBold' }]}>
                    {timeLeft}
                  </Text>
                </View>
              ) : null}
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
        {activeTab === 'standings' && renderStandingsTab()}
        {activeTab === 'participants' && renderParticipantsTab()}
        {activeTab === 'scorecard' && renderScorecardTab()}
        {activeTab === 'players' && renderPlayersTab()}

        {isLiveOrCompleted && (
          <View style={styles.lastUpdatedRow}>
            <Text style={[styles.lastUpdatedText, { color: colors.textTertiary }]}>
              {lastUpdatedText ? `Last Updated: ${lastUpdatedText}` : 'Syncing...'}
            </Text>
          </View>
        )}
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
  heroScoreString: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 200,
  },
  lastUpdatedRow: {
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  lastUpdatedText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
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
  yourRankCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  rankCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  standingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  standingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  adminSection: {
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  adminBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  verifySubSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  adminTitle: {
    fontSize: 14,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  verifyBtnText: {
    fontSize: 14,
  },
  verifyResultBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyLabel: {
    fontSize: 13,
  },
  verifyDetails: {
    marginTop: 8,
    gap: 4,
  },
  verifyDetailText: {
    fontSize: 12,
  },
  verifyError: {
    fontSize: 13,
  },
});
