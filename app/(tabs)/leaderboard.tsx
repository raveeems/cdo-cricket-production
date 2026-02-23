import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/query-client';

interface StandingEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  matchCount: number;
}

function TopThreeCard({ entry, position, isCurrentUser, colors }: { entry: StandingEntry; position: number; isCurrentUser: boolean; colors: any }) {
  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalIcons: ('medal' | 'medal' | 'medal-outline')[] = ['medal', 'medal', 'medal-outline'];
  const sizes = [64, 52, 52];
  const fontSizes = [22, 18, 18];
  const pointsColor = entry.totalPoints < 0 ? '#EF4444' : colors.accent;

  return (
    <View style={[styles.topCard, position === 0 && styles.topCardFirst, isCurrentUser && { borderWidth: 2, borderColor: colors.primary, borderRadius: 14, padding: 6 }]}>
      <View style={[styles.topAvatar, { width: sizes[position], height: sizes[position], backgroundColor: medalColors[position] + '30' }]}>
        <Text style={[styles.topInitial, { fontSize: fontSizes[position], color: medalColors[position], fontFamily: 'Inter_700Bold' }]}>
          {entry.userName[0]?.toUpperCase() || '?'}
        </Text>
      </View>
      <MaterialCommunityIcons name={medalIcons[position]} size={22} color={medalColors[position]} />
      <Text style={[styles.topName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
        {entry.userName}
      </Text>
      <Text style={[styles.topPoints, { color: pointsColor, fontFamily: 'Inter_700Bold' }]}>
        {entry.totalPoints < 0 ? '' : ''}{entry.totalPoints.toLocaleString()}
      </Text>
      <Text style={[styles.topLabel, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
        {entry.matchCount} {entry.matchCount === 1 ? 'match' : 'matches'}
      </Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const { data: tournamentNames = [], isLoading: namesLoading } = useQuery<string[]>({
    queryKey: ['/api/tournament/names'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/tournament/names`, { credentials: 'include' });
      const data = await res.json();
      return data.names || [];
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (tournamentNames.length > 0 && !selectedTournament) {
      setSelectedTournament(tournamentNames[0]);
    }
  }, [tournamentNames]);

  const { data: standings = [], isLoading: standingsLoading } = useQuery<StandingEntry[]>({
    queryKey: ['/api/tournament/standings', selectedTournament],
    queryFn: async () => {
      if (!selectedTournament) return [];
      const res = await fetch(`${getApiUrl()}/api/tournament/standings?name=${encodeURIComponent(selectedTournament)}`, { credentials: 'include' });
      const data = await res.json();
      return data.standings || [];
    },
    enabled: !!selectedTournament,
    staleTime: 60000,
  });

  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);
  const isLoading = namesLoading || standingsLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8 }}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold', paddingHorizontal: 20 }]}>
            Tournament Standings
          </Text>

          {namesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : tournamentNames.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                No tournament data yet
              </Text>
            </View>
          ) : (
            <>
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <Pressable
                  onPress={() => setDropdownOpen(true)}
                  style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                >
                  <Ionicons name="trophy" size={18} color={colors.primary} />
                  <Text style={[styles.dropdownText, { color: colors.text, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
                    {selectedTournament || 'Select Tournament'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Modal
                visible={dropdownOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setDropdownOpen(false)}
              >
                <Pressable style={styles.modalOverlay} onPress={() => setDropdownOpen(false)}>
                  <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                      Select Tournament
                    </Text>
                    <ScrollView style={{ maxHeight: 300 }}>
                      {tournamentNames.map((name) => (
                        <Pressable
                          key={name}
                          onPress={() => {
                            setSelectedTournament(name);
                            setDropdownOpen(false);
                          }}
                          style={[
                            styles.modalOption,
                            { borderBottomColor: colors.cardBorder },
                            selectedTournament === name && { backgroundColor: colors.primary + '15' },
                          ]}
                        >
                          <Text style={[styles.modalOptionText, { color: selectedTournament === name ? colors.primary : colors.text, fontFamily: selectedTournament === name ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                            {name}
                          </Text>
                          {selectedTournament === name && (
                            <Ionicons name="checkmark" size={20} color={colors.primary} />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </Pressable>
              </Modal>

              {standingsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : standings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="stats-chart-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                    No standings for this tournament yet
                  </Text>
                </View>
              ) : (
                <>
                  <LinearGradient
                    colors={[colors.primary + '15', colors.accent + '08']}
                    style={styles.topSection}
                  >
                    <View style={styles.topRow}>
                      {top3[1] && <TopThreeCard entry={top3[1]} position={1} isCurrentUser={top3[1].userId === user?.id} colors={colors} />}
                      {top3[0] && <TopThreeCard entry={top3[0]} position={0} isCurrentUser={top3[0].userId === user?.id} colors={colors} />}
                      {top3[2] && <TopThreeCard entry={top3[2]} position={2} isCurrentUser={top3[2].userId === user?.id} colors={colors} />}
                    </View>
                  </LinearGradient>

                  {rest.length > 0 && (
                    <View style={styles.listSection}>
                      {rest.map((entry, index) => {
                        const rank = index + 4;
                        const isCurrentUser = entry.userId === user?.id;
                        const pointsColor = entry.totalPoints < 0 ? '#EF4444' : colors.accent;
                        return (
                          <View
                            key={entry.userId}
                            style={[
                              styles.listItem,
                              { backgroundColor: colors.card, borderColor: colors.cardBorder },
                              isCurrentUser && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primary + '08' },
                            ]}
                          >
                            <View style={[styles.rankBadge, { backgroundColor: colors.surfaceElevated }]}>
                              <Text style={[styles.rankText, { color: colors.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                                {rank}
                              </Text>
                            </View>
                            <View style={[styles.listAvatar, { backgroundColor: colors.primary + '20' }]}>
                              <Text style={[styles.listInitial, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                                {entry.userName[0]?.toUpperCase() || '?'}
                              </Text>
                            </View>
                            <View style={styles.listInfo}>
                              <Text style={[styles.listName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                                {entry.userName}
                                {isCurrentUser ? ' (You)' : ''}
                              </Text>
                              <Text style={[styles.listMeta, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                                {entry.matchCount} {entry.matchCount === 1 ? 'match' : 'matches'}
                              </Text>
                            </View>
                            <View style={styles.listPoints}>
                              <Text style={[styles.listPointsValue, { color: pointsColor, fontFamily: 'Inter_700Bold' }]}>
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
            </>
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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 17,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalOptionText: {
    fontSize: 15,
    flex: 1,
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
  topInitial: {},
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
});
