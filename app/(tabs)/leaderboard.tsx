import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  teamName: string | null;
  totalPoints: number;
  matchesPlayed: number;
  teamsCreated: number;
}

function TopThreeCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
  const { colors } = useTheme();
  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalIcons: ('medal' | 'medal-outline')[] = ['medal', 'medal', 'medal-outline'];
  const sizes = [64, 52, 52];
  const fontSizes = [22, 18, 18];

  const displayName = entry.teamName || entry.username;

  return (
    <View style={[styles.topCard, position === 0 && styles.topCardFirst]}>
      <View style={[styles.topAvatar, { width: sizes[position], height: sizes[position], backgroundColor: medalColors[position] + '30' }]}>
        <Text style={[styles.topInitial, { fontSize: fontSizes[position], color: medalColors[position], fontFamily: 'Inter_700Bold' }]}>
          {displayName[0].toUpperCase()}
        </Text>
      </View>
      <MaterialCommunityIcons name={medalIcons[position]} size={22} color={medalColors[position]} />
      <Text style={[styles.topName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
        {displayName}
      </Text>
      <Text style={[styles.topPoints, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>
        {entry.totalPoints.toLocaleString()}
      </Text>
      <Text style={[styles.topLabel, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
        pts
      </Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard'],
    staleTime: 60000,
  });

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const currentUserEntry = leaderboard.find(e => e.userId === user?.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8 }}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold', paddingHorizontal: 20 }]}>
            Leaderboard
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                No rankings yet. Play matches to see the leaderboard!
              </Text>
            </View>
          ) : (
            <>
              <LinearGradient
                colors={[colors.primary + '15', colors.accent + '08']}
                style={styles.topSection}
              >
                <View style={styles.topRow}>
                  {top3[1] && <TopThreeCard entry={top3[1]} position={1} />}
                  {top3[0] && <TopThreeCard entry={top3[0]} position={0} />}
                  {top3[2] && <TopThreeCard entry={top3[2]} position={2} />}
                </View>
              </LinearGradient>

              {rest.length > 0 && (
                <View style={styles.listSection}>
                  {rest.map((entry) => {
                    const displayName = entry.teamName || entry.username;
                    return (
                      <View
                        key={entry.userId}
                        style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      >
                        <View style={[styles.rankBadge, { backgroundColor: colors.surfaceElevated }]}>
                          <Text style={[styles.rankText, { color: colors.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                            {entry.rank}
                          </Text>
                        </View>
                        <View style={[styles.listAvatar, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.listInitial, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                            {displayName[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.listInfo}>
                          <Text style={[styles.listName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                            {displayName}
                          </Text>
                          <Text style={[styles.listMeta, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                            {entry.matchesPlayed} matches
                          </Text>
                        </View>
                        <View style={styles.listPoints}>
                          <Text style={[styles.listPointsValue, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>
                            {entry.totalPoints.toLocaleString()}
                          </Text>
                          <Text style={[styles.listPointsLabel, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                            pts
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {currentUserEntry ? (
            <View style={[styles.userCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30', marginHorizontal: 16 }]}>
              <Ionicons name="person-circle" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.userCardName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {currentUserEntry.teamName || currentUserEntry.username} - Rank #{currentUserEntry.rank}
                </Text>
                <Text style={[styles.userCardMeta, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  {currentUserEntry.totalPoints} pts | {currentUserEntry.matchesPlayed} matches | {currentUserEntry.teamsCreated} teams
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.userCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30', marginHorizontal: 16 }]}>
              <Ionicons name="person-circle" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.userCardName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {user?.username || 'You'}
                </Text>
                <Text style={[styles.userCardMeta, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  Your ranking will appear as you play
                </Text>
              </View>
            </View>
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
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  topSection: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderRadius: 20,
    marginHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
  },
  topCard: {
    alignItems: 'center',
    width: 100,
    gap: 4,
  },
  topCardFirst: {
    marginBottom: 16,
  },
  topAvatar: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topInitial: {
  },
  topName: {
    fontSize: 13,
    textAlign: 'center',
  },
  topPoints: {
    fontSize: 16,
  },
  topLabel: {
    fontSize: 11,
    marginTop: -4,
  },
  listSection: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
  },
  listAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInitial: {
    fontSize: 16,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 14,
  },
  listMeta: {
    fontSize: 11,
  },
  listPoints: {
    alignItems: 'flex-end',
  },
  listPointsValue: {
    fontSize: 16,
  },
  listPointsLabel: {
    fontSize: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  userCardName: {
    fontSize: 14,
  },
  userCardMeta: {
    fontSize: 12,
  },
});
