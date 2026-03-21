import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
  Image,
  Animated,
} from 'react-native';
import { SkeletonBox } from '@/components/SkeletonBox';
import { getTeamLogo } from '@/utils/teamLogo';
import { getMatchBanter } from '@/utils/getMatchBanter';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamContext';
import { getTimeUntilMatch, Match } from '@/lib/mock-data';
import { injectDevMockMatches } from '@/lib/dev-mock-matches';
import { queryClient } from '@/lib/query-client';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

type AppColors = typeof Colors.dark;

interface MatchWithParticipants extends Match {
  participantCount?: number;
}

const isWeb = Platform.OS === 'web';

function LivePulseDot({ color }: { color: string }) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.9, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          transform: [{ scale: pulseScale }],
          opacity: pulseOpacity,
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

function CompactCardSkeleton({ colors }: { colors: AppColors }) {
  return (
    <View style={{
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      marginBottom: 12,
      overflow: 'hidden',
      padding: 14,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <SkeletonBox width="30%" height={10} borderRadius={5} />
        <SkeletonBox width={60} height={20} borderRadius={6} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
        <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
          <SkeletonBox width={44} height={44} borderRadius={22} />
          <SkeletonBox width={40} height={12} borderRadius={5} />
        </View>
        <SkeletonBox width={36} height={36} borderRadius={18} />
        <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
          <SkeletonBox width={44} height={44} borderRadius={22} />
          <SkeletonBox width={40} height={12} borderRadius={5} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <SkeletonBox width="40%" height={16} borderRadius={6} />
        <SkeletonBox width={50} height={22} borderRadius={6} />
      </View>
    </View>
  );
}

function CompactMatchCard({ match, teamsCount }: { match: MatchWithParticipants; teamsCount: number }) {
  const { colors, isDark } = useTheme();
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMatch(match.startTime, match.status));
  const matchStarted = new Date(match.startTime).getTime() <= Date.now();
  const effectiveStatus = (match.status === 'delayed' || match.status === 'upcoming') && matchStarted ? 'live' : match.status;
  const logo1 = getTeamLogo(match.team1Short);
  const logo2 = getTeamLogo(match.team2Short);
  const [banter] = useState<string | null>(() => getMatchBanter(match.team1Short, match.team2Short));
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMatch(match.startTime, match.status));
    }, 60000);
    return () => clearInterval(interval);
  }, [match.startTime, match.status]);

  const participants = match.participantCount ?? 0;
  const isLive = effectiveStatus === 'live';

  const webHoverProps = isWeb ? {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  } : {};

  const isMockMatch = __DEV__ && match.id.startsWith('mock-');

  return (
    <Pressable
      onPress={() => {
        if (isMockMatch) {
          console.log('[DEV] Mock match card tapped:', match.id);
          console.log('[DEV] Navigating to route: /(tabs)/match/[id] with id =', match.id);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/(tabs)/match/[id]', params: { id: match.id } });
      }}
      style={({ pressed }) => [
        styles.compactCard,
        {
          backgroundColor: hovered ? colors.cardHover : colors.card,
          borderColor: isLive ? colors.live + '40' : (hovered ? colors.accent + '30' : colors.cardBorder),
          borderWidth: isLive ? 1.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...(isWeb ? { cursor: 'pointer' as any, transition: 'all 0.2s ease' as any } : {}),
        },
      ]}
      {...webHoverProps}
    >
      {isLive && (
        <LinearGradient
          colors={colors.liveGradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.liveStripe}
        />
      )}

      <View style={styles.compactTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
          <Text style={[styles.compactLeague, { color: colors.textSecondary, fontFamily: 'Inter_500Medium', marginRight: 0 }]} numberOfLines={1}>
            {match.league}
          </Text>
          {isMockMatch && (
            <View style={{ backgroundColor: '#F59E0B22', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Text style={{ color: '#F59E0B', fontSize: 9, fontFamily: 'Inter_700Bold' as const, letterSpacing: 0.5 }}>DEV</Text>
            </View>
          )}
        </View>
        {isLive ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.liveSoft }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.live }]} />
            <Text style={[styles.statusText, { color: colors.live, fontFamily: 'Inter_700Bold' }]}>
              LIVE
            </Text>
          </View>
        ) : match.status === 'delayed' ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.warning + '18' }]}>
            <Ionicons name="rainy-outline" size={11} color={colors.warning} style={{ marginRight: 3 }} />
            <Text style={[styles.statusText, { color: colors.warning, fontFamily: 'Inter_700Bold' }]}>
              DELAYED
            </Text>
          </View>
        ) : effectiveStatus === 'completed' ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '18' }]}>
            <Ionicons name="checkmark-circle" size={11} color={colors.success} style={{ marginRight: 3 }} />
            <Text style={[styles.statusText, { color: colors.success, fontFamily: 'Inter_600SemiBold' }]}>
              Completed
            </Text>
          </View>
        ) : (
          <View style={[styles.timerRow, { backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }]}>
            <Ionicons name="time-outline" size={12} color={colors.accent} />
            <Text style={[styles.timerVal, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
              {timeLeft}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.compactTeams}>
        <View style={styles.compactTeamSide}>
          {logo1 ? (
            <Image source={logo1} style={styles.teamLogo} resizeMode="contain" />
          ) : (
            <View style={[styles.compactCircle, { backgroundColor: match.team1Color }]}>
              <Text style={[styles.compactInitial, { fontFamily: 'Inter_700Bold' }]}>
                {match.team1Short[0]}
              </Text>
            </View>
          )}
          <Text style={[styles.compactShort, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            {match.team1Short}
          </Text>
        </View>

        {(() => {
          const rawScore = (match as any).scoreString || "";
          if (isLive && rawScore.length > 3) {
            const segments = rawScore.split(/\s*\|\s*/);
            const lastSeg = segments[segments.length - 1].replace(/\s*[—\-]\s*.+$/, '').trim();
            const scoreMatch = lastSeg.match(/(\d+\/\d+)\s*\(([^)]+)\)/);
            if (scoreMatch) {
              return (
                <View style={{ alignItems: 'center', minWidth: 70 }}>
                  <Text style={{ fontSize: 18, color: colors.live, fontFamily: 'Inter_700Bold' as const }}>
                    {scoreMatch[1]}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: 'Inter_500Medium' as const, marginTop: 2 }}>
                    {scoreMatch[2].trim()}
                  </Text>
                </View>
              );
            }
          }
          return (
            <View style={[styles.vsContainer, { backgroundColor: isDark ? colors.surfaceElevated : colors.background }]}>
              <Text style={[styles.compactVs, { color: colors.textTertiary, fontFamily: 'Inter_700Bold' }]}>
                VS
              </Text>
            </View>
          );
        })()}

        <View style={[styles.compactTeamSide, { alignItems: 'flex-end' as const }]}>
          {logo2 ? (
            <Image source={logo2} style={styles.teamLogo} resizeMode="contain" />
          ) : (
            <View style={[styles.compactCircle, { backgroundColor: match.team2Color }]}>
              <Text style={[styles.compactInitial, { fontFamily: 'Inter_700Bold' }]}>
                {match.team2Short[0]}
              </Text>
            </View>
          )}
          <Text style={[styles.compactShort, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            {match.team2Short}
          </Text>
        </View>
      </View>

      {banter ? (
        <Text style={[styles.banterText, { color: colors.textTertiary }]} numberOfLines={1}>
          {banter}
        </Text>
      ) : null}

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
            Be first to join
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <View style={[styles.viewCta, { backgroundColor: colors.primary + '28', borderColor: colors.primary + '40', borderWidth: 1 }]}>
          <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold' as const }}>View</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { getTeamsForMatch } = useTeams();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ matches: MatchWithParticipants[] }>({
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

  const MS_48H = 48 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const allMatches = injectDevMockMatches(data?.matches || []);
  const visibleMatches = allMatches.filter(m => {
    if (m.status === 'completed') return false;
    if (m.status === 'live' || m.status === 'delayed') return true;
    if (m.status === 'upcoming') return new Date(m.startTime).getTime() <= nowMs + MS_48H;
    return false;
  });

  const webTopInset = isWeb ? 67 : 0;

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
        <View style={[styles.innerContainer, { paddingTop: insets.top + webTopInset + 8 }]}>
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
                accessibilityRole="button"
                accessibilityLabel="Admin settings"
                style={({ pressed }) => [
                  styles.adminBtn,
                  {
                    backgroundColor: colors.primary + '20',
                    opacity: pressed ? 0.7 : 1,
                    ...(isWeb ? { cursor: 'pointer' as any } : {}),
                  },
                ]}
              >
                <Ionicons name="settings" size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>

          <LinearGradient
            colors={colors.heroGradient as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerCard}
          >
            <View style={styles.bannerOverlay}>
              <View style={[styles.bannerGlowOrb, { backgroundColor: colors.accent + '08', top: -20, right: -20 }]} />
              <View style={[styles.bannerGlowOrb, { backgroundColor: colors.featured + '10', bottom: -30, left: -30, width: 120, height: 120 }]} />
            </View>
            <View style={styles.bannerContent}>
              <View style={[styles.bannerBadge, { backgroundColor: colors.accent + '25' }]}>
                <Ionicons name="flash" size={10} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'Inter_700Bold' as const, letterSpacing: 1 }}>
                  FANTASY CRICKET
                </Text>
              </View>
              <Text style={[styles.bannerTitle, { fontFamily: 'Inter_700Bold' }]}>
                CDO Fantasy Cricket
              </Text>
              <Text style={[styles.bannerSubtitle, { fontFamily: 'Inter_400Regular' }]}>
                Create your dream team and compete with friends
              </Text>
            </View>
            <View style={styles.bannerIconWrap}>
              <MaterialCommunityIcons name="cricket" size={52} color="rgba(255,255,255,0.12)" />
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: colors.accent }]} />
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Matches
            </Text>
            {visibleMatches.some(m => {
              const started = new Date(m.startTime).getTime() <= Date.now();
              return m.status === 'live' || ((m.status === 'delayed' || m.status === 'upcoming') && started);
            }) && (
              <LivePulseDot color={colors.live} />
            )}
          </View>

          {isLoading ? (
            <>
              <CompactCardSkeleton colors={colors} />
              <CompactCardSkeleton colors={colors} />
            </>
          ) : isError ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                Connection error
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Could not load matches
              </Text>
              <Pressable
                onPress={() => refetch()}
                style={({ pressed }) => ({
                  marginTop: 12,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 10,
                  opacity: pressed ? 0.8 : 1,
                  ...(isWeb ? { cursor: 'pointer' as any } : {}),
                })}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Retry</Text>
              </Pressable>
            </View>
          ) : visibleMatches.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                No matches right now
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                New contests go live before each match — check back soon
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/how-to-play');
                }}
                style={({ pressed }) => ({
                  marginTop: 6,
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                  ...(isWeb ? { cursor: 'pointer' as any } : {}),
                })}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: 'Inter_500Medium' as const }}>
                  How to Play
                </Text>
              </Pressable>
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
  innerContainer: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center' as const,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  greeting: {
    fontSize: 14,
  },
  username: {
    fontSize: 26,
    marginTop: 2,
  },
  adminBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 120,
    position: 'relative',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerGlowOrb: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  bannerContent: {
    flex: 1,
    zIndex: 1,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  bannerTitle: {
    fontSize: 22,
    color: '#FFF',
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 19,
  },
  bannerIconWrap: {
    zIndex: 1,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactCard: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  liveStripe: {
    height: 3,
  },
  compactTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  compactLeague: {
    fontSize: 11,
    flex: 1,
    marginRight: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerVal: {
    fontSize: 11,
  },
  compactTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  compactTeamSide: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  compactCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamLogo: {
    width: 44,
    height: 44,
  },
  vsContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banterText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 16,
  },
  compactInitial: {
    fontSize: 16,
    color: '#FFF',
  },
  compactShort: {
    fontSize: 14,
  },
  compactVs: {
    fontSize: 10,
    letterSpacing: 1.5,
  },
  compactBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  myTeamText: {
    fontSize: 10,
  },
  noParticipants: {
    fontSize: 11,
  },
  viewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
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
