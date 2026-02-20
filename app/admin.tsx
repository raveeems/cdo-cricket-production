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
  const [matchDebugData, setMatchDebugData] = useState<any>(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [forceSyncResult, setForceSyncResult] = useState('');
  const [loadingPrevXI, setLoadingPrevXI] = useState(false);
  const [playerMapMatch, setPlayerMapMatch] = useState<string | null>(null);
  const [playerMapData, setPlayerMapData] = useState<{ dbPlayers: any[]; scorecardNames: string[] } | null>(null);
  const [loadingPlayerMap, setLoadingPlayerMap] = useState(false);
  const [selectedDbPlayer, setSelectedDbPlayer] = useState<string | null>(null);
  const [playerMapNewName, setPlayerMapNewName] = useState('');
  const [playerMapApiName, setPlayerMapApiName] = useState('');
  const [playerMapMsg, setPlayerMapMsg] = useState('');

  const [apiCallData, setApiCallData] = useState<{ today: number; date: string; dailyLimit: number; tier1Key: boolean; tier2Key: boolean } | null>(null);
  const [loadingApiCalls, setLoadingApiCalls] = useState(false);

  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerApiName, setAddPlayerApiName] = useState('');
  const [addPlayerTeam, setAddPlayerTeam] = useState('');
  const [addPlayerRole, setAddPlayerRole] = useState('BAT');
  const [addPlayerCredits, setAddPlayerCredits] = useState('8');
  const [addPlayerMsg, setAddPlayerMsg] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);

  const [rewardsAvailable, setRewardsAvailable] = useState<any[]>([]);
  const [rewardsClaimed, setRewardsClaimed] = useState<any[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [rewardBrand, setRewardBrand] = useState('');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardCode, setRewardCode] = useState('');
  const [rewardTerms, setRewardTerms] = useState('');
  const [addingReward, setAddingReward] = useState(false);

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
    loadApiCalls();
    loadRewards();
  }, []);

  const loadApiCalls = async () => {
    setLoadingApiCalls(true);
    try {
      const res = await apiRequest('GET', '/api/admin/api-calls');
      const data = await res.json();
      setApiCallData(data);
    } catch (e) {
      console.error('Failed to load API calls:', e);
    } finally {
      setLoadingApiCalls(false);
    }
  };

  const loadRewards = async () => {
    setLoadingRewards(true);
    try {
      const res = await apiRequest('GET', '/api/admin/rewards');
      const data = await res.json();
      setRewardsAvailable(data.available || []);
      setRewardsClaimed(data.claimed || []);
    } catch (e) {
      console.error('Failed to load rewards:', e);
    } finally {
      setLoadingRewards(false);
    }
  };

  const handleAddReward = async () => {
    if (!rewardBrand.trim() || !rewardTitle.trim() || !rewardCode.trim()) {
      Alert.alert('Error', 'Brand, title, and code are required');
      return;
    }
    setAddingReward(true);
    try {
      await apiRequest('POST', '/api/admin/rewards', {
        brand: rewardBrand.trim(),
        title: rewardTitle.trim(),
        code: rewardCode.trim(),
        terms: rewardTerms.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRewardBrand('');
      setRewardTitle('');
      setRewardCode('');
      setRewardTerms('');
      loadRewards();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add reward');
    } finally {
      setAddingReward(false);
    }
  };

  const handleDeleteReward = async (id: string) => {
    try {
      await apiRequest('DELETE', `/api/admin/rewards/${id}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      loadRewards();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete reward');
    }
  };

  const handleAddPlayer = async () => {
    if (!selectedMatchId || !addPlayerName.trim() || !addPlayerTeam.trim()) {
      setAddPlayerMsg('Name and Team are required');
      return;
    }
    setAddingPlayer(true);
    setAddPlayerMsg('');
    try {
      const res = await apiRequest('POST', `/api/admin/matches/${selectedMatchId}/players`, {
        players: [{
          name: addPlayerName.trim(),
          apiName: addPlayerApiName.trim() || undefined,
          team: addPlayerTeam.trim(),
          teamShort: addPlayerTeam.trim().substring(0, 3).toUpperCase(),
          role: addPlayerRole,
          credits: parseFloat(addPlayerCredits) || 8,
        }],
      });
      const data = await res.json();
      setAddPlayerMsg(data.message || 'Player added');
      setAddPlayerName('');
      setAddPlayerApiName('');
      setAddPlayerCredits('8');
      if (selectedMatchId) selectMatch(selectedMatchId);
    } catch (e: any) {
      setAddPlayerMsg('Failed: ' + (e.message || 'Unknown error'));
    } finally {
      setAddingPlayer(false);
    }
  };

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
      const totalWithXI = players.filter(p => p.isPlayingXI).length;
      if (totalWithXI > 22) {
        setXiPlayerIds(new Set());
      } else {
        setXiPlayerIds(existing);
      }
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

  const loadPreviousXI = async (teamShort: string) => {
    if (!selectedMatchId) return;
    setLoadingPrevXI(true);
    try {
      const res = await apiRequest('GET', `/api/admin/teams/${teamShort}/last-playing-xi?excludeMatch=${selectedMatchId}`);
      const data = await res.json();
      if (!data.found || data.playerNames.length === 0) {
        setXiMessage(`No previous Playing XI found for ${teamShort}`);
        return;
      }
      const nameSet = new Set((data.playerNames as string[]).map((n: string) => n.toLowerCase()));
      const currentSquad = matchPlayers.filter(p => p.teamShort === teamShort);
      const matchedIds: string[] = [];
      for (const p of currentSquad) {
        if (nameSet.has(p.name.toLowerCase())) {
          matchedIds.push(p.id);
        }
      }
      setXiPlayerIds(prev => {
        const next = new Set(prev);
        matchedIds.forEach(id => next.add(id));
        return next;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const total = data.playerNames.length;
      const matched = matchedIds.length;
      if (matched === total) {
        setXiMessage(`Loaded ${matched} players from ${data.matchLabel}`);
      } else {
        setXiMessage(`Loaded ${matched}/${total} players from ${data.matchLabel} (${total - matched} not in current squad)`);
      }
    } catch (e: any) {
      setXiMessage('Failed to load previous XI');
    } finally {
      setLoadingPrevXI(false);
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

  const loadMatchDebug = async () => {
    setLoadingDebug(true);
    try {
      const res = await apiRequest('GET', '/api/debug/match-status');
      const data = await res.json();
      setMatchDebugData(data);
    } catch (e: any) {
      setMatchDebugData({ error: e.message || 'Failed to load debug data' });
    } finally {
      setLoadingDebug(false);
    }
  };

  const forceSync = async (matchId?: string) => {
    setForceSyncing(true);
    setForceSyncResult('');
    try {
      const res = await apiRequest('POST', '/api/debug/force-sync', matchId ? { matchId } : {});
      const data = await res.json();
      setForceSyncResult(data.message || 'Sync complete');
      loadMatchDebug();
    } catch (e: any) {
      setForceSyncResult('Force sync failed: ' + (e.message || 'Unknown error'));
    } finally {
      setForceSyncing(false);
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 0 }]}>
                API Usage Today
              </Text>
              <Pressable onPress={loadApiCalls} style={{ padding: 4 }}>
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              CricAPI calls used vs daily limit (2000/day per key).
            </Text>
            <View style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {loadingApiCalls ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : apiCallData ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <Ionicons name="analytics" size={24} color={apiCallData.today > 1500 ? colors.error : apiCallData.today > 1000 ? '#F59E0B' : colors.success} />
                    <Text style={{ color: colors.text, fontSize: 28, fontFamily: 'Inter_700Bold' }}>
                      {apiCallData.today}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular' }}>
                      / {apiCallData.dailyLimit}
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{
                      height: '100%',
                      width: `${Math.min((apiCallData.today / apiCallData.dailyLimit) * 100, 100)}%`,
                      backgroundColor: apiCallData.today > 1500 ? colors.error : apiCallData.today > 1000 ? '#F59E0B' : colors.success,
                      borderRadius: 3,
                    }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Inter_400Regular' }}>
                      T1 Key: {apiCallData.tier1Key ? 'Active' : 'Missing'} | T2 Key: {apiCallData.tier2Key ? 'Active' : 'Missing'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Inter_400Regular' }}>
                      {apiCallData.date}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>No data</Text>
              )}
            </View>
          </View>

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
              Tap a match, then tap players to select/deselect. Green = Playing, tap to toggle.
            </Text>

            {matches.length === 0 ? (
              <View style={[styles.xiEmptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
                  No upcoming or live matches found.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {matches.map(m => {
                    const isSelected = selectedMatchId === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => selectMatch(m.id)}
                        style={[
                          styles.matchChip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                      >
                        <Text style={[{
                          color: isSelected ? '#FFF' : colors.text,
                          fontFamily: 'Inter_700Bold' as const,
                          fontSize: 13,
                        }]}>
                          {m.team1Short} v {m.team2Short}
                        </Text>
                        <Text style={[{
                          color: isSelected ? '#FFFFFF90' : colors.textTertiary,
                          fontFamily: 'Inter_500Medium' as const,
                          fontSize: 10,
                          marginTop: 1,
                        }]}>
                          {m.status === 'live' ? 'LIVE' : new Date(m.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {selectedMatchId && loadingPlayers && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
            )}

            {selectedMatchId && !loadingPlayers && matchPlayers.length > 0 && selectedMatch && (
              <View style={{ marginTop: 8 }}>
                <View style={[styles.xiSummaryBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="people" size={16} color={colors.primary} />
                    <Text style={[{ color: colors.text, fontFamily: 'Inter_700Bold' as const, fontSize: 15 }]}>
                      {xiCount}
                    </Text>
                    <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_400Regular' as const, fontSize: 12 }]}>
                      selected
                    </Text>
                  </View>
                  <View style={[styles.xiValidBadge, {
                    backgroundColor: xiCount >= 22 ? '#22C55E20' : xiCount >= 11 ? '#F59E0B20' : '#EF444420',
                  }]}>
                    <Text style={[{
                      color: xiCount >= 22 ? '#22C55E' : xiCount >= 11 ? '#F59E0B' : '#EF4444',
                      fontFamily: 'Inter_700Bold' as const,
                      fontSize: 11,
                    }]}>
                      {xiCount >= 22 ? 'READY' : xiCount >= 11 ? `NEED ${22 - xiCount} MORE` : `NEED ${22 - xiCount} MORE`}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4 }}>
                  <Pressable
                    onPress={() => loadPreviousXI(selectedMatch.team1Short)}
                    disabled={loadingPrevXI}
                    style={[styles.xiQuickBtn, { backgroundColor: colors.primary + '15', flex: 1, paddingVertical: 8, justifyContent: 'center' }]}
                  >
                    {loadingPrevXI ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="clipboard-outline" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' as const, marginLeft: 4 }}>
                          Copy {selectedMatch.team1Short} Last XI
                        </Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => loadPreviousXI(selectedMatch.team2Short)}
                    disabled={loadingPrevXI}
                    style={[styles.xiQuickBtn, { backgroundColor: colors.primary + '15', flex: 1, paddingVertical: 8, justifyContent: 'center' }]}
                  >
                    {loadingPrevXI ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="clipboard-outline" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' as const, marginLeft: 4 }}>
                          Copy {selectedMatch.team2Short} Last XI
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {[
                  { label: selectedMatch.team1Short, players: team1Players, teamNum: 1 },
                  { label: selectedMatch.team2Short, players: team2Players, teamNum: 2 },
                ].map(({ label, players: teamPlayers, teamNum }) => {
                  const teamSelected = teamPlayers.filter(p => xiPlayerIds.has(p.id)).length;
                  return (
                    <View key={teamNum} style={{ marginTop: teamNum === 1 ? 12 : 16 }}>
                      <View style={styles.xiTeamHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[{ color: colors.text, fontFamily: 'Inter_700Bold' as const, fontSize: 14 }]}>
                            {label}
                          </Text>
                          <View style={[styles.xiTeamCount, {
                            backgroundColor: teamSelected === 11 ? '#22C55E' : teamSelected > 11 ? '#EF4444' : colors.primary,
                          }]}>
                            <Text style={[{ color: '#FFF', fontFamily: 'Inter_700Bold' as const, fontSize: 11 }]}>
                              {teamSelected}/11
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setXiPlayerIds(prev => {
                                const next = new Set(prev);
                                teamPlayers.forEach(p => next.delete(p.id));
                                return next;
                              });
                            }}
                            style={[styles.xiQuickBtn, { backgroundColor: '#EF444415' }]}
                          >
                            <Ionicons name="close-circle" size={14} color="#EF4444" />
                            <Text style={{ color: '#EF4444', fontSize: 11, fontFamily: 'Inter_600SemiBold' as const }}>Clear</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setXiPlayerIds(prev => {
                                const next = new Set(prev);
                                teamPlayers.forEach(p => next.add(p.id));
                                return next;
                              });
                            }}
                            style={[styles.xiQuickBtn, { backgroundColor: '#22C55E15' }]}
                          >
                            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                            <Text style={{ color: '#22C55E', fontSize: 11, fontFamily: 'Inter_600SemiBold' as const }}>All</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.xiChipGrid}>
                        {teamPlayers.map(p => {
                          const isIn = xiPlayerIds.has(p.id);
                          return (
                            <Pressable
                              key={p.id}
                              onPress={() => toggleXIPlayer(p.id)}
                              style={[
                                styles.xiChip,
                                {
                                  backgroundColor: isIn ? '#22C55E' : colors.card,
                                  borderColor: isIn ? '#22C55E' : colors.cardBorder,
                                },
                              ]}
                            >
                              <Text style={[{
                                color: isIn ? '#FFF' : colors.textSecondary,
                                fontSize: 9,
                                fontFamily: 'Inter_700Bold' as const,
                              }]}>
                                {p.role}
                              </Text>
                              <Text style={[{
                                color: isIn ? '#FFF' : colors.text,
                                fontSize: 12,
                                fontFamily: 'Inter_600SemiBold' as const,
                              }]} numberOfLines={1}>
                                {p.name.split(' ').pop()}
                              </Text>
                              <Text style={[{
                                color: isIn ? '#FFFFFFAA' : colors.textTertiary,
                                fontSize: 9,
                                fontFamily: 'Inter_400Regular' as const,
                              }]} numberOfLines={1}>
                                {p.name.split(' ').slice(0, -1).join(' ').substring(0, 12) || p.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  onPress={savePlayingXI}
                  disabled={savingXI || xiCount < 11 || xiCount > 22}
                  style={[styles.xiSaveBtn, { opacity: (savingXI || xiCount < 11 || xiCount > 22) ? 0.4 : 1 }]}
                >
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.xiSaveBtnInner}
                  >
                    {savingXI ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                    )}
                    <Text style={[{ color: '#FFF', fontFamily: 'Inter_700Bold' as const, fontSize: 15 }]}>
                      {savingXI ? 'Saving...' : `Save Playing XI (${xiCount})`}
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

          {selectedMatchId && selectedMatch && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                Add Player to {selectedMatch.team1Short} v {selectedMatch.team2Short}
              </Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Manually add a player. Use API Name for scorecard matching if names differ.
              </Text>

              <View style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <TextInput
                  style={[styles.addPlayerInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                  value={addPlayerName}
                  onChangeText={setAddPlayerName}
                  placeholder="Player Name (display)"
                  placeholderTextColor={colors.textTertiary}
                />
                <TextInput
                  style={[styles.addPlayerInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                  value={addPlayerApiName}
                  onChangeText={setAddPlayerApiName}
                  placeholder="API Name (optional, for scorecard match)"
                  placeholderTextColor={colors.textTertiary}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.addPlayerInput, { flex: 1, backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                    value={addPlayerTeam}
                    onChangeText={setAddPlayerTeam}
                    placeholder="Team (e.g. India)"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <TextInput
                    style={[styles.addPlayerInput, { width: 60, backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium', textAlign: 'center' }]}
                    value={addPlayerCredits}
                    onChangeText={setAddPlayerCredits}
                    placeholder="Cr"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {['WK', 'BAT', 'AR', 'BOWL'].map(r => (
                    <Pressable
                      key={r}
                      onPress={() => setAddPlayerRole(r)}
                      style={[styles.roleChip, {
                        backgroundColor: addPlayerRole === r ? colors.primary : colors.surfaceElevated,
                        borderColor: addPlayerRole === r ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={{ color: addPlayerRole === r ? '#FFF' : colors.text, fontFamily: 'Inter_700Bold', fontSize: 12 }}>
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={handleAddPlayer}
                  disabled={addingPlayer}
                  style={{ height: 44, borderRadius: 12, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}
                >
                  {addingPlayer ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 14, marginLeft: 8 }}>Add Player</Text>
                    </>
                  )}
                </Pressable>
                {addPlayerMsg !== '' && (
                  <Text style={{ color: addPlayerMsg.startsWith('Failed') ? colors.error : colors.success, fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 6 }}>
                    {addPlayerMsg}
                  </Text>
                )}
              </View>
            </View>
          )}

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

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Match Debug
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Raw database data for all active matches. Verify score_string values.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Pressable
                onPress={loadMatchDebug}
                disabled={loadingDebug}
                style={[styles.debugBtn, { backgroundColor: colors.primary + '20', opacity: loadingDebug ? 0.6 : 1 }]}
              >
                {loadingDebug ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="bug" size={18} color={colors.primary} />
                )}
                <Text style={[{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginLeft: 6 }]}>
                  Load Debug Data
                </Text>
              </Pressable>

              <Pressable
                onPress={() => forceSync()}
                disabled={forceSyncing}
                style={[styles.debugBtn, { backgroundColor: colors.warning + '20', opacity: forceSyncing ? 0.6 : 1 }]}
              >
                {forceSyncing ? (
                  <ActivityIndicator size="small" color={colors.warning} />
                ) : (
                  <Ionicons name="flash" size={18} color={colors.warning} />
                )}
                <Text style={[{ color: colors.warning, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginLeft: 6 }]}>
                  Force Sync All
                </Text>
              </Pressable>
            </View>

            {forceSyncResult !== '' && (
              <View style={[styles.syncResult, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 }]}>
                <Ionicons name="flash" size={16} color={colors.warning} />
                <Text style={[{ color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 12, marginLeft: 6, flex: 1 }]}>
                  {forceSyncResult}
                </Text>
              </View>
            )}

            {matchDebugData && (
              <View style={[styles.debugDataCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {matchDebugData.serverTime && (
                  <Text style={[{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 8 }]}>
                    Server: {new Date(matchDebugData.serverTime).toLocaleString()}
                  </Text>
                )}
                {matchDebugData.error ? (
                  <Text style={[{ color: colors.error, fontFamily: 'Inter_500Medium', fontSize: 12 }]}>
                    {matchDebugData.error}
                  </Text>
                ) : (
                  (matchDebugData.matches || []).map((m: any) => (
                    <View key={m.id} style={[styles.debugMatchRow, { borderBottomColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 13 }]}>
                          {m.teams}
                        </Text>
                        <View style={[styles.debugStatusBadge, { backgroundColor: m.status === 'live' ? colors.success + '20' : m.status === 'completed' ? colors.textTertiary + '20' : colors.primary + '20' }]}>
                          <Text style={[{ color: m.status === 'live' ? colors.success : m.status === 'completed' ? colors.textTertiary : colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 10 }]}>
                            {m.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 11 }]}>
                        score_string: {m.scoreString ? `"${m.scoreString}"` : '(empty)'}
                      </Text>
                      <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 11 }]}>
                        last_sync: {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : '(never)'}
                      </Text>
                      <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 11 }]}>
                        locked: {m.isLocked ? 'YES' : 'NO'} | ext_id: {m.hasExternalId ? 'YES' : 'NO'} | start: {m.minutesUntilStart}min
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <Pressable
                          onPress={async () => {
                            setForceSyncing(true);
                            setForceSyncResult('');
                            try {
                              if (m.status === 'upcoming' || m.status === 'delayed') {
                                const res = await apiRequest('POST', `/api/admin/matches/${m.id}/fetch-squad`);
                                const data = await res.json();
                                setForceSyncResult(data.message || 'Done');
                                if (Platform.OS !== 'web') Haptics.notificationAsync(data.totalPlayers > 0 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
                              } else {
                                const res = await apiRequest('POST', '/api/debug/force-sync', { matchId: m.id });
                                const data = await res.json();
                                setForceSyncResult(data.message || 'Sync complete');
                              }
                              loadMatchDebug();
                            } catch (e: any) {
                              setForceSyncResult('Failed: ' + (e.message || 'Unknown error'));
                            } finally {
                              setForceSyncing(false);
                            }
                          }}
                          disabled={forceSyncing}
                          style={[styles.debugBtn, { backgroundColor: m.status === 'upcoming' ? colors.primary + '15' : colors.warning + '15' }]}
                        >
                          <Ionicons name={m.status === 'upcoming' ? 'download' : 'flash'} size={14} color={m.status === 'upcoming' ? colors.primary : colors.warning} />
                          <Text style={[{ color: m.status === 'upcoming' ? colors.primary : colors.warning, fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                            {m.status === 'upcoming' ? 'Fetch Squad from API' : 'Force Sync'}
                          </Text>
                        </Pressable>
                        {(m.status === 'live' || m.status === 'delayed') && (
                          <Pressable
                            onPress={async () => {
                              try {
                                const res = await apiRequest('POST', `/api/admin/matches/${m.id}/mark-completed`);
                                const data = await res.json();
                                setForceSyncResult(data.message || 'Marked as completed');
                                loadMatchDebug();
                              } catch (e: any) {
                                setForceSyncResult('Failed: ' + (e.message || 'Unknown error'));
                              }
                            }}
                            style={[styles.debugBtn, { backgroundColor: '#EF444415' }]}
                          >
                            <Ionicons name="flag" size={14} color="#EF4444" />
                            <Text style={[{ color: '#EF4444', fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                              Mark Completed
                            </Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={async () => {
                            try {
                              const res = await apiRequest('POST', `/api/admin/matches/${m.id}/purge-points`);
                              const data = await res.json();
                              setForceSyncResult(data.message || 'Points purged');
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            } catch (e: any) {
                              setForceSyncResult('Purge failed: ' + (e.message || 'Unknown error'));
                            }
                          }}
                          style={[styles.debugBtn, { backgroundColor: '#F59E0B15' }]}
                        >
                          <Ionicons name="trash-outline" size={14} color="#F59E0B" />
                          <Text style={[{ color: '#F59E0B', fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                            Purge Points
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Player Name Mapping
            </Text>
            <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 12 }]}>
              Fix scorecard name mismatches (e.g. "Chakravarthy" vs "Chakaravarthy")
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {matches.filter(m => m.status === 'live' || m.status === 'delayed').map(m => (
                <Pressable
                  key={m.id}
                  onPress={async () => {
                    setPlayerMapMatch(m.id);
                    setPlayerMapData(null);
                    setSelectedDbPlayer(null);
                    setPlayerMapNewName('');
                    setPlayerMapMsg('');
                    setLoadingPlayerMap(true);
                    try {
                      const res = await apiRequest('GET', `/api/admin/matches/${m.id}/player-mapping`);
                      const data = await res.json();
                      setPlayerMapData(data);
                    } catch (e: any) {
                      setPlayerMapMsg('Failed to load: ' + (e.message || ''));
                    }
                    setLoadingPlayerMap(false);
                  }}
                  style={[styles.debugBtn, { backgroundColor: playerMapMatch === m.id ? colors.primary + '30' : colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
                >
                  <Text style={[{ color: playerMapMatch === m.id ? colors.primary : colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 12 }]}>
                    {m.team1Short} vs {m.team2Short}
                  </Text>
                </Pressable>
              ))}
            </View>

            {loadingPlayerMap && <ActivityIndicator size="small" color={colors.primary} />}
            {playerMapMsg !== '' && (
              <Text style={[{ color: colors.accent, fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 8 }]}>
                {playerMapMsg}
              </Text>
            )}

            {playerMapData && (
              <View style={[{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14 }]}>
                <Text style={[{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 10 }]}>
                  DB Players (0 pts = possibly unmatched)
                </Text>
                {playerMapData.dbPlayers
                  .filter(p => p.isPlayingXI)
                  .sort((a: any, b: any) => (a.points || 0) - (b.points || 0))
                  .map((p: any) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSelectedDbPlayer(p.id);
                      setPlayerMapNewName(p.name);
                      setPlayerMapApiName(p.apiName || '');
                    }}
                    style={[{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: selectedDbPlayer === p.id ? colors.primary + '15' : 'transparent',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border + '30',
                    }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: p.points === 0 ? colors.error : colors.text, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
                        {p.name}
                      </Text>
                      <Text style={[{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 10 }]}>
                        {p.role} | {p.teamShort} | pts: {p.points || 0}{p.apiName ? ` | API: ${p.apiName}` : ''}
                      </Text>
                    </View>
                    {selectedDbPlayer === p.id && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                ))}

                {selectedDbPlayer && (
                  <View style={{ marginTop: 14, gap: 8 }}>
                    <Text style={[{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 12 }]}>
                      Rename to match scorecard:
                    </Text>
                    <TextInput
                      value={playerMapNewName}
                      onChangeText={setPlayerMapNewName}
                      placeholder="Display name"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.addPlayerInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                    />
                    <TextInput
                      value={playerMapApiName}
                      onChangeText={setPlayerMapApiName}
                      placeholder="API Name (scorecard match override)"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.addPlayerInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                    />

                    {playerMapData.scorecardNames.length > 0 && (
                      <View>
                        <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 4 }]}>
                          Scorecard names (tap to use):
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {playerMapData.scorecardNames.map((n: string) => (
                            <Pressable
                              key={n}
                              onPress={() => setPlayerMapNewName(n)}
                              style={[{ backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}
                            >
                              <Text style={[{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 11 }]}>
                                {n}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}

                    <Pressable
                      onPress={async () => {
                        if (!selectedDbPlayer || !playerMapNewName.trim()) return;
                        try {
                          const res = await apiRequest('POST', `/api/admin/matches/${playerMapMatch}/map-player`, {
                            dbPlayerId: selectedDbPlayer,
                            newName: playerMapNewName.trim(),
                            newApiName: playerMapApiName.trim() || undefined,
                          });
                          const data = await res.json();
                          setPlayerMapMsg(data.message || 'Player mapped successfully');
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          const res2 = await apiRequest('GET', `/api/admin/matches/${playerMapMatch}/player-mapping`);
                          const data2 = await res2.json();
                          setPlayerMapData(data2);
                          setSelectedDbPlayer(null);
                        } catch (e: any) {
                          setPlayerMapMsg('Failed: ' + (e.message || ''));
                        }
                      }}
                      style={[styles.debugBtn, { backgroundColor: colors.success + '15', alignSelf: 'flex-start' }]}
                    >
                      <Ionicons name="link" size={14} color={colors.success} />
                      <Text style={[{ color: colors.success, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginLeft: 4 }]}>
                        Map Player
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
              Rewards Vault
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Add reward codes that auto-distribute to match winners (Rank 1 player per match).
            </Text>

            <View style={{ gap: 8, marginTop: 12 }}>
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="Brand (e.g. Zomato)"
                placeholderTextColor={colors.textSecondary}
                value={rewardBrand}
                onChangeText={setRewardBrand}
              />
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="Reward Title (e.g. ₹100 Off)"
                placeholderTextColor={colors.textSecondary}
                value={rewardTitle}
                onChangeText={setRewardTitle}
              />
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="Coupon Code"
                placeholderTextColor={colors.textSecondary}
                value={rewardCode}
                onChangeText={setRewardCode}
              />
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="Terms (optional)"
                placeholderTextColor={colors.textSecondary}
                value={rewardTerms}
                onChangeText={setRewardTerms}
              />
              <Pressable
                onPress={handleAddReward}
                disabled={addingReward}
                style={[styles.syncBtn]}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.syncBtnGradient, { height: 46 }]}
                >
                  {addingReward ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Ionicons name="gift" size={18} color="#000" />
                      <Text style={[styles.syncBtnText, { color: '#000', fontFamily: 'Inter_700Bold' }]}>Add to Vault</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            {loadingRewards ? (
              <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
            ) : (
              <View style={{ marginTop: 16, gap: 12 }}>
                <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                  Available ({rewardsAvailable.length})
                </Text>
                {rewardsAvailable.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
                    No rewards in vault. Add some above.
                  </Text>
                ) : (
                  rewardsAvailable.map((r: any) => (
                    <View key={r.id} style={[styles.codeItem, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="gift" size={14} color="#FFD700" />
                          <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{r.brand}</Text>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 }}>{r.title}</Text>
                        <View style={[styles.codeChip, { backgroundColor: colors.primary + '15', alignSelf: 'flex-start', marginTop: 4 }]}>
                          <Text style={[styles.codeChipText, { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2 }]}>{r.code}</Text>
                        </View>
                      </View>
                      <Pressable onPress={() => handleDeleteReward(r.id)} hitSlop={10}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  ))
                )}

                {rewardsClaimed.length > 0 && (
                  <>
                    <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 8 }}>
                      Claimed ({rewardsClaimed.length})
                    </Text>
                    {rewardsClaimed.map((r: any) => (
                      <View key={r.id} style={[styles.codeItem, { borderColor: colors.success + '30', backgroundColor: colors.success + '08' }]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                            <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{r.brand} - {r.title}</Text>
                          </View>
                          <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}>
                            Won by: {r.claimedByUsername || 'Unknown'} • {r.matchLabel || 'Unknown match'}
                          </Text>
                          <View style={[styles.codeChip, { backgroundColor: colors.success + '15', alignSelf: 'flex-start', marginTop: 4 }]}>
                            <Text style={[styles.codeChipText, { color: colors.success, fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2 }]}>{r.code}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
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
  matchChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  xiEmptyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  xiSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  xiValidBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  xiTeamHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  xiTeamCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  xiQuickBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  xiChipGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  xiChip: {
    width: '31%' as any,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center' as const,
  },
  xiSaveBtn: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginTop: 16,
  },
  xiSaveBtnInner: {
    height: 50,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderRadius: 14,
  },
  debugBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  debugDataCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  debugMatchRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  debugStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  addPlayerInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 8,
  },
  roleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
