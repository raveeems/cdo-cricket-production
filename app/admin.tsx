import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetch } from 'expo/fetch';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { LinearGradient } from 'expo-linear-gradient';

interface ReferenceCode {
  id: string;
  code: string;
  isActive: boolean;
}

interface MatchInfo {
  id: string;
  team1: string;
  team2: string;
  team1Short: string;
  team2Short: string;
  status: string;
  startTime: string;
}

interface PlayerInfo {
  id: string;
  name: string;
  role: string;
  teamShort: string;
  isPlayingXI?: boolean;
}

export default function AdminScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [codes, setCodes] = useState<ReferenceCode[]>([]);
  const [newCode, setNewCode] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchPlayers, setMatchPlayers] = useState<PlayerInfo[]>([]);
  const [xiPlayerIds, setXiPlayerIds] = useState<Set<string>>(new Set());
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [savingXI, setSavingXI] = useState(false);
  const [xiMessage, setXiMessage] = useState('');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const selectedMatch = useMemo(() => matches.find(m => m.id === selectedMatchId), [matches, selectedMatchId]);

  const team1Players = useMemo(() => {
    if (!selectedMatch) return [];
    return matchPlayers.filter(p => p.teamShort === selectedMatch.team1Short);
  }, [matchPlayers, selectedMatch]);

  const team2Players = useMemo(() => {
    if (!selectedMatch) return [];
    return matchPlayers.filter(p => p.teamShort === selectedMatch.team2Short);
  }, [matchPlayers, selectedMatch]);

  const xiCount = xiPlayerIds.size;

  useEffect(() => {
    loadCodes();
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const res = await apiRequest('GET', '/api/matches');
      const data = await res.json();
      const allMatches = (data.matches || []) as MatchInfo[];
      const relevant = allMatches.filter((m: MatchInfo) => m.status === 'upcoming' || m.status === 'live' || m.status === 'delayed');
      setMatches(relevant);
    } catch (e) {
      console.error('Failed to load matches:', e);
    }
  };

  const selectMatch = async (matchId: string) => {
    setSelectedMatchId(matchId);
    setXiMessage('');
    setLoadingPlayers(true);
    try {
      const res = await apiRequest('GET', `/api/matches/${matchId}/players`);
      const data = await res.json();
      const players = (data.players || []) as PlayerInfo[];
      setMatchPlayers(players);
      const existing = new Set<string>();
      players.forEach(p => { if (p.isPlayingXI) existing.add(p.id); });
      setXiPlayerIds(existing);
    } catch (e) {
      console.error('Failed to load players:', e);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const toggleXIPlayer = (playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setXiPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const savePlayingXI = async () => {
    if (!selectedMatchId) return;
    if (xiPlayerIds.size < 11 || xiPlayerIds.size > 22) {
      setXiMessage(`Select 11-22 players (currently ${xiPlayerIds.size})`);
      return;
    }
    setSavingXI(true);
    setXiMessage('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const res = await apiRequest('POST', `/api/admin/matches/${selectedMatchId}/set-playing-xi`, {
        playerIds: Array.from(xiPlayerIds),
      });
      const data = await res.json();
      setXiMessage(data.message || `Playing XI saved: ${data.count} players marked`);
    } catch (e: any) {
      setXiMessage('Failed to save Playing XI');
      console.error('Save XI failed:', e);
    } finally {
      setSavingXI(false);
    }
  };

  const loadCodes = async () => {
    try {
      const res = await apiRequest('GET', '/api/admin/codes');
      const data = await res.json();
      setCodes(data.codes || []);
    } catch (e) {
      console.error('Failed to load codes:', e);
    }
  };

  const generateCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setNewCode(code);
  };

  const saveCode = async () => {
    if (newCode.length !== 4) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const res = await apiRequest('POST', '/api/admin/codes', { code: newCode });
      const data = await res.json();
      setCodes((prev) => [...prev, data.code]);
      setNewCode('');
    } catch (e) {
      console.error('Failed to save code:', e);
    }
  };

  const deleteCode = async (codeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiRequest('DELETE', `/api/admin/codes/${codeId}`);
      setCodes((prev) => prev.filter((c) => c.id !== codeId));
    } catch (e) {
      console.error('Failed to delete code:', e);
    }
  };

  const syncMatches = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await apiRequest('POST', '/api/admin/sync-matches');
      const data = await res.json();
      setSyncMessage(data.message || 'Matches synced successfully');
    } catch (e: any) {
      setSyncMessage('Failed to sync matches');
      console.error('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8, paddingHorizontal: 16 }}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile');
              }
            }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Admin Panel
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <LinearGradient
            colors={[colors.error + '20', colors.warning + '10']}
            style={[styles.warningBanner, { borderColor: colors.error + '30' }]}
          >
            <Ionicons name="shield-checkmark" size={20} color={colors.error} />
            <Text style={[styles.warningText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
              Admin access for {user?.username}
            </Text>
          </LinearGradient>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Reference Codes
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Generate 4-digit codes to invite friends to the platform.
            </Text>

            <View style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.generateRow}>
                <TextInput
                  style={[styles.codeInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_700Bold' }]}
                  value={newCode}
                  onChangeText={setNewCode}
                  placeholder="0000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Pressable
                  onPress={generateCode}
                  style={[styles.generateBtn, { backgroundColor: colors.primary + '20' }]}
                >
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={saveCode}
                  disabled={newCode.length !== 4}
                  style={[styles.addBtn, { opacity: newCode.length === 4 ? 1 : 0.5 }]}
                >
                  <LinearGradient
                    colors={[colors.accent, colors.accentDark]}
                    style={styles.addBtnGradient}
                  >
                    <Ionicons name="add" size={22} color="#000" />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>

            <View style={styles.codesList}>
              {codes.length > 0 && (
                <Text style={[styles.codesHeader, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Reference Codes ({codes.length})
                </Text>
              )}

              {codes.map((codeObj) => (
                <View
                  key={codeObj.id}
                  style={[styles.codeItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                >
                  <View style={styles.codeItemLeft}>
                    <View style={[styles.codeChip, { backgroundColor: colors.success + '20' }]}>
                      <Text style={[styles.codeChipText, { color: colors.success, fontFamily: 'Inter_700Bold' }]}>
                        {codeObj.code}
                      </Text>
                    </View>
                    <View style={[styles.activeBadge, { backgroundColor: colors.success + '15' }]}>
                      <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.activeText, { color: colors.success, fontFamily: 'Inter_500Medium' }]}>
                        Active
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => deleteCode(codeObj.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Match Management
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Sync matches from the Cricket API.
            </Text>

            <Pressable
              onPress={syncMatches}
              disabled={isSyncing}
              style={[styles.syncBtn, { opacity: isSyncing ? 0.6 : 1 }]}
            >
              <LinearGradient
                colors={[colors.primary, '#1E40AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.syncBtnGradient}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialCommunityIcons name="sync" size={22} color="#FFF" />
                )}
                <Text style={[styles.syncBtnText, { fontFamily: 'Inter_700Bold' }]}>
                  {isSyncing ? 'Syncing...' : 'Sync Matches'}
                </Text>
              </LinearGradient>
            </Pressable>

            {syncMessage !== '' && (
              <View style={[styles.syncResult, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="information-circle" size={18} color={colors.primary} />
                <Text style={[styles.syncResultText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                  {syncMessage}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Playing XI
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Manually set the Playing XI for a match. Select a match, then tap players to include.
            </Text>

            {matches.length === 0 ? (
              <View style={[styles.xiEmptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
                  No upcoming or live matches found.
                </Text>
              </View>
            ) : (
              <View style={styles.matchPickerList}>
                {matches.map(m => (
                  <Pressable
                    key={m.id}
                    onPress={() => selectMatch(m.id)}
                    style={[
                      styles.matchPickerItem,
                      {
                        backgroundColor: selectedMatchId === m.id ? colors.primary + '15' : colors.card,
                        borderColor: selectedMatchId === m.id ? colors.primary + '40' : colors.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.matchPickerRow}>
                      <Text style={[styles.matchPickerTeams, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                        {m.team1Short} vs {m.team2Short}
                      </Text>
                      <View style={[styles.matchStatusBadge, { backgroundColor: m.status === 'live' ? '#22C55E20' : colors.primary + '15' }]}>
                        <Text style={[styles.matchStatusText, { color: m.status === 'live' ? '#22C55E' : colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
                          {m.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={[{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 }]}>
                      {new Date(m.startTime).toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedMatchId && loadingPlayers && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
            )}

            {selectedMatchId && !loadingPlayers && matchPlayers.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <View style={styles.xiCountRow}>
                  <Text style={[{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 }]}>
                    Selected: {xiCount} players
                  </Text>
                  <Text style={[{
                    color: xiCount >= 11 && xiCount <= 22 ? '#22C55E' : colors.error,
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12,
                  }]}>
                    {xiCount >= 11 && xiCount <= 22 ? 'Valid' : 'Need 11-22'}
                  </Text>
                </View>

                {selectedMatch && (
                  <>
                    <Text style={[styles.xiTeamHeader, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
                      {selectedMatch.team1Short} ({team1Players.filter(p => xiPlayerIds.has(p.id)).length}/11)
                    </Text>
                    {team1Players.map(p => {
                      const isIn = xiPlayerIds.has(p.id);
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => toggleXIPlayer(p.id)}
                          style={[
                            styles.xiPlayerRow,
                            {
                              backgroundColor: isIn ? '#22C55E10' : colors.card,
                              borderColor: isIn ? '#22C55E40' : colors.cardBorder,
                              borderLeftWidth: 3,
                              borderLeftColor: isIn ? '#22C55E' : '#EF4444',
                            },
                          ]}
                        >
                          <View style={styles.xiPlayerLeft}>
                            <View style={[styles.xiRolePill, { backgroundColor: colors.primary + '15' }]}>
                              <Text style={[{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' as const }]}>
                                {p.role}
                              </Text>
                            </View>
                            <Text style={[{ color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 13 }]} numberOfLines={1}>
                              {p.name}
                            </Text>
                          </View>
                          <View style={[
                            styles.xiCheckCircle,
                            {
                              borderColor: isIn ? '#22C55E' : colors.border,
                              backgroundColor: isIn ? '#22C55E' : 'transparent',
                            },
                          ]}>
                            {isIn && <Ionicons name="checkmark" size={12} color="#FFF" />}
                          </View>
                        </Pressable>
                      );
                    })}

                    <Text style={[styles.xiTeamHeader, { color: colors.primary, fontFamily: 'Inter_700Bold', marginTop: 12 }]}>
                      {selectedMatch.team2Short} ({team2Players.filter(p => xiPlayerIds.has(p.id)).length}/11)
                    </Text>
                    {team2Players.map(p => {
                      const isIn = xiPlayerIds.has(p.id);
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => toggleXIPlayer(p.id)}
                          style={[
                            styles.xiPlayerRow,
                            {
                              backgroundColor: isIn ? '#22C55E10' : colors.card,
                              borderColor: isIn ? '#22C55E40' : colors.cardBorder,
                              borderLeftWidth: 3,
                              borderLeftColor: isIn ? '#22C55E' : '#EF4444',
                            },
                          ]}
                        >
                          <View style={styles.xiPlayerLeft}>
                            <View style={[styles.xiRolePill, { backgroundColor: colors.primary + '15' }]}>
                              <Text style={[{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' as const }]}>
                                {p.role}
                              </Text>
                            </View>
                            <Text style={[{ color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 13 }]} numberOfLines={1}>
                              {p.name}
                            </Text>
                          </View>
                          <View style={[
                            styles.xiCheckCircle,
                            {
                              borderColor: isIn ? '#22C55E' : colors.border,
                              backgroundColor: isIn ? '#22C55E' : 'transparent',
                            },
                          ]}>
                            {isIn && <Ionicons name="checkmark" size={12} color="#FFF" />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}

                <Pressable
                  onPress={savePlayingXI}
                  disabled={savingXI || xiCount < 11 || xiCount > 22}
                  style={[styles.syncBtn, { opacity: (savingXI || xiCount < 11 || xiCount > 22) ? 0.5 : 1, marginTop: 14 }]}
                >
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.syncBtnGradient}
                  >
                    {savingXI ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                    )}
                    <Text style={[styles.syncBtnText, { fontFamily: 'Inter_700Bold' }]}>
                      {savingXI ? 'Saving...' : 'Save Playing XI'}
                    </Text>
                  </LinearGradient>
                </Pressable>

                {xiMessage !== '' && (
                  <View style={[styles.syncResult, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}>
                    <Ionicons name="information-circle" size={18} color={colors.primary} />
                    <Text style={[styles.syncResultText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
                      {xiMessage}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Scoring System
            </Text>

            <View style={[styles.scoringTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {[
                { action: 'Run scored', points: '+1' },
                { action: 'Boundary (4)', points: '+4' },
                { action: 'Six', points: '+6' },
                { action: 'Half Century', points: '+20' },
                { action: 'Century', points: '+50' },
                { action: 'Wicket', points: '+25' },
                { action: 'Maiden Over', points: '+12' },
                { action: 'Catch', points: '+8' },
                { action: 'Stumping', points: '+12' },
                { action: 'Run Out', points: '+6' },
                { action: 'Duck', points: '-5' },
              ].map((item, idx) => (
                <View
                  key={item.action}
                  style={[
                    styles.scoringRow,
                    idx < 10 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}
                >
                  <Text style={[styles.scoringAction, { color: colors.text, fontFamily: 'Inter_400Regular' }]}>
                    {item.action}
                  </Text>
                  <Text
                    style={[
                      styles.scoringPoints,
                      {
                        color: item.points.startsWith('-') ? colors.error : colors.success,
                        fontFamily: 'Inter_700Bold',
                      },
                    ]}
                  >
                    {item.points}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  generateCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
  generateBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addBtnGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codesList: {
    gap: 8,
  },
  codesHeader: {
    fontSize: 13,
    marginBottom: 4,
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  codeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeChipText: {
    fontSize: 18,
    letterSpacing: 4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeText: {
    fontSize: 11,
  },
  syncBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  syncBtnGradient: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
  },
  syncBtnText: {
    fontSize: 16,
    color: '#FFF',
  },
  syncResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncResultText: {
    fontSize: 13,
    flex: 1,
  },
  scoringTable: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scoringAction: {
    fontSize: 14,
  },
  scoringPoints: {
    fontSize: 14,
  },
  matchPickerList: {
    gap: 8,
  },
  matchPickerItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  matchPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchPickerTeams: {
    fontSize: 15,
  },
  matchStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  matchStatusText: {
    fontSize: 10,
  },
  xiEmptyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  xiCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  xiTeamHeader: {
    fontSize: 13,
    marginBottom: 6,
    marginTop: 4,
  },
  xiPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  xiPlayerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  xiRolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  xiCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
