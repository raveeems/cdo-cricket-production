import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamContext';
import { MOCK_MATCHES, getTimeUntilMatch, isMatchVisible, Match } from '@/lib/mock-data';
import { LinearGradient } from 'expo-linear-gradient';

function MatchCard({ match, teamsCount }: { match: Match; teamsCount: number }) {
  const { colors } = useTheme();
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMatch(match.startTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMatch(match.startTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [match.startTime]);

  const filledPercent = (match.spotsFilled / match.spotsTotal) * 100;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/match/[id]', params: { id: match.id } });
      }}
      style={({ pressed }) => [
        styles.matchCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.matchHeader}>
        <View style={[styles.leagueBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.leagueText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            {match.league}
          </Text>
        </View>
        <View style={styles.timerContainer}>
          <Ionicons name="time-outline" size={14} color={colors.accent} />
          <Text style={[styles.timerText, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
            {timeLeft}
          </Text>
        </View>
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamInfo}>
          <View style={[styles.teamCircle, { backgroundColor: match.team1Color }]}>
            <Text style={[styles.teamInitial, { fontFamily: 'Inter_700Bold' }]}>
              {match.team1Short[0]}
            </Text>
          </View>
          <Text style={[styles.teamShort, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            {match.team1Short}
          </Text>
          <Text style={[styles.teamFull, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>
            {match.team1}
          </Text>
        </View>

        <View style={styles.vsContainer}>
          <Text style={[styles.vsText, { color: colors.textTertiary, fontFamily: 'Inter_700Bold' }]}>
            VS
          </Text>
        </View>

        <View style={[styles.teamInfo, { alignItems: 'flex-end' }]}>
          <View style={[styles.teamCircle, { backgroundColor: match.team2Color }]}>
            <Text style={[styles.teamInitial, { fontFamily: 'Inter_700Bold' }]}>
              {match.team2Short[0]}
            </Text>
          </View>
          <Text style={[styles.teamShort, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            {match.team2Short}
          </Text>
          <Text style={[styles.teamFull, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>
            {match.team2}
          </Text>
        </View>
      </View>

      <View style={[styles.matchFooter, { borderTopColor: colors.border }]}>
        <View style={styles.prizeSection}>
          <MaterialCommunityIcons name="trophy-variant" size={16} color={colors.accent} />
          <Text style={[styles.prizeText, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            {match.totalPrize}
          </Text>
        </View>

        <View style={styles.spotsSection}>
          <View style={[styles.spotsBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.spotsFill,
                {
                  width: `${filledPercent}%`,
                  backgroundColor: filledPercent > 80 ? colors.error : colors.success,
                },
              ]}
            />
          </View>
          <Text style={[styles.spotsText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {match.spotsTotal - match.spotsFilled} spots left
          </Text>
        </View>

        {teamsCount > 0 && (
          <View style={[styles.teamsBadge, { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.teamsCountText, { color: colors.success, fontFamily: 'Inter_600SemiBold' }]}>
              {teamsCount} team{teamsCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { getTeamsForMatch } = useTeams();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const visibleMatches = MOCK_MATCHES.filter((m) => isMatchVisible(m.startTime));

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
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
            colors={[colors.primary, '#1E40AF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerCard}
          >
            <View style={styles.bannerContent}>
              <Text style={[styles.bannerTitle, { fontFamily: 'Inter_700Bold' }]}>
                IPL Season 2026
              </Text>
              <Text style={[styles.bannerSubtitle, { fontFamily: 'Inter_400Regular' }]}>
                Create your dream team and compete with friends
              </Text>
            </View>
            <MaterialCommunityIcons name="cricket" size={48} color="rgba(255,255,255,0.3)" />
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Upcoming Matches
            </Text>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          </View>

          {visibleMatches.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                No matches right now
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Matches appear here 48 hours before they start
              </Text>
            </View>
          ) : (
            visibleMatches.map((match) => (
              <MatchCard
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
  matchCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  leagueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leagueText: {
    fontSize: 11,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 13,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  teamInfo: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  teamCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitial: {
    fontSize: 20,
    color: '#FFF',
  },
  teamShort: {
    fontSize: 16,
  },
  teamFull: {
    fontSize: 11,
    textAlign: 'center',
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 14,
    letterSpacing: 2,
  },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  prizeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prizeText: {
    fontSize: 14,
  },
  spotsSection: {
    flex: 1,
    gap: 4,
  },
  spotsBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  spotsFill: {
    height: '100%',
    borderRadius: 2,
  },
  spotsText: {
    fontSize: 11,
  },
  teamsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  teamsCountText: {
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
