import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Modal,
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

interface PendingUser {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  joinedAt: string;
}

interface MatchInfo {
  id: string;
  team1: string;
  team2: string;
  team1Short: string;
  team2Short: string;
  status: string;
  startTime: string;
  tournamentName?: string | null;
  entryStake?: number;
  potProcessed?: boolean;
  impactFeaturesEnabled?: boolean;
  isVoid?: boolean;
  officialWinner?: string | null;
  adminUnlockOverride?: boolean;
  revisedStartTime?: string | null;
  firstScorecardAt?: string | null;
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
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
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

  const [potTournamentNames, setPotTournamentNames] = useState<string[]>([]);
  const [potSelectedTournament, setPotSelectedTournament] = useState<string>('');
  const [potNewTournament, setPotNewTournament] = useState('');
  const [potShowNewInput, setPotShowNewInput] = useState(false);
  const [potUnprocessedMatches, setPotUnprocessedMatches] = useState<{id:string;team1Short:string;team2Short:string;startTime:string}[]>([]);
  const [potSelectedMatchId, setPotSelectedMatchId] = useState<string>('');
  const [potStake, setPotStake] = useState('30');
  const [potProcessing, setPotProcessing] = useState(false);
  const [potLoadingMatches, setPotLoadingMatches] = useState(false);

  const [impactMatchId, setImpactMatchId] = useState<string | null>(null);
  const [impactTogglingId, setImpactTogglingId] = useState<string | null>(null);
  const [recalcMatchId, setRecalcMatchId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState('');
  const [voidMatchId, setVoidMatchId] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidResult, setVoidResult] = useState('');
  const [voidConfirmMatchId, setVoidConfirmMatchId] = useState<string | null>(null);
  const [deleteConfirmMatchId, setDeleteConfirmMatchId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [deadlineMatchId, setDeadlineMatchId] = useState<string | null>(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [deadlineSaving, setDeadlineSaving] = useState(false);
  const [deadlineResult, setDeadlineResult] = useState('');
  const [lockTogglingId, setLockTogglingId] = useState<string | null>(null);
  const [markingCompleteId, setMarkingCompleteId] = useState<string | null>(null);
  const [matchActionResult, setMatchActionResult] = useState<Record<string, string>>({});
  const setMatchResult = (matchId: string, msg: string) => {
    setMatchActionResult(prev => ({ ...prev, [matchId]: msg }));
    setTimeout(() => setMatchActionResult(prev => { const n = { ...prev }; delete n[matchId]; return n; }), 5000);
  };

  const [playerStatusExpandedId, setPlayerStatusExpandedId] = useState<string | null>(null);
  const [playerStatusData, setPlayerStatusData] = useState<Record<string, { players: any[]; statuses: Map<string, any> }>>({});
  const [loadingPlayerStatus, setLoadingPlayerStatus] = useState<string | null>(null);
  const [updatingPlayerId, setUpdatingPlayerId] = useState<string | null>(null);
  const [settingWinnerId, setSettingWinnerId] = useState<string | null>(null);

  const [apiMatchesBrowse, setApiMatchesBrowse] = useState<any[]>([]);
  const [browsingApiMatches, setBrowsingApiMatches] = useState(false);
  const [browseError, setBrowseError] = useState('');
  const [importingExternalId, setImportingExternalId] = useState<string | null>(null);

  useEffect(() => {
    if (!syncMessage) return;
    const t = setTimeout(() => setSyncMessage(''), syncMessage.startsWith('✔') ? 6000 : 10000);
    return () => clearTimeout(t);
  }, [syncMessage]);

  useEffect(() => {
    if (!xiMessage) return;
    const t = setTimeout(() => setXiMessage(''), xiMessage.startsWith('✔') || xiMessage.startsWith('Loaded') ? 6000 : 10000);
    return () => clearTimeout(t);
  }, [xiMessage]);

  useEffect(() => {
    if (!addPlayerMsg) return;
    const t = setTimeout(() => setAddPlayerMsg(''), addPlayerMsg.startsWith('Failed') ? 10000 : 6000);
    return () => clearTimeout(t);
  }, [addPlayerMsg]);

  useEffect(() => {
    if (!playerMapMsg) return;
    const t = setTimeout(() => setPlayerMapMsg(''), playerMapMsg.startsWith('Failed') ? 10000 : 6000);
    return () => clearTimeout(t);
  }, [playerMapMsg]);

  useEffect(() => {
    if (!forceSyncResult) return;
    const t = setTimeout(() => setForceSyncResult(''), forceSyncResult.startsWith('✔') || forceSyncResult.startsWith('Sync') || forceSyncResult.startsWith('Done') ? 6000 : 10000);
    return () => clearTimeout(t);
  }, [forceSyncResult]);

  useEffect(() => {
    if (!browseError) return;
    const t = setTimeout(() => setBrowseError(''), 10000);
    return () => clearTimeout(t);
  }, [browseError]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const checkedAtRef = useRef<Date>(new Date());

  const relativeTime = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diff)) return '—';
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

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

  const toggleImpactFeatures = async (matchId: string, enabled: boolean) => {
    setImpactTogglingId(matchId);
    try {
      await apiRequest('POST', `/api/admin/matches/${matchId}/toggle-impact`, { enabled });
      await loadMatches();
      setMatchResult(matchId, enabled ? '✔ Impact picks ON' : '✔ Impact picks OFF');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Toggle impact failed:', e);
      setMatchResult(matchId, '❌ Impact toggle failed');
    } finally {
      setImpactTogglingId(null);
    }
  };

  const recalculateMatch = async (matchId: string) => {
    setRecalculating(true);
    setRecalcResult('');
    try {
      const res = await apiRequest('POST', `/api/admin/matches/${matchId}/recalculate`);
      const data = await res.json();
      const msg = data.message || `Updated ${data.teamsUpdated || 0} teams`;
      setRecalcResult(msg);
      setMatchResult(matchId, `✔ ${msg}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setRecalcResult('Recalculation failed');
      setMatchResult(matchId, '❌ Recalculate failed');
      console.error('Recalculate failed:', e);
    } finally {
      setRecalculating(false);
    }
  };

  const confirmVoidMatch = async () => {
    console.log('[Admin] confirmVoidMatch called, matchId:', voidConfirmMatchId);
    if (!voidConfirmMatchId) return;
    const matchId = voidConfirmMatchId;
    setVoiding(true);
    setVoidResult('');
    try {
      const vRes = await apiRequest('POST', `/api/admin/matches/${matchId}/void`, { isVoid: true });
      if (!vRes.ok) {
        const vData = await vRes.json().catch(() => ({}));
        throw new Error(vData.message || `Server error ${vRes.status}`);
      }
      setVoidResult('✔ Match voided successfully');
      setMatchResult(matchId, '✔ Match voided');
      console.log('[Admin] Void success for match:', matchId);
      await loadMatches();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setVoidConfirmMatchId(null), 1200);
    } catch (e: any) {
      const errMsg = e?.message || 'Unknown error';
      console.error('[Admin] Void match failed:', errMsg, e);
      setVoidResult(`❌ Void failed: ${errMsg}`);
      setMatchResult(matchId, `❌ Void failed: ${errMsg}`);
    } finally {
      setVoiding(false);
    }
  };

  const confirmDeleteMatch = async () => {
    if (!deleteConfirmMatchId) return;
    const matchId = deleteConfirmMatchId;
    setDeleting(true);
    setDeleteResult('');
    try {
      const res = await apiRequest('DELETE', `/api/admin/matches/${matchId}?force=true`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server error ${res.status}`);
      }
      setDeleteResult('✔ Match permanently deleted');
      setMatchResult(matchId, '✔ Deleted');
      await loadMatches();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setDeleteConfirmMatchId(null), 1200);
    } catch (e: any) {
      const errMsg = e?.message || 'Unknown error';
      setDeleteResult(`❌ Delete failed: ${errMsg}`);
      setMatchResult(matchId, `❌ Delete failed: ${errMsg}`);
    } finally {
      setDeleting(false);
    }
  };

  const loadApiMatches = async () => {
    setBrowsingApiMatches(true);
    setBrowseError('');
    setApiMatchesBrowse([]);
    try {
      const res = await apiRequest('GET', '/api/admin/browse-api-matches');
      const data = await res.json();
      setApiMatchesBrowse(data.matches || []);
      if ((data.matches || []).length === 0) setBrowseError('No upcoming non-IPL matches found in the API right now.');
    } catch (e) {
      setBrowseError('Failed to fetch matches from the API.');
      console.error('Browse API matches error:', e);
    } finally {
      setBrowsingApiMatches(false);
    }
  };

  const importApiMatch = async (m: any) => {
    setImportingExternalId(m.externalId);
    try {
      const res = await apiRequest('POST', '/api/admin/import-api-match', {
        externalId: m.externalId,
        seriesId: m.seriesId,
        team1: m.team1,
        team1Short: m.team1Short,
        team1Color: m.team1Color,
        team2: m.team2,
        team2Short: m.team2Short,
        team2Color: m.team2Color,
        venue: m.venue,
        startTime: m.startTime,
        league: m.league,
      });
      const data = await res.json();
      setApiMatchesBrowse(prev => prev.filter(x => x.externalId !== m.externalId));
      await loadMatches();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const playerMsg = data.playersLoaded > 0
        ? `${data.playersLoaded} players loaded automatically.`
        : `Match added. No squad data yet — tap "Fetch Squad" in Match Controls to load players.`;
      Alert.alert('Match Added', playerMsg);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to import match');
    } finally {
      setImportingExternalId(null);
    }
  };

  const promptSetWinner = (m: MatchInfo) => {
    const options: any[] = [
      { text: m.team1Short, onPress: () => callSetWinner(m.id, m.team1Short) },
      { text: m.team2Short, onPress: () => callSetWinner(m.id, m.team2Short) },
    ];
    if (m.officialWinner) {
      options.push({ text: 'Clear Winner', style: 'destructive', onPress: () => callSetWinner(m.id, null) });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Set Official Winner', `${m.team1Short} vs ${m.team2Short}${m.officialWinner ? `\nCurrent: ${m.officialWinner}` : ''}`, options);
  };

  const callSetWinner = async (matchId: string, winner: string | null) => {
    setSettingWinnerId(matchId);
    try {
      await apiRequest('POST', `/api/admin/matches/${matchId}/set-winner`, { winner });
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, officialWinner: winner } : m));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Failed to set winner');
    } finally {
      setSettingWinnerId(null);
    }
  };

  const togglePlayerStatusExpand = async (matchId: string) => {
    if (playerStatusExpandedId === matchId) {
      setPlayerStatusExpandedId(null);
      return;
    }
    setPlayerStatusExpandedId(matchId);
    if (!playerStatusData[matchId]) {
      await refreshPlayerStatusData(matchId);
    }
  };

  const refreshPlayerStatusData = async (matchId: string) => {
    setLoadingPlayerStatus(matchId);
    try {
      const [pRes, sRes] = await Promise.all([
        apiRequest('GET', `/api/matches/${matchId}/players`),
        apiRequest('GET', `/api/matches/${matchId}/player-statuses`),
      ]);
      const pData = await pRes.json();
      const sData = await sRes.json();
      const statusMap = new Map<string, any>((sData.statuses || []).map((s: any) => [s.playerId, s]));
      setPlayerStatusData(prev => ({ ...prev, [matchId]: { players: pData.players || [], statuses: statusMap } }));
    } catch (e) {
      console.error('Failed to load player status data', e);
    } finally {
      setLoadingPlayerStatus(null);
    }
  };

  const STATUS_CYCLE: Record<string, string> = { playing_xi: 'not_active', not_active: 'impact_sub', impact_sub: 'playing_xi' };
  const STATUS_COLORS: Record<string, string> = { playing_xi: '#22C55E', not_active: '#EF4444', impact_sub: '#F59E0B' };
  const STATUS_LABELS: Record<string, string> = { playing_xi: 'XI', not_active: 'OUT', impact_sub: 'SUB' };

  const cyclePlayerStatus = async (matchId: string, playerId: string, currentStatus: string | undefined) => {
    const next = currentStatus ? (STATUS_CYCLE[currentStatus] || 'playing_xi') : 'playing_xi';
    setUpdatingPlayerId(playerId);
    try {
      await apiRequest('POST', `/api/admin/matches/${matchId}/player-status`, { playerId, adminStatus: next });
      setPlayerStatusData(prev => {
        const d = prev[matchId];
        if (!d) return prev;
        const newMap = new Map(d.statuses);
        const existing = newMap.get(playerId) || { playerId, officialImpactSubUsed: false };
        newMap.set(playerId, { ...existing, adminStatus: next });
        return { ...prev, [matchId]: { ...d, statuses: newMap } };
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to update player status');
    } finally {
      setUpdatingPlayerId(null);
    }
  };

  const toggleImpactSub = async (matchId: string, playerId: string, currentValue: boolean) => {
    setUpdatingPlayerId(playerId);
    try {
      await apiRequest('POST', `/api/admin/matches/${matchId}/player-status`, { playerId, officialImpactSubUsed: !currentValue });
      setPlayerStatusData(prev => {
        const d = prev[matchId];
        if (!d) return prev;
        const newMap = new Map(d.statuses);
        const existing = newMap.get(playerId) || { playerId, adminStatus: 'impact_sub' };
        newMap.set(playerId, { ...existing, officialImpactSubUsed: !currentValue });
        return { ...prev, [matchId]: { ...d, statuses: newMap } };
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Failed to toggle impact sub');
    } finally {
      setUpdatingPlayerId(null);
    }
  };

  const openDeadline = (m: MatchInfo) => {
    const d = m.revisedStartTime ? new Date(m.revisedStartTime) : new Date(m.startTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setDeadlineInput(local);
    setDeadlineResult('');
    setDeadlineMatchId(m.id);
  };

  const toggleAdminUnlock = async (matchId: string, unlock: boolean) => {
    setLockTogglingId(matchId);
    try {
      const res = await apiRequest('POST', `/api/admin/matches/${matchId}/admin-unlock`, { unlock });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Cannot unlock', data.message || 'Unknown error');
        setMatchResult(matchId, `❌ ${data.message || 'Cannot change lock'}`);
      } else {
        await loadMatches();
        setMatchResult(matchId, unlock ? '✔ Entry unlocked' : '✔ Entry locked');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to toggle lock');
      setMatchResult(matchId, '❌ Lock toggle failed');
    } finally {
      setLockTogglingId(null);
    }
  };

  const saveDeadline = async () => {
    if (!deadlineMatchId || !deadlineInput) return;
    const parsed = new Date(deadlineInput);
    if (isNaN(parsed.getTime())) {
      setDeadlineResult('Invalid format — use YYYY-MM-DDTHH:mm');
      return;
    }
    setDeadlineSaving(true);
    setDeadlineResult('');
    try {
      const res = await apiRequest('POST', `/api/admin/matches/${deadlineMatchId}/revised-start-time`, { revisedStartTime: parsed.toISOString() });
      const data = await res.json();
      if (!res.ok) {
        setDeadlineResult(data.message || 'Failed to save');
      } else {
        await loadMatches();
        setDeadlineResult('✔ Entry deadline saved');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setDeadlineMatchId(null), 900);
      }
    } catch (e) {
      setDeadlineResult('❌ Failed to save deadline');
      console.error('Save deadline failed:', e);
    } finally {
      setDeadlineSaving(false);
    }
  };

  const clearDeadline = async (matchId: string) => {
    setDeadlineSaving(true);
    try {
      await apiRequest('POST', `/api/admin/matches/${matchId}/revised-start-time`, { revisedStartTime: null });
      await loadMatches();
      setDeadlineResult('✔ Entry deadline cleared');
      setTimeout(() => setDeadlineMatchId(null), 600);
    } catch (e) {
      setDeadlineResult('❌ Failed to clear');
      console.error('Clear deadline failed:', e);
    } finally {
      setDeadlineSaving(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await apiRequest('GET', '/api/admin/audit-log');
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
    loadMatches();
    loadApiCalls();
    loadRewards();
    loadPotTournamentNames();
    loadPotUnprocessedMatches();
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
      const matchTeamShort = selectedMatch
        ? (addPlayerTeam === selectedMatch.team1 ? selectedMatch.team1Short : selectedMatch.team2Short)
        : addPlayerTeam.trim().substring(0, 3).toUpperCase();
      const res = await apiRequest('POST', `/api/admin/matches/${selectedMatchId}/players`, {
        players: [{
          name: addPlayerName.trim(),
          apiName: addPlayerApiName.trim() || undefined,
          team: addPlayerTeam.trim(),
          teamShort: matchTeamShort,
          role: addPlayerRole,
          credits: parseFloat(addPlayerCredits) || 8,
        }],
      });
      const data = await res.json();
      setAddPlayerMsg(data.message || 'Player added');
      setAddPlayerName('');
      setAddPlayerApiName('');
      setAddPlayerCredits('8');
      if (selectedMatchId) {
        const refetchRes = await apiRequest('GET', `/api/matches/${selectedMatchId}/players`);
        const refetchData = await refetchRes.json();
        const freshPlayers = (refetchData.players || []) as PlayerInfo[];
        setMatchPlayers(freshPlayers);
        const existing = new Set<string>();
        freshPlayers.forEach(p => { if (p.isPlayingXI) existing.add(p.id); });
        setXiPlayerIds(existing);
      }
    } catch (e: any) {
      setAddPlayerMsg('Failed: ' + (e.message || 'Unknown error'));
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleDeletePlayer = async (playerId: string, playerName: string) => {
    if (!selectedMatchId) return;
    Alert.alert('Delete Player', `Remove "${playerName}" from this match?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiRequest('DELETE', `/api/admin/players/${playerId}`);
            setMatchPlayers(prev => prev.filter(p => p.id !== playerId));
            setXiPlayerIds(prev => {
              const next = new Set(prev);
              next.delete(playerId);
              return next;
            });
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete player');
          }
        }
      }
    ]);
  };

  const loadMatches = async () => {
    try {
      const res = await apiRequest('GET', '/api/matches');
      const data = await res.json();
      const allMatches = (data.matches || []) as MatchInfo[];
      const now = Date.now();
      const ms7d = 7 * 24 * 60 * 60 * 1000;
      const relevant = allMatches.filter((m: MatchInfo) => {
        if (m.status === 'live' || m.status === 'delayed') return true;
        if (m.status === 'upcoming') {
          return new Date(m.startTime).getTime() <= now + ms7d;
        }
        if (m.status === 'completed') {
          return new Date(m.startTime).getTime() >= now - ms7d;
        }
        return false;
      });
      setMatches(relevant);
    } catch (e) {
      console.error('Failed to load matches:', e);
    }
  };

  const selectMatch = async (matchId: string) => {
    setSelectedMatchId(matchId);
    setXiMessage('');
    const m = matches.find(x => x.id === matchId);
    if (m) {
      setAddPlayerTeam(m.team1);
    }
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

  const loadPendingUsers = async () => {
    try {
      const res = await apiRequest('GET', '/api/admin/pending-users');
      const data = await res.json();
      setPendingUsers(data.users || []);
    } catch (e) {
      console.error('Failed to load pending users:', e);
    }
  };

  const approveUser = async (userId: string) => {
    setApprovingUserId(userId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await apiRequest('POST', '/api/admin/approve-user', { userId });
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      console.error('Failed to approve user:', e);
    } finally {
      setApprovingUserId(null);
    }
  };

  const rejectUser = async (userId: string, username: string) => {
    const doReject = async () => {
      setApprovingUserId(userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      try {
        await apiRequest('POST', '/api/admin/reject-user', { userId });
        setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      } catch (e) {
        console.error('Failed to reject user:', e);
      } finally {
        setApprovingUserId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Reject and delete user "${username}"?`)) {
        await doReject();
      }
    } else {
      Alert.alert('Reject User', `Reject and delete "${username}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: doReject },
      ]);
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

  const loadPotTournamentNames = async () => {
    try {
      const res = await apiRequest('GET', '/api/tournament/names');
      const data = await res.json();
      const apiNames: string[] = data.names || [];
      const matchNames = matches
        .filter(m => m.tournamentName)
        .map(m => m.tournamentName as string);
      const combined = Array.from(new Set([...apiNames, ...matchNames]));
      setPotTournamentNames(combined);
    } catch (e) {
      console.error('Failed to load tournament names:', e);
    }
  };

  const loadPotUnprocessedMatches = async () => {
    setPotLoadingMatches(true);
    try {
      const res = await apiRequest('GET', '/api/admin/matches/unprocessed');
      const data = await res.json();
      setPotUnprocessedMatches(data.matches || []);
    } catch (e) {
      console.error('Failed to load unprocessed matches:', e);
    } finally {
      setPotLoadingMatches(false);
    }
  };

  const handleProcessAndDistribute = async () => {
    const effectiveTournament = potSelectedTournament || potNewTournament.trim();
    if (!effectiveTournament) {
      Alert.alert('Error', 'Please select or enter a tournament name');
      return;
    }
    if (!potSelectedMatchId) {
      Alert.alert('Error', 'Please select a match to process');
      return;
    }
    if (!potStake || parseInt(potStake) <= 0) {
      Alert.alert('Error', 'Entry stake must be greater than 0');
      return;
    }
    setPotProcessing(true);
    try {
      const res = await apiRequest('POST', '/api/tournament/process', {
        matchId: potSelectedMatchId,
        tournamentName: effectiveTournament,
        stake: parseInt(potStake),
      });
      const data = await res.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Pot Distributed!', data.message || 'Tournament pot processed successfully');
      setPotSelectedMatchId('');
      setPotStake('30');
      loadPotUnprocessedMatches();
      loadPotTournamentNames();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to process tournament pot');
    } finally {
      setPotProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + webTopInset + 8, paddingHorizontal: 16, width: '100%', maxWidth: 800, alignSelf: 'center' as const }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: colors.accent }} />
              <Text style={[styles.pageTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                Admin Panel
              </Text>
            </View>
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

          {/* ── Overview Stats Bar ── */}
          {(() => {
            const liveCount = matches.filter(m => m.status === 'live').length;
            const pendingCount = pendingUsers.length;
            const unprocessedCount = potUnprocessedMatches.length;
            const vaultCount = rewardsAvailable.length;
            const callsToday = apiCallData?.today ?? null;
            const callsLimit = apiCallData?.dailyLimit ?? 2000;
            const callsColor = callsToday === null ? colors.textTertiary : callsToday > 1500 ? colors.error : callsToday > 1000 ? '#F59E0B' : colors.success;

            const tiles: { label: string; value: string; accent: string }[] = [
              {
                label: 'PENDING',
                value: String(pendingCount),
                accent: pendingCount > 0 ? '#F59E0B' : colors.textTertiary,
              },
              {
                label: 'LIVE',
                value: String(liveCount),
                accent: liveCount > 0 ? colors.success : colors.textTertiary,
              },
              {
                label: 'UNPROCESSED',
                value: String(unprocessedCount),
                accent: unprocessedCount > 0 ? '#F59E0B' : colors.success,
              },
              {
                label: 'VAULT',
                value: String(vaultCount),
                accent: colors.accent,
              },
              {
                label: 'API CALLS',
                value: callsToday === null ? '—' : `${callsToday}/${callsLimit}`,
                accent: callsColor,
              },
            ];

            return (
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 8,
                marginTop: 4,
              }}>
                {tiles.map(tile => (
                  <View
                    key={tile.label}
                    style={{
                      flex: 1,
                      minWidth: 80,
                      backgroundColor: colors.card,
                      borderRadius: 10,
                      borderTopWidth: 2,
                      borderTopColor: tile.accent,
                      borderRightWidth: 1,
                      borderRightColor: colors.cardBorder,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.cardBorder,
                      borderLeftWidth: 1,
                      borderLeftColor: colors.cardBorder,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: tile.accent, fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 22 }}>
                      {tile.value}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.5, marginTop: 2 }}>
                      {tile.label}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })()}

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 0, borderLeftColor: colors.accent }]}>
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

          <View style={styles.groupDivider}>
            <View style={[styles.groupDividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.groupDividerText, { color: colors.textTertiary }]}>USER MANAGEMENT</Text>
            <View style={[styles.groupDividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 0, borderLeftColor: colors.accent }]}>
                  User Approvals
                </Text>
                {pendingUsers.length > 0 && (
                  <View style={{ backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'Inter_700Bold' }}>{pendingUsers.length}</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => { checkedAtRef.current = new Date(); loadPendingUsers(); }}
                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surfaceElevated }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="refresh" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Approve or reject new user signups.
            </Text>

            {pendingUsers.length === 0 ? (
              <View style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
                    No pending signups
                  </Text>
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' }}>
                  checked {checkedAtRef.current.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : (
              <View style={styles.codesList}>
                {pendingUsers.map((pu) => (
                  <View
                    key={pu.id}
                    style={[styles.codeItem, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 0, paddingVertical: 10, paddingHorizontal: 12 }]}
                  >
                    {/* Avatar initial */}
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 15 }}>
                        {(pu.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    {/* User info */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>
                        {pu.username}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 }} numberOfLines={1}>
                        {pu.phone}{pu.email ? ` · ${pu.email}` : ''}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 }}>
                        {relativeTime(pu.joinedAt)}
                      </Text>
                    </View>
                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                      <Pressable
                        onPress={() => approveUser(pu.id)}
                        disabled={approvingUserId === pu.id}
                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#22C55E20', alignItems: 'center', justifyContent: 'center', opacity: approvingUserId === pu.id ? 0.4 : 1 }}
                      >
                        {approvingUserId === pu.id
                          ? <ActivityIndicator size="small" color="#22C55E" />
                          : <Ionicons name="checkmark" size={20} color="#22C55E" />
                        }
                      </Pressable>
                      <Pressable
                        onPress={() => rejectUser(pu.id, pu.username)}
                        disabled={approvingUserId === pu.id}
                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.error + '15', alignItems: 'center', justifyContent: 'center', opacity: approvingUserId === pu.id ? 0.4 : 1 }}
                      >
                        <Ionicons name="close" size={20} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.groupDivider}>
            <View style={[styles.groupDividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.groupDividerText, { color: colors.textTertiary }]}>MATCH OPERATIONS</Text>
            <View style={[styles.groupDividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
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
              <View style={[styles.feedbackPill, {
                backgroundColor: syncMessage.startsWith('✔') ? '#22C55E15' : colors.primary + '15',
                borderColor: syncMessage.startsWith('✔') ? '#22C55E40' : colors.primary + '40',
                marginTop: 4,
              }]}>
                <Ionicons name={syncMessage.startsWith('✔') ? 'checkmark-circle' : 'information-circle'} size={13} color={syncMessage.startsWith('✔') ? '#22C55E' : colors.primary} />
                <Text style={[styles.feedbackPillText, { color: syncMessage.startsWith('✔') ? '#22C55E' : colors.primary }]}>{syncMessage}</Text>
              </View>
            )}
          </View>

          {/* Add Match from API */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
              Add Match from API
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Browse upcoming non-IPL matches available in the cricket API and add them with one tap. IPL matches sync automatically.
            </Text>
            <Pressable
              onPress={loadApiMatches}
              disabled={browsingApiMatches}
              style={[styles.syncBtn, { opacity: browsingApiMatches ? 0.6 : 1, marginBottom: 12 }]}
            >
              <LinearGradient
                colors={[colors.primary, '#1a3a8f']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.syncBtnGradient}
              >
                {browsingApiMatches
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="search" size={20} color="#fff" />
                }
                <Text style={[styles.syncBtnText, { fontFamily: 'Inter_700Bold' }]}>
                  {browsingApiMatches ? 'Fetching from API...' : 'Browse Available Matches'}
                </Text>
              </LinearGradient>
            </Pressable>
            {browseError !== '' && (
              <View style={[styles.feedbackPill, { backgroundColor: colors.error + '12', borderColor: colors.error + '40', marginBottom: 4 }]}>
                <Ionicons name="alert-circle" size={13} color={colors.error} />
                <Text style={[styles.feedbackPillText, { color: colors.error }]}>{browseError}</Text>
              </View>
            )}
            {apiMatchesBrowse.map((m) => {
              const d = new Date(m.startTime);
              const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              const isImporting = importingExternalId === m.externalId;
              return (
                <View key={m.externalId} style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingVertical: 12, paddingHorizontal: 14 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                      {m.team1Short} vs {m.team2Short}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}>
                      {dateStr}{m.league ? ` · ${m.league}` : ''}{m.venue ? ` · ${m.venue}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => importApiMatch(m)}
                    disabled={isImporting}
                    style={{ backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: isImporting ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    {isImporting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="add" size={18} color="#fff" />
                    }
                    <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 }}>
                      {isImporting ? 'Adding...' : 'Add'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
              Impact Features & Match Controls
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Toggle Impact Picks per match, recalculate scores, or void matches.
            </Text>

            {matches.map(m => {
              const matchStatusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'DONE' : 'UPCOMING';
              const matchStatusColor = m.status === 'live' ? '#FF6B2C' : m.status === 'completed' ? '#5A6380' : '#22C55E';
              return (
              <View key={m.id} style={[styles.matchCard, { backgroundColor: colors.card, borderColor: m.isVoid ? colors.error + '50' : colors.cardBorder }]}>

                {/* Card header: title + status chips */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                  <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontFamily: 'Inter_700Bold' as const }}>
                    {m.team1Short} vs {m.team2Short}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4, flexShrink: 0, flexWrap: 'nowrap' }}>
                    <View style={[styles.statusChip, { backgroundColor: matchStatusColor + '20', borderColor: matchStatusColor + '60' }]}>
                      <Text style={[styles.statusChipText, { color: matchStatusColor }]}>{matchStatusLabel}</Text>
                    </View>
                    {m.isVoid && (
                      <View style={[styles.statusChip, { backgroundColor: colors.error + '20', borderColor: colors.error + '60' }]}>
                        <Text style={[styles.statusChipText, { color: colors.error }]}>VOID</Text>
                      </View>
                    )}
                    <View style={[styles.statusChip, {
                      backgroundColor: m.impactFeaturesEnabled ? '#F59E0B20' : colors.surfaceElevated,
                      borderColor: m.impactFeaturesEnabled ? '#F59E0B60' : colors.border,
                    }]}>
                      <Text style={[styles.statusChipText, { color: m.impactFeaturesEnabled ? '#F59E0B' : colors.textTertiary }]}>
                        ⚡{m.impactFeaturesEnabled ? 'ON' : 'OFF'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Meta row */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>
                    {m.revisedStartTime
                      ? `⏰ ${new Date(m.revisedStartTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (override)`
                      : new Date(m.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  {m.adminUnlockOverride && (
                    <Text style={{ color: '#10B981', fontSize: 11, fontFamily: 'Inter_500Medium' as const }}>🔓 Unlocked</Text>
                  )}
                  {m.officialWinner && (
                    <Text style={{ color: '#F59E0B', fontSize: 11, fontFamily: 'Inter_500Medium' as const }}>🏆 {m.officialWinner}</Text>
                  )}
                </View>

                {/* Primary actions row */}
                <View style={{ flexDirection: 'row', gap: 7, marginBottom: 7 }}>
                  <Pressable
                    onPress={() => recalculateMatch(m.id)}
                    disabled={recalculating}
                    accessibilityLabel="Recalculate Scores"
                    style={[styles.actionBtn, { flex: 1, borderColor: colors.primary + '60', opacity: recalculating ? 0.5 : 1 }]}
                  >
                    {recalculating
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name="sync-outline" size={13} color={colors.primary} />}
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Recalc</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openDeadline(m)}
                    accessibilityLabel="Entry Deadline Override"
                    style={[styles.actionBtn, { flex: 1, borderColor: m.revisedStartTime ? '#F59E0B70' : colors.border, backgroundColor: m.revisedStartTime ? '#F59E0B0D' : undefined }]}
                  >
                    <Ionicons name="hourglass-outline" size={13} color={m.revisedStartTime ? '#F59E0B' : colors.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: m.revisedStartTime ? '#F59E0B' : colors.textSecondary }]}>Deadline</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => promptSetWinner(m)}
                    disabled={settingWinnerId === m.id}
                    accessibilityLabel="Settle Match"
                    style={[styles.actionBtn, { flex: 1, borderColor: m.officialWinner ? '#F59E0B70' : colors.border, backgroundColor: m.officialWinner ? '#F59E0B0D' : undefined, opacity: settingWinnerId === m.id ? 0.5 : 1 }]}
                  >
                    {settingWinnerId === m.id
                      ? <ActivityIndicator size="small" color={colors.textTertiary} />
                      : <Ionicons name="trophy-outline" size={13} color={m.officialWinner ? '#F59E0B' : colors.textSecondary} />}
                    <Text style={[styles.actionBtnText, { color: m.officialWinner ? '#F59E0B' : colors.textSecondary }]}>Settle</Text>
                  </Pressable>
                </View>

                {/* Secondary actions row */}
                <View style={{ flexDirection: 'row', gap: 7, marginBottom: 12 }}>
                  <Pressable
                    onPress={() => toggleImpactFeatures(m.id, !m.impactFeaturesEnabled)}
                    disabled={impactTogglingId === m.id}
                    accessibilityLabel="Toggle Impact Picks"
                    style={[styles.actionBtn, { flex: 1, backgroundColor: m.impactFeaturesEnabled ? '#F59E0B0D' : undefined, borderColor: m.impactFeaturesEnabled ? '#F59E0B60' : colors.border }]}
                  >
                    {impactTogglingId === m.id
                      ? <ActivityIndicator size="small" color={colors.textTertiary} />
                      : <Text style={{ fontSize: 12 }}>⚡</Text>}
                    <Text style={[styles.actionBtnText, { color: m.impactFeaturesEnabled ? '#F59E0B' : colors.textSecondary }]}>
                      Impact {m.impactFeaturesEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>

                  {m.status !== 'completed' ? (
                    <Pressable
                      onPress={() => toggleAdminUnlock(m.id, !m.adminUnlockOverride)}
                      disabled={lockTogglingId === m.id}
                      accessibilityLabel={m.adminUnlockOverride ? 'Lock Entry' : 'Unlock Entry'}
                      style={[styles.actionBtn, { flex: 1, backgroundColor: m.adminUnlockOverride ? '#10B9810D' : undefined, borderColor: m.adminUnlockOverride ? '#10B98160' : colors.border }]}
                    >
                      {lockTogglingId === m.id
                        ? <ActivityIndicator size="small" color={colors.textTertiary} />
                        : <Ionicons name={m.adminUnlockOverride ? 'lock-open-outline' : 'lock-closed-outline'} size={13} color={m.adminUnlockOverride ? '#10B981' : colors.textSecondary} />}
                      <Text style={[styles.actionBtnText, { color: m.adminUnlockOverride ? '#10B981' : colors.textSecondary }]}>
                        {m.adminUnlockOverride ? 'Unlocked' : 'Lock'}
                      </Text>
                    </Pressable>
                  ) : <View style={{ flex: 1 }} />}

                  <Pressable
                    onPress={() => togglePlayerStatusExpand(m.id)}
                    accessibilityLabel="View Participants"
                    style={[styles.actionBtn, { flex: 1, backgroundColor: playerStatusExpandedId === m.id ? colors.primary + '0D' : undefined, borderColor: playerStatusExpandedId === m.id ? colors.primary + '60' : colors.border }]}
                  >
                    <Ionicons name={playerStatusExpandedId === m.id ? 'people' : 'people-outline'} size={13} color={playerStatusExpandedId === m.id ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: playerStatusExpandedId === m.id ? colors.primary : colors.textSecondary }]}>Entries</Text>
                  </Pressable>
                </View>

                {/* Destructive separator */}
                <View style={{ height: 1, backgroundColor: colors.error + '22', marginBottom: 9 }} />

                {/* Destructive actions row */}
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  {!m.isVoid ? (
                    <Pressable
                      onPress={() => { setVoidResult(''); setVoidConfirmMatchId(m.id); }}
                      disabled={voiding}
                      accessibilityLabel="Void Match"
                      style={[styles.destructiveBtn, { flex: 1, opacity: voiding ? 0.5 : 1, borderColor: colors.error + '50' }]}
                    >
                      <Ionicons name="close-circle-outline" size={13} color={colors.error} />
                      <Text style={[styles.destructiveBtnText, { color: colors.error }]}>Void</Text>
                    </Pressable>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                  <Pressable
                    onPress={() => { setDeleteResult(''); setDeleteConfirmMatchId(m.id); }}
                    disabled={deleting}
                    accessibilityLabel="Delete Match"
                    style={[styles.destructiveBtn, { flex: 1, opacity: deleting ? 0.5 : 1, borderColor: colors.error + '50' }]}
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.error} />
                    <Text style={[styles.destructiveBtnText, { color: colors.error }]}>Delete Forever</Text>
                  </Pressable>
                </View>

                {/* Per-match feedback pill */}
                {matchActionResult[m.id] ? (
                  <View style={[styles.feedbackPill, {
                    backgroundColor: matchActionResult[m.id].startsWith('✔') ? '#22C55E15' : colors.error + '15',
                    borderColor: matchActionResult[m.id].startsWith('✔') ? '#22C55E40' : colors.error + '40',
                  }]}>
                    <Ionicons
                      name={matchActionResult[m.id].startsWith('✔') ? 'checkmark-circle' : 'alert-circle'}
                      size={12}
                      color={matchActionResult[m.id].startsWith('✔') ? '#22C55E' : colors.error}
                    />
                    <Text style={[styles.feedbackPillText, {
                      color: matchActionResult[m.id].startsWith('✔') ? '#22C55E' : colors.error,
                    }]}>
                      {matchActionResult[m.id]}
                    </Text>
                  </View>
                ) : null}
                {playerStatusExpandedId === m.id && (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Inter_600SemiBold' as const }}>
                        Player Status
                      </Text>
                      <Pressable onPress={() => refreshPlayerStatusData(m.id)} style={{ padding: 4 }}>
                        {loadingPlayerStatus === m.id
                          ? <ActivityIndicator size="small" color={colors.primary} />
                          : <Ionicons name="refresh" size={14} color={colors.primary} />
                        }
                      </Pressable>
                    </View>
                    {(!playerStatusData[m.id] || playerStatusData[m.id].players.length === 0) ? (
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>
                        {loadingPlayerStatus === m.id ? 'Loading...' : 'No players loaded for this match'}
                      </Text>
                    ) : (
                      (['team1Short', 'team2Short'] as const).map(teamKey => {
                        const teamShort = m[teamKey];
                        const teamPlayers = playerStatusData[m.id].players.filter((p: any) => p.teamShort === teamShort);
                        if (teamPlayers.length === 0) return null;
                        return (
                          <View key={teamKey} style={{ marginBottom: 8 }}>
                            <Text style={{ color: colors.text, fontSize: 11, fontFamily: 'Inter_700Bold' as const, marginBottom: 4 }}>
                              {teamShort}
                            </Text>
                            {teamPlayers.map((p: any) => {
                              const ps = playerStatusData[m.id].statuses.get(p.id);
                              const adminStatus = ps?.adminStatus;
                              const isImpactSub = ps?.officialImpactSubUsed === true;
                              const statusColor = adminStatus ? STATUS_COLORS[adminStatus] : colors.textTertiary;
                              const statusLabel = adminStatus ? STATUS_LABELS[adminStatus] : '—';
                              const isUpdating = updatingPlayerId === p.id;
                              return (
                                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 6 }}>
                                  <Pressable
                                    onPress={() => cyclePlayerStatus(m.id, p.id, adminStatus)}
                                    disabled={isUpdating}
                                    style={{
                                      width: 34, height: 20, borderRadius: 4, backgroundColor: statusColor + '30',
                                      borderWidth: 1, borderColor: statusColor, justifyContent: 'center', alignItems: 'center',
                                    }}
                                  >
                                    {isUpdating
                                      ? <ActivityIndicator size="small" color={statusColor} style={{ transform: [{ scale: 0.6 }] }} />
                                      : <Text style={{ color: statusColor, fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>{statusLabel}</Text>
                                    }
                                  </Pressable>
                                  <Text style={{ flex: 1, color: colors.text, fontSize: 12, fontFamily: 'Inter_400Regular' as const }} numberOfLines={1}>
                                    {p.name}
                                  </Text>
                                  <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Inter_400Regular' as const, width: 28 }}>
                                    {p.role}
                                  </Text>
                                  <Pressable
                                    onPress={() => toggleImpactSub(m.id, p.id, isImpactSub)}
                                    disabled={isUpdating}
                                    style={{
                                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                                      backgroundColor: isImpactSub ? '#F59E0B30' : colors.surfaceElevated,
                                      borderWidth: 1, borderColor: isImpactSub ? '#F59E0B' : colors.border,
                                    }}
                                  >
                                    <Text style={{ color: isImpactSub ? '#F59E0B' : colors.textTertiary, fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>⚡</Text>
                                  </Pressable>
                                </View>
                              );
                            })}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
            })}
          </View>

          <View style={styles.groupDivider}>
            <View style={[styles.groupDividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.groupDividerText, { color: colors.textTertiary }]}>RECORDS & TOOLS</Text>
            <View style={[styles.groupDividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 0, borderLeftColor: colors.accent }]}>
                Audit Log
              </Text>
              <Pressable onPress={loadAuditLogs} disabled={loadingAudit} style={{ padding: 6 }}>
                {loadingAudit ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh" size={18} color={colors.primary} />}
              </Pressable>
            </View>
            {auditLogs.length === 0 ? (
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' as const }}>
                {loadingAudit ? 'Loading...' : 'Tap refresh to load audit logs'}
              </Text>
            ) : (
              auditLogs.slice(0, 20).map((log, i) => (
                <View key={log.id || i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_600SemiBold' as const }}>
                      {log.actionType || log.action}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Inter_400Regular' as const }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }} numberOfLines={2}>
                    {log.entityType}: {log.entityId} | by {log.userName || log.userId?.slice(0, 8)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', marginBottom: 0, borderLeftColor: colors.accent }]}>
                Tournament Pot Management
              </Text>
              {potUnprocessedMatches.length > 0 && (
                <View style={{ backgroundColor: '#F59E0B20', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, borderWidth: 1, borderColor: '#F59E0B40' }}>
                  <Text style={{ color: '#F59E0B', fontSize: 11, fontFamily: 'Inter_700Bold' }}>{potUnprocessedMatches.length}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Process zero-sum pot distribution for completed matches.
            </Text>

            <View style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.formFieldLabel, { color: colors.textTertiary, marginBottom: 6 }]}>TOURNAMENT / SERIES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {potTournamentNames.map(name => (
                    <Pressable
                      key={name}
                      onPress={() => {
                        setPotSelectedTournament(name);
                        setPotShowNewInput(false);
                        setPotNewTournament('');
                      }}
                      style={{
                        borderRadius: 20,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderWidth: 1,
                        backgroundColor: name === potSelectedTournament ? colors.primary : colors.surfaceElevated,
                        borderColor: name === potSelectedTournament ? colors.primary : colors.border,
                      }}
                    >
                      <Text style={{
                        color: name === potSelectedTournament ? '#FFF' : colors.text,
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 13,
                      }}>
                        {name}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => {
                      setPotShowNewInput(true);
                      setPotSelectedTournament('');
                    }}
                    style={{
                      borderRadius: 20,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderStyle: 'dashed' as any,
                      backgroundColor: potShowNewInput ? colors.primary + '15' : colors.surfaceElevated,
                      borderColor: potShowNewInput ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{
                      color: potShowNewInput ? colors.primary : colors.textSecondary,
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 13,
                    }}>
                      + Add New
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>

              {potShowNewInput && (
                <TextInput
                  style={[styles.addPlayerInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium', marginBottom: 8 }]}
                  value={potNewTournament}
                  onChangeText={setPotNewTournament}
                  placeholder="e.g. T20 World Cup"
                  placeholderTextColor={colors.textTertiary}
                />
              )}

              <Text style={[styles.formFieldLabel, { color: colors.textTertiary, marginBottom: 6, marginTop: 4 }]}>SELECT MATCH</Text>
              {potLoadingMatches ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : potUnprocessedMatches.length === 0 ? (
                <View style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surfaceElevated, borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                    All completed matches have been processed
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {potUnprocessedMatches.map(m => {
                      const isSelected = m.id === potSelectedMatchId;
                      const matchDate = new Date(m.startTime);
                      const formatted = matchDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      const fullMatch = matches.find(fm => fm.id === m.id);
                      const stake = fullMatch?.entryStake;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setPotSelectedMatchId(m.id)}
                          style={{
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderWidth: 1.5,
                            backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                            borderColor: isSelected ? colors.primary : colors.border,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: isSelected ? '#FFF' : colors.text,
                            fontFamily: 'Inter_700Bold',
                            fontSize: 14,
                          }}>
                            {m.team1Short} vs {m.team2Short}
                          </Text>
                          <Text style={{
                            color: isSelected ? '#FFFFFF90' : colors.textTertiary,
                            fontFamily: 'Inter_400Regular',
                            fontSize: 11,
                            marginTop: 2,
                          }}>
                            {formatted}{stake ? ` · ₹${stake}` : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              <Text style={[styles.formFieldLabel, { color: colors.textTertiary, marginBottom: 6, marginTop: 4 }]}>ENTRY STAKE (₹)</Text>
              <TextInput
                style={[styles.addPlayerInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                value={potStake}
                onChangeText={setPotStake}
                placeholder="30"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />

              <Pressable
                onPress={handleProcessAndDistribute}
                disabled={potProcessing || (!potSelectedTournament && !potNewTournament.trim()) || !potSelectedMatchId}
                style={{
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#F59E0B',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 8,
                  opacity: (potProcessing || (!potSelectedTournament && !potNewTournament.trim()) || !potSelectedMatchId) ? 0.5 : 1,
                }}
              >
                {potProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="trophy" size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 14 }}>Process & Distribute Pot</Text>
                  </>
                )}
              </Pressable>
            </View>

            {(() => {
              const processedCount = matches.filter(m => m.potProcessed).length;
              if (processedCount === 0) return null;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 2 }}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
                  <Text style={{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                    {processedCount} {processedCount === 1 ? 'match' : 'matches'} already processed
                  </Text>
                </View>
              );
            })()}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
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
                {(() => {
                  const t1Count = team1Players.filter(p => xiPlayerIds.has(p.id)).length;
                  const t2Count = team2Players.filter(p => xiPlayerIds.has(p.id)).length;
                  return (
                    <View style={[styles.xiSummaryBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="people" size={15} color={colors.primary} />
                          <Text style={[{ color: colors.text, fontFamily: 'Inter_700Bold' as const, fontSize: 14 }]}>
                            {xiCount} selected
                          </Text>
                        </View>
                        <Text style={[{ color: colors.textTertiary, fontFamily: 'Inter_400Regular' as const, fontSize: 11, marginTop: 2 }]}>
                          {selectedMatch.team1Short}: {t1Count} · {selectedMatch.team2Short}: {t2Count}
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
                          {xiCount >= 22 ? 'READY' : `NEED ${22 - xiCount} MORE`}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

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
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable
                            onPress={() => loadPreviousXI(label)}
                            disabled={loadingPrevXI}
                            style={[styles.xiQuickBtn, { backgroundColor: colors.primary + '15' }]}
                          >
                            {loadingPrevXI
                              ? <ActivityIndicator size="small" color={colors.primary} />
                              : <Ionicons name="clipboard-outline" size={13} color={colors.primary} />
                            }
                            <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_600SemiBold' as const }}>Copy Last XI</Text>
                          </Pressable>
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
                            <Ionicons name="close-circle" size={13} color="#EF4444" />
                            <Text style={{ color: '#EF4444', fontSize: 10, fontFamily: 'Inter_600SemiBold' as const }}>Clear</Text>
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
                            <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
                            <Text style={{ color: '#22C55E', fontSize: 10, fontFamily: 'Inter_600SemiBold' as const }}>All</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.xiChipGrid}>
                        {teamPlayers.map(p => {
                          const isIn = xiPlayerIds.has(p.id);
                          const chipWidth = Platform.OS === 'web' ? '23%' : '31%';
                          return (
                            <View key={p.id} style={{ position: 'relative', width: chipWidth }}>
                              <Pressable
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
                                  color: isIn ? '#FFFFFFCC' : colors.textSecondary,
                                  fontSize: 9,
                                  fontFamily: 'Inter_700Bold' as const,
                                  letterSpacing: 0.3,
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
                                  color: isIn ? '#FFFFFF80' : colors.textTertiary,
                                  fontSize: 9,
                                  fontFamily: 'Inter_400Regular' as const,
                                }]} numberOfLines={1}>
                                  {p.name.split(' ').slice(0, -1).join(' ').substring(0, 12) || p.name}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleDeletePlayer(p.id, p.name)}
                                style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                              >
                                <Ionicons name="trash" size={10} color="#FFF" />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  onPress={savePlayingXI}
                  disabled={savingXI || xiCount < 11 || xiCount > 22}
                  style={[styles.xiSaveBtn, { opacity: (savingXI || xiCount < 11 || xiCount > 22) ? 0.45 : 1 }]}
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

                {(xiCount < 11 || xiCount > 22) && !savingXI && (
                  <Text style={{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                    {xiCount > 22 ? `${xiCount - 22} too many — max 22` : `Select at least ${11 - xiCount} more player${11 - xiCount === 1 ? '' : 's'}`}
                  </Text>
                )}

                {xiMessage !== '' && (
                  <View style={[styles.feedbackPill, {
                    backgroundColor: xiMessage.startsWith('✔') ? '#22C55E15' : xiMessage.startsWith('Failed') || xiMessage.startsWith('❌') ? colors.error + '12' : colors.primary + '15',
                    borderColor: xiMessage.startsWith('✔') ? '#22C55E40' : xiMessage.startsWith('Failed') || xiMessage.startsWith('❌') ? colors.error + '40' : colors.primary + '40',
                    marginTop: 8,
                  }]}>
                    <Ionicons
                      name={xiMessage.startsWith('✔') ? 'checkmark-circle' : xiMessage.startsWith('Failed') || xiMessage.startsWith('❌') ? 'alert-circle' : 'information-circle'}
                      size={13}
                      color={xiMessage.startsWith('✔') ? '#22C55E' : xiMessage.startsWith('Failed') || xiMessage.startsWith('❌') ? colors.error : colors.primary}
                    />
                    <Text style={[styles.feedbackPillText, { color: xiMessage.startsWith('✔') ? '#22C55E' : xiMessage.startsWith('Failed') || xiMessage.startsWith('❌') ? colors.error : colors.primary }]}>
                      {xiMessage}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {selectedMatchId && selectedMatch && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
                Add Player to {selectedMatch.team1Short} v {selectedMatch.team2Short}
              </Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Manually add a player. Use API Name for scorecard matching if names differ.
              </Text>

              <View style={[styles.generateCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>DISPLAY NAME</Text>
                <TextInput
                  style={[styles.addPlayerInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                  value={addPlayerName}
                  onChangeText={setAddPlayerName}
                  placeholder="e.g. Virat Kohli"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>API NAME <Text style={{ fontWeight: '400', textTransform: 'none' as const }}>· optional, for scorecard matching</Text></Text>
                <TextInput
                  style={[styles.addPlayerInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                  value={addPlayerApiName}
                  onChangeText={setAddPlayerApiName}
                  placeholder="e.g. V Kohli"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>TEAM</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {selectedMatch && [
                    { label: selectedMatch.team1Short, value: selectedMatch.team1 },
                    { label: selectedMatch.team2Short, value: selectedMatch.team2 },
                  ].map(opt => (
                    <Pressable
                      key={opt.value}
                      onPress={() => setAddPlayerTeam(opt.value)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        alignItems: 'center',
                        backgroundColor: addPlayerTeam === opt.value ? colors.primary : colors.surfaceElevated,
                        borderColor: addPlayerTeam === opt.value ? colors.primary : colors.border,
                      }}
                    >
                      <Text style={{ color: addPlayerTeam === opt.value ? '#FFF' : colors.text, fontFamily: 'Inter_700Bold', fontSize: 13 }}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>CREDITS</Text>
                <TextInput
                  style={[styles.addPlayerInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                  value={addPlayerCredits}
                  onChangeText={setAddPlayerCredits}
                  placeholder="e.g. 9.5"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
                <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>ROLE</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
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
                  style={{ height: 44, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', opacity: addingPlayer ? 0.6 : 1 }}
                >
                  {addingPlayer ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color="#FFF" />
                      <Text style={{ color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 14, marginLeft: 8 }}>Add Player</Text>
                    </>
                  )}
                </Pressable>
                {addPlayerMsg !== '' && (
                  <View style={[styles.feedbackPill, {
                    backgroundColor: addPlayerMsg.startsWith('Failed') || addPlayerMsg.startsWith('❌') ? colors.error + '12' : '#22C55E15',
                    borderColor: addPlayerMsg.startsWith('Failed') || addPlayerMsg.startsWith('❌') ? colors.error + '40' : '#22C55E40',
                    marginTop: 8,
                  }]}>
                    <Ionicons name={addPlayerMsg.startsWith('Failed') || addPlayerMsg.startsWith('❌') ? 'alert-circle' : 'checkmark-circle'} size={13} color={addPlayerMsg.startsWith('Failed') || addPlayerMsg.startsWith('❌') ? colors.error : '#22C55E'} />
                    <Text style={[styles.feedbackPillText, { color: addPlayerMsg.startsWith('Failed') || addPlayerMsg.startsWith('❌') ? colors.error : '#22C55E' }]}>{addPlayerMsg}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
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
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
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
              <View style={[styles.feedbackPill, {
                backgroundColor: forceSyncResult.startsWith('✔') ? '#22C55E15' : forceSyncResult.startsWith('Failed') || forceSyncResult.startsWith('❌') ? colors.error + '12' : colors.warning + '15',
                borderColor: forceSyncResult.startsWith('✔') ? '#22C55E40' : forceSyncResult.startsWith('Failed') || forceSyncResult.startsWith('❌') ? colors.error + '40' : colors.warning + '40',
                marginBottom: 8,
              }]}>
                <Ionicons
                  name={forceSyncResult.startsWith('✔') ? 'checkmark-circle' : forceSyncResult.startsWith('Failed') || forceSyncResult.startsWith('❌') ? 'alert-circle' : 'flash'}
                  size={13}
                  color={forceSyncResult.startsWith('✔') ? '#22C55E' : forceSyncResult.startsWith('Failed') || forceSyncResult.startsWith('❌') ? colors.error : colors.warning}
                />
                <Text style={[styles.feedbackPillText, { color: forceSyncResult.startsWith('✔') ? '#22C55E' : forceSyncResult.startsWith('Failed') || forceSyncResult.startsWith('❌') ? colors.error : colors.warning }]}>
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
                      <Text style={[{ fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 2 }, { color: m.playerCount > 0 ? colors.success : '#EF4444' }]}>
                        Players: {m.playerCount ?? 0} {m.playerCount > 0 ? '✓' : '— squad not loaded'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Data ops group */}
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          {m.hasExternalId && (
                            <Pressable
                              onPress={async () => {
                                setForceSyncing(true);
                                setForceSyncResult('');
                                try {
                                  const res = await apiRequest('POST', `/api/admin/matches/${m.id}/fetch-squad`);
                                  const data = await res.json();
                                  setForceSyncResult(data.message || 'Done');
                                  if (Platform.OS !== 'web') Haptics.notificationAsync(data.totalPlayers > 0 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
                                  loadMatchDebug();
                                } catch (e: any) {
                                  setForceSyncResult('Failed: ' + (e.message || 'Unknown error'));
                                } finally {
                                  setForceSyncing(false);
                                }
                              }}
                              disabled={forceSyncing}
                              style={[styles.debugBtn, { backgroundColor: colors.primary + '15' }]}
                            >
                              <Ionicons name="download" size={14} color={colors.primary} />
                              <Text style={[{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                                Fetch Squad
                              </Text>
                            </Pressable>
                          )}
                          {(m.status === 'live' || m.status === 'delayed') && (
                            <Pressable
                              onPress={async () => {
                                setForceSyncing(true);
                                setForceSyncResult('');
                                try {
                                  const res = await apiRequest('POST', '/api/debug/force-sync', { matchId: m.id });
                                  const data = await res.json();
                                  setForceSyncResult(data.message || 'Sync complete');
                                  loadMatchDebug();
                                } catch (e: any) {
                                  setForceSyncResult('Failed: ' + (e.message || 'Unknown error'));
                                } finally {
                                  setForceSyncing(false);
                                }
                              }}
                              disabled={forceSyncing}
                              style={[styles.debugBtn, { backgroundColor: colors.warning + '15' }]}
                            >
                              <Ionicons name="flash" size={14} color={colors.warning} />
                              <Text style={[{ color: colors.warning, fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                                Force Sync
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Destructive ops group — subtle border-left separator */}
                        {(m.status === 'live' || m.status === 'delayed') && (
                          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.border }}>
                            <Pressable
                              onPress={() => {
                                Alert.alert(
                                  'Force Complete Match',
                                  `Are you sure you want to force complete ${m.team1Short} vs ${m.team2Short}? This will mark the match as completed and trigger reward distribution.`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Confirm',
                                      style: 'destructive',
                                      onPress: async () => {
                                        setMarkingCompleteId(m.id);
                                        setForceSyncResult('Processing match completion...');
                                        try {
                                          const res = await apiRequest('POST', `/api/admin/matches/${m.id}/mark-completed`);
                                          const data = await res.json();
                                          setForceSyncResult('✔ Match forced to completion. ' + (data.message || 'Scores recalculated.'));
                                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                          await loadMatches();
                                          loadMatchDebug();
                                        } catch (e: any) {
                                          setForceSyncResult('❌ Failed to force completion: ' + (e.message || 'Unknown error'));
                                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                        } finally {
                                          setMarkingCompleteId(null);
                                        }
                                      },
                                    },
                                  ]
                                );
                              }}
                              disabled={markingCompleteId === m.id}
                              style={[styles.debugBtn, { backgroundColor: '#F59E0B12', opacity: markingCompleteId === m.id ? 0.5 : 1 }]}
                            >
                              {markingCompleteId === m.id
                                ? <ActivityIndicator size="small" color="#F59E0B" />
                                : <Ionicons name="flag" size={14} color="#F59E0B" />
                              }
                              <Text style={[{ color: '#F59E0B', fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                                {markingCompleteId === m.id ? 'Processing...' : 'Mark Completed'}
                              </Text>
                            </Pressable>
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
                              style={[styles.debugBtn, { backgroundColor: colors.error + '10' }]}
                            >
                              <Ionicons name="trash-outline" size={14} color={colors.error} />
                              <Text style={[{ color: colors.error, fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                                Purge Points
                              </Text>
                            </Pressable>
                          </View>
                        )}
                        {m.status !== 'live' && m.status !== 'delayed' && (
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
                            style={[styles.debugBtn, { backgroundColor: colors.error + '10' }]}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.error} />
                            <Text style={[{ color: colors.error, fontFamily: 'Inter_600SemiBold', fontSize: 11, marginLeft: 4 }]}>
                              Purge Points
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
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
              <View style={[styles.feedbackPill, {
                backgroundColor: playerMapMsg.startsWith('Failed') ? colors.error + '12' : '#22C55E15',
                borderColor: playerMapMsg.startsWith('Failed') ? colors.error + '40' : '#22C55E40',
                marginBottom: 8,
              }]}>
                <Ionicons name={playerMapMsg.startsWith('Failed') ? 'alert-circle' : 'checkmark-circle'} size={13} color={playerMapMsg.startsWith('Failed') ? colors.error : '#22C55E'} />
                <Text style={[styles.feedbackPillText, { color: playerMapMsg.startsWith('Failed') ? colors.error : '#22C55E' }]}>{playerMapMsg}</Text>
              </View>
            )}

            {playerMapData && (
              <View style={[{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }]}>
                    Playing XI players
                  </Text>
                  <Text style={[{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 10 }]}>
                    sorted by pts ↑ · 0 pts = unmatched
                  </Text>
                </View>
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
                        {p.role} · {p.teamShort} · {p.points || 0} pts{p.apiName ? ` · API: ${p.apiName}` : ''}
                      </Text>
                    </View>
                    {selectedDbPlayer === p.id && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                ))}

                {selectedDbPlayer && (
                  <View style={{
                    marginTop: 12,
                    gap: 8,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: colors.surface,
                    borderTopWidth: 1,
                    borderTopColor: colors.border + '50',
                  }}>
                    <Text style={[{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 2 }]}>
                      Rename to match scorecard
                    </Text>
                    <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>DISPLAY NAME</Text>
                    <TextInput
                      value={playerMapNewName}
                      onChangeText={setPlayerMapNewName}
                      placeholder="Display name"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.addPlayerInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                    />
                    <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>API NAME <Text style={{ fontWeight: '400', textTransform: 'none' as const }}>· scorecard override</Text></Text>
                    <TextInput
                      value={playerMapApiName}
                      onChangeText={setPlayerMapApiName}
                      placeholder="API Name"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.addPlayerInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, fontFamily: 'Inter_500Medium' }]}
                    />

                    {playerMapData.scorecardNames.length > 0 && (
                      <View>
                        <Text style={[{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 6 }]}>
                          Tap a scorecard name to use it:
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {playerMapData.scorecardNames.map((n: string) => (
                            <Pressable
                              key={n}
                              onPress={() => setPlayerMapNewName(n)}
                              style={[{ backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '30' }]}
                            >
                              <Text style={[{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }]}>
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
                      style={{ height: 44, borderRadius: 10, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }}
                    >
                      <Ionicons name="link" size={16} color="#FFF" />
                      <Text style={[{ color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 14 }]}>
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
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }]}>
              Rewards Vault
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Add reward codes that auto-distribute to match winners (Rank 1 player per match).
            </Text>

            <View style={{ gap: 4, marginTop: 12 }}>
              <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>BRAND</Text>
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 8 }]}
                placeholder="e.g. Zomato"
                placeholderTextColor={colors.textSecondary}
                value={rewardBrand}
                onChangeText={setRewardBrand}
              />
              <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>REWARD TITLE</Text>
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 8 }]}
                placeholder="e.g. ₹100 Off"
                placeholderTextColor={colors.textSecondary}
                value={rewardTitle}
                onChangeText={setRewardTitle}
              />
              <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>COUPON CODE</Text>
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 8 }]}
                placeholder="e.g. CRICKET100"
                placeholderTextColor={colors.textSecondary}
                value={rewardCode}
                onChangeText={setRewardCode}
              />
              <Text style={[styles.formFieldLabel, { color: colors.textTertiary }]}>TERMS <Text style={{ fontWeight: '400', textTransform: 'none' as const }}>· optional</Text></Text>
              <TextInput
                style={[styles.addPlayerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 8 }]}
                placeholder="e.g. Valid till 30 April"
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
                  style={[styles.syncBtnGradient, { height: 44 }]}
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

      {/* Void/Cancel Confirmation Modal */}
      <Modal
        visible={voidConfirmMatchId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setVoidConfirmMatchId(null); setVoidResult(''); }}
      >
        {(() => {
          const voidMatch = matches.find(m => m.id === voidConfirmMatchId);
          const matchLabel = voidMatch ? `${voidMatch.team1Short} vs ${voidMatch.team2Short}` : 'this match';
          return (
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => { setVoidConfirmMatchId(null); setVoidResult(''); }}
            >
              <Pressable
                style={{
                  width: 320,
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: colors.error + '35',
                }}
                onPress={() => {}}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 17, flex: 1 }}>
                    Void {matchLabel}?
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
                  This match will be marked void and excluded from all scoring and leaderboards. This cannot be undone.
                </Text>
                {voidResult !== '' && (
                  <View style={[styles.feedbackPill, {
                    backgroundColor: voidResult.startsWith('✔') ? '#22C55E15' : colors.error + '12',
                    borderColor: voidResult.startsWith('✔') ? '#22C55E40' : colors.error + '40',
                    marginBottom: 10,
                  }]}>
                    <Ionicons name={voidResult.startsWith('✔') ? 'checkmark-circle' : 'alert-circle'} size={13} color={voidResult.startsWith('✔') ? '#22C55E' : colors.error} />
                    <Text style={[styles.feedbackPillText, { color: voidResult.startsWith('✔') ? '#22C55E' : colors.error }]}>{voidResult}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => { setVoidConfirmMatchId(null); setVoidResult(''); }}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmVoidMatch}
                    disabled={voiding}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colors.error,
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: voiding ? 0.55 : 1,
                    }}
                  >
                    {voiding
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 }}>Confirm Void</Text>
                    }
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          );
        })()}
      </Modal>

      {/* Delete Match Confirmation Modal */}
      <Modal
        visible={deleteConfirmMatchId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setDeleteConfirmMatchId(null); setDeleteResult(''); }}
      >
        {(() => {
          const deleteMatch = matches.find(m => m.id === deleteConfirmMatchId);
          const matchLabel = deleteMatch ? `${deleteMatch.team1Short} vs ${deleteMatch.team2Short}` : 'this match';
          return (
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => { setDeleteConfirmMatchId(null); setDeleteResult(''); }}
            >
              <Pressable
                style={{
                  width: 320,
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: colors.error + '35',
                }}
                onPress={() => {}}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                  <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 17, flex: 1 }}>
                    Delete {matchLabel}?
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
                  All match data — players, predictions, and statuses — will be permanently erased. This cannot be undone.
                </Text>
                {deleteResult !== '' && (
                  <View style={[styles.feedbackPill, {
                    backgroundColor: deleteResult.startsWith('✔') ? '#22C55E15' : colors.error + '12',
                    borderColor: deleteResult.startsWith('✔') ? '#22C55E40' : colors.error + '40',
                    marginBottom: 10,
                  }]}>
                    <Ionicons name={deleteResult.startsWith('✔') ? 'checkmark-circle' : 'alert-circle'} size={13} color={deleteResult.startsWith('✔') ? '#22C55E' : colors.error} />
                    <Text style={[styles.feedbackPillText, { color: deleteResult.startsWith('✔') ? '#22C55E' : colors.error }]}>{deleteResult}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => { setDeleteConfirmMatchId(null); setDeleteResult(''); }}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmDeleteMatch}
                    disabled={deleting}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colors.error,
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: deleting ? 0.55 : 1,
                    }}
                  >
                    {deleting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 }}>Delete Forever</Text>
                    }
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          );
        })()}
      </Modal>

      {/* Entry Deadline Override Modal */}
      <Modal
        visible={deadlineMatchId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeadlineMatchId(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setDeadlineMatchId(null)}
        >
          <Pressable
            style={{
              width: 320,
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: '#F59E0B40',
            }}
            onPress={() => {}}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
              <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
                Entry Deadline Override
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 16 }}>
              Override the fantasy entry deadline for this match. Teams cannot be changed after this time. Does not affect the official API start time.{'\n\n'}Format: YYYY-MM-DDTHH:mm{'\n'}e.g. 2025-04-15T21:00
            </Text>
            <TextInput
              value={deadlineInput}
              onChangeText={setDeadlineInput}
              placeholder="2025-04-15T21:00"
              placeholderTextColor={colors.textTertiary}
              style={{
                height: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#F59E0B80',
                backgroundColor: colors.background,
                color: colors.text,
                fontFamily: 'Inter_500Medium',
                fontSize: 15,
                paddingHorizontal: 14,
                marginBottom: 8,
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {deadlineResult !== '' && (
              <View style={[styles.feedbackPill, {
                backgroundColor: deadlineResult.startsWith('✔') ? '#22C55E15' : colors.error + '12',
                borderColor: deadlineResult.startsWith('✔') ? '#22C55E40' : colors.error + '40',
                marginBottom: 8,
              }]}>
                <Ionicons name={deadlineResult.startsWith('✔') ? 'checkmark-circle' : 'alert-circle'} size={13} color={deadlineResult.startsWith('✔') ? '#22C55E' : colors.error} />
                <Text style={[styles.feedbackPillText, { color: deadlineResult.startsWith('✔') ? '#22C55E' : colors.error }]}>{deadlineResult}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={() => deadlineMatchId && clearDeadline(deadlineMatchId)}
                disabled={deadlineSaving}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.error + '60',
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: deadlineSaving ? 0.5 : 1,
                }}
              >
                <Text style={{ color: colors.error, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeadlineMatchId(null)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveDeadline}
                disabled={deadlineSaving}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#F59E0B',
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: deadlineSaving ? 0.6 : 1,
                }}
              >
                {deadlineSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 }}>Save</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    cursor: 'pointer' as any,
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
    borderLeftWidth: 3,
    paddingLeft: 10,
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
    cursor: 'pointer' as any,
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
    cursor: 'pointer' as any,
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
    cursor: 'pointer' as any,
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
    cursor: 'pointer' as any,
  },
  xiChipGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  xiChip: {
    width: '100%' as any,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center' as const,
    cursor: 'pointer' as any,
  },
  xiSaveBtn: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginTop: 16,
    cursor: 'pointer' as any,
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
    cursor: 'pointer' as any,
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
    cursor: 'pointer' as any,
  },
  formFieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold' as const,
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  matchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  statusChip: {
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusChipText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold' as const,
    letterSpacing: 0.4,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    cursor: 'pointer' as any,
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold' as const,
  },
  destructiveBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    cursor: 'pointer' as any,
  },
  destructiveBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold' as const,
  },
  feedbackPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 9,
  },
  feedbackPillText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium' as const,
    flex: 1,
  },
  groupDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 20,
    marginTop: 4,
  },
  groupDividerLine: {
    flex: 1,
    height: 1,
  },
  groupDividerText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold' as const,
    letterSpacing: 1.5,
  },
});
