import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamContext';
import { getTimeUntilMatch, Match } from '@/lib/mock-data';
import { queryClient } from '@/lib/query-client';
import { LinearGradient } from 'expo-linear-gradient';

interface MatchWithParticipants extends Match {
  participantCount?: number;
}

function CompactMatchCard({ match, teamsCount }: { match: MatchWithParticipants; teamsCount: number }) {
  const { colors } = useTheme();
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMatch(match.startTime, match.status));
  const matchStarted = new Date(match.startTime).getTime() <= Date.now();
  const effectiveStatus = match.status === 'delayed' && matchStarted ? 'live' : match.status;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMatch(match.startTime, match.status));
    }, 60000);
    return () => clearInterval(interval);
  }, [match.startTime, match.status]);

  const participants = match.participantCount ?? 0;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/match/[id]', params: { id: match.id } });
      }}
      style={({ pressed }) => [
        styles.compactCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.compactTop}>
        <Text style={[styles.compactLeague, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
          {match.league}
        </Text>
        {effectiveStatus === 'live' ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.error + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.statusText, { color: colors.error, fontFamily: 'Inter_700Bold' }]}>
              LIVE
            </Text>
          </View>
        ) : match.status === 'delayed' ? (
          <View style={[styles.statusBadge, { backgroundColor: '#F39C12' + '18' }]}>
            <Ionicons name="rainy-outline" size={11} color="#F39C12" style={{ marginRight: 3 }} />
            <Text style={[styles.statusText, { color: '#F39C12', fontFamily: 'Inter_700Bold' }]}>
              DELAYED
            </Text>
          </View>
        ) : effectiveStatus === 'completed' ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.textTertiary + '18' }]}>
            <Text style={[styles.statusText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
              Done
            </Text>
          </View>
        ) : (
          <View style={styles.timerRow}>
            <Ionicons name="time-outline" size={12} color={colors.accent} />
            <Text style={[styles.timerVal, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
              {timeLeft}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.compactTeams}>
        <View style={styles.compactTeamSide}>
          <View style={[styles.compactCircle, { backgroundColor: match.team1Color }]}>
            <Text style={[styles.compactInitial, { fontFamily: 'Inter_700Bold' }]}>
              {match.team1Short[0]}
            </Text>
          </View>
          <Text style={[styles.compactShort, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            {match.team1Short}
          </Text>
        </View>

        <Text style={[styles.compactVs, { color: colors.textTertiary, fontFamily: 'Inter_600SemiBold' }]}>
          vs
        </Text>

        <View style={[styles.compactTeamSide, { alignItems: 'flex-end' as const }]}>
          <View style={[styles.compactCircle, { backgroundColor: match.team2Color }]}>
            <Text style={[styles.compactInitial, { fontFamily: 'Inter_700Bold' }]}>
              {match.team2Short[0]}
            </Text>
          </View>
          <Text style={[styles.compactShort, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            {match.team2Short}
          </Text>
        </View>
      </View>

      <View style={[styles.compactBottom, { borderTopColor: colors.border }]}>
        {participants > 0 && (
          <View style={styles.participantInfo}>
            <Ionicons name="people" size={13} color={colors.primary} />
            <Text style={[styles.participantText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
              {participants} team{participants !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        {teamsCount > 0 && (
          <View style={[styles.myTeamBadge, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            <Text style={[styles.myTeamText, { color: colors.success, fontFamily: 'Inter_600SemiBold' }]}>
              {teamsCount} joined
            </Text>
          </View>
        )}
        {participants === 0 && teamsCount === 0 && (
          <Text style={[styles.noParticipants, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
            No entries yet
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const AUTO_REFRESH_INTERVAL = 2 * 60 * 60 * 1000;

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { getTeamsForMatch } = useTeams();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useQuery<{ matches: MatchWithParticipants[] }>({
    queryKey: ['/api/matches'],
    refetchInterval: AUTO_REFRESH_INTERVAL,
  });

  const visibleMatches = data?.matches || [];

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8 }}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Welcome back,
              </Text>
              <Text style={[styles.username, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                {user?.username || 'Player'}
              </Text>
            </View>
            {user?.isAdmin && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/admin');
                }}
                style={[styles.adminBtn, { backgroundColor: colors.primary + '20' }]}
              >
                <Ionicons name="settings" size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>

          <LinearGradient
            colors={[colors.primary, '#003D7A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerCard}
          >
            <View style={styles.bannerContent}>
              <Text style={[styles.bannerTitle, { fontFamily: 'Inter_700Bold' }]}>
                CDO Fantasy Cricket
              </Text>
              <Text style={[styles.bannerSubtitle, { fontFamily: 'Inter_400Regular' }]}>
                Create your dream team and compete with friends
              </Text>
            </View>
            <MaterialCommunityIcons name="cricket" size={48} color="rgba(255,255,255,0.3)" />
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Matches
            </Text>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          </View>

          {isLoading ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : visibleMatches.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                No matches right now
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Matches appear when contests are entered or close to start time
              </Text>
            </View>
          ) : (
            visibleMatches.map((match) => (
              <CompactMatchCard
                key={match.id}
                match={match}
                teamsCount={getTeamsForMatch(match.id).length}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  greeting: {
    fontSize: 14,
  },
  username: {
    fontSize: 24,
  },
  adminBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 20,
    color: '#FFF',
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  compactTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  compactLeague: {
    fontSize: 10,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timerVal: {
    fontSize: 11,
  },
  compactTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compactTeamSide: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  compactCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactInitial: {
    fontSize: 15,
    color: '#FFF',
  },
  compactShort: {
    fontSize: 13,
  },
  compactVs: {
    fontSize: 11,
    paddingHorizontal: 10,
    letterSpacing: 1,
  },
  compactBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participantText: {
    fontSize: 11,
  },
  myTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myTeamText: {
    fontSize: 10,
  },
  noParticipants: {
    fontSize: 11,
  },
  emptyState: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
