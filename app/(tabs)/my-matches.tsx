import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeams } from '@/contexts/TeamContext';
import { getTimeUntilMatch, Match } from '@/lib/mock-data';

export default function MyMatchesScreen() {
  const { colors } = useTheme();
  const { teams } = useTeams();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery<{ matches: Match[] }>({
    queryKey: ['/api/matches'],
    refetchInterval: (query) => {
      const matches = query.state.data?.matches || [];
      const now = Date.now();
      const hasLive = matches.some(m => {
        const started = new Date(m.startTime).getTime() <= now;
        return m.status === 'live' || ((m.status === 'delayed' || m.status === 'upcoming') && started);
      });
      return hasLive ? 10000 : 60000;
    },
  });

  const allMatches = data?.matches || [];

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const matchesWithTeams = allMatches.filter((m) =>
    teams.some((t) => t.matchId === m.id)
  );

  const userTeamsByMatch = matchesWithTeams.map((match) => ({
    match,
    teams: teams.filter((t) => t.matchId === match.id),
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8, paddingHorizontal: 16 }}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            My Matches
          </Text>

          {isLoading ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : userTeamsByMatch.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="cricket" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                No teams yet
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Create your first team from upcoming matches
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)');
                }}
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.emptyButtonText, { fontFamily: 'Inter_600SemiBold' }]}>
                  View Matches
                </Text>
              </Pressable>
            </View>
          ) : (
            userTeamsByMatch.map(({ match, teams: matchTeams }) => (
              <Pressable
                key={match.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/match/[id]', params: { id: match.id } });
                }}
                style={[styles.matchItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <View style={styles.matchItemHeader}>
                  <View style={styles.teamRow}>
                    <View style={[styles.teamDot, { backgroundColor: match.team1Color }]} />
                    <Text style={[styles.teamName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                      {match.team1Short}
                    </Text>
                    {(() => {
                      const rawS = (match as any).scoreString || "";
                      const started = new Date(match.startTime).getTime() <= Date.now();
                      const eff = (match.status === 'delayed' || match.status === 'upcoming') && started ? 'live' : match.status;
                      if (eff === 'live' && rawS.length > 3) {
                        const segs = rawS.split(/\s*\|\s*/);
                        const last = segs[segs.length - 1].replace(/\s*[—\-]\s*.+$/, '').trim();
                        const sm = last.match(/(\d+\/\d+)\s*\(([^)]+)\)/);
                        if (sm) {
                          return (
                            <View style={{ alignItems: 'center', marginHorizontal: 4 }}>
                              <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'Inter_700Bold' as const }}>{sm[1]}</Text>
                              <Text style={{ fontSize: 9, color: colors.textTertiary, fontFamily: 'Inter_400Regular' as const }}>{sm[2].trim()}</Text>
                            </View>
                          );
                        }
                      }
                      return (
                        <Text style={[styles.vsSmall, { color: colors.textTertiary, fontFamily: 'Inter_500Medium' }]}>vs</Text>
                      );
                    })()}
                    <Text style={[styles.teamName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                      {match.team2Short}
                    </Text>
                    <View style={[styles.teamDot, { backgroundColor: match.team2Color }]} />
                  </View>
                  {(() => {
                    const rawScore = (match as any).scoreString || "";
                    const matchStarted = new Date(match.startTime).getTime() <= Date.now();
                    const effectiveStatus = (match.status === 'delayed' || match.status === 'upcoming') && matchStarted ? 'live' : match.status;
                    const showLiveScore = effectiveStatus === 'live' && rawScore.length > 3;
                    const scoreSegments = rawScore.split(/\s*\|\s*/);
                    const lastSeg = showLiveScore ? scoreSegments[scoreSegments.length - 1].replace(/\s*[—\-]\s*.+$/, '').trim() : '';
                    const scoreInfo = showLiveScore ? lastSeg.match(/(\d+\/\d+)\s*\(([^)]+)\)/) : null;
                    if (effectiveStatus === 'live') {
                      return (
                        <View style={[styles.timerBadge, { backgroundColor: '#EF444418', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }]}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                          <Text style={[styles.timerSmall, { color: '#EF4444', fontFamily: 'Inter_700Bold' }]}>LIVE</Text>
                        </View>
                      );
                    } else if (effectiveStatus === 'completed') {
                      return (
                        <View style={[styles.timerBadge, { backgroundColor: '#22C55E18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }]}>
                          <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                          <Text style={[styles.timerSmall, { color: '#22C55E', fontFamily: 'Inter_600SemiBold' }]}>Completed</Text>
                        </View>
                      );
                    } else if (match.status === 'delayed') {
                      return (
                        <View style={[styles.timerBadge, { backgroundColor: '#F39C1218', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }]}>
                          <Ionicons name="rainy-outline" size={12} color="#F39C12" />
                          <Text style={[styles.timerSmall, { color: '#F39C12', fontFamily: 'Inter_600SemiBold' }]}>Delayed</Text>
                        </View>
                      );
                    } else {
                      return (
                        <View style={styles.timerBadge}>
                          <Ionicons name="time-outline" size={12} color={colors.accent} />
                          <Text style={[styles.timerSmall, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
                            {getTimeUntilMatch(match.startTime)}
                          </Text>
                        </View>
                      );
                    }
                  })()}
                </View>

                <View style={[styles.teamsListSection, { borderTopColor: colors.border }]}>
                  {matchTeams.map((team, idx) => (
                    <View key={team.id} style={styles.teamEntry}>
                      <View style={styles.teamEntryLeft}>
                        <View style={[styles.teamNumberBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.teamNumber, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
                            T{idx + 1}
                          </Text>
                        </View>
                        <Text style={[styles.teamEntryName, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                          {team.name}
                        </Text>
                      </View>
                      <Text style={[styles.teamPoints, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                        {team.playerIds.length} players
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
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
  pageTitle: {
    fontSize: 24,
    marginBottom: 20,
    paddingHorizontal: 4,
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
  emptyButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 14,
  },
  matchItem: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  matchItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamName: {
    fontSize: 15,
  },
  vsSmall: {
    fontSize: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerSmall: {
    fontSize: 12,
  },
  teamsListSection: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  teamEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamEntryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamNumberBadge: {
    width: 32,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamNumber: {
    fontSize: 12,
  },
  teamEntryName: {
    fontSize: 14,
  },
  teamPoints: {
    fontSize: 12,
  },
});
