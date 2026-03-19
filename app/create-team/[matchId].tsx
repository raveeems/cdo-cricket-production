import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
  Image,
} from 'react-native';
import { getTeamLogo } from '@/utils/teamLogo';
import { getMatchBanter } from '@/utils/getMatchBanter';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeams } from '@/contexts/TeamContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import {
  Player,
  Match,
  getRoleColor,
  getRoleLabel,
} from '@/lib/mock-data';
import { LinearGradient } from 'expo-linear-gradient';
import TeamPitchView from '@/components/TeamPitchView';
import type { PitchPlayer } from '@/components/TeamPitchView';
import { SkeletonBox } from '@/components/SkeletonBox';

type Step = 'select' | 'impact' | 'captain' | 'preview' | 'success';
type RoleFilter = 'ALL' | 'WK' | 'BAT' | 'AR' | 'BOWL';

const SPLASH_MESSAGES = [
  "Today is your day...",
  "Seri inniku evolo alla pora!",
  "Vettukilli",
  "Ivolo sambathichi enna da panna pora",
  "Edhukaga sollren'na adhukaga thaan sollren",
  "Idho ungalukaga",
];

const ROLE_LIMITS = {
  WK: { min: 1, max: 4 },
  BAT: { min: 1, max: 6 },
  AR: { min: 1, max: 6 },
  BOWL: { min: 1, max: 6 },
};

const MAX_FROM_ONE_TEAM = 10;

function PlayerItem({
  player,
  isSelected,
  onToggle,
  colors,
  isDark,
  showPlayingXI,
  isDisabled,
}: {
  player: Player;
  isSelected: boolean;
  onToggle: () => void;
  colors: any;
  isDark: boolean;
  showPlayingXI: boolean;
  isDisabled: boolean;
}) {
  const isInXI = player.isPlayingXI === true;
  const xiIndicatorColor = isInXI ? '#22C55E' : '#EF4444';

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.playerItem,
        {
          backgroundColor: isSelected ? colors.accent + '10' : colors.card,
          borderColor: isSelected ? colors.accent + '50' : colors.cardBorder,
          borderLeftWidth: showPlayingXI ? 3 : (isSelected ? 2 : 1),
          borderLeftColor: showPlayingXI ? xiIndicatorColor : (isSelected ? colors.accent : colors.cardBorder),
          opacity: (isDisabled && !isSelected) ? 0.4 : 1,
        },
      ]}
    >
      <View style={styles.playerItemLeft}>
        <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role, isDark) + '20' }]}>
          <Text style={[styles.rolePillText, { color: getRoleColor(player.role, isDark), fontFamily: 'Inter_700Bold' }]}>
            {player.role}
          </Text>
        </View>
        <View style={styles.playerItemInfo}>
          <View style={styles.playerItemNameRow}>
            <Text style={[styles.playerItemName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
              {player.name}
            </Text>
            {showPlayingXI && (
              <View style={{ backgroundColor: xiIndicatorColor + '20', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginLeft: 4 }}>
                <Text style={{ color: xiIndicatorColor, fontSize: 8, fontFamily: 'Inter_700Bold' as const }}>
                  {isInXI ? 'IN' : 'OUT'}
                </Text>
              </View>
            )}
            {player.isImpactPlayer && (
              <MaterialCommunityIcons name="lightning-bolt" size={12} color={colors.warning} />
            )}
          </View>
          <Text style={[styles.playerItemTeam, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
            {player.teamShort}
          </Text>
        </View>
      </View>
      <View style={styles.playerItemRight}>
        <Text style={[styles.playerCredits, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
          {player.credits} Cr  |  {player.points != null ? player.points : 0} pts
        </Text>
        <View style={styles.formRow}>
          {(player.recentForm || []).slice(0, 3).map((v, i) => (
            <View
              key={i}
              style={[
                styles.formDot,
                { backgroundColor: v > 30 || v > 2 ? colors.success + '40' : colors.textTertiary + '30' },
              ]}
            >
              <Text style={[styles.formDotText, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                {v}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.checkCircle, { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' }]}>
        {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
      </View>
    </Pressable>
  );
}

function CompactPlayerItem({
  player,
  isSelected,
  onToggle,
  colors,
  isDark,
  showPlayingXI,
  isDisabled,
}: {
  player: Player & { lastMatchPoints?: number | null; tournamentPoints?: number | null };
  isSelected: boolean;
  onToggle: () => void;
  colors: any;
  isDark: boolean;
  showPlayingXI: boolean;
  isDisabled: boolean;
}) {
  const isInXI = player.isPlayingXI === true;
  const xiIndicatorColor = isInXI ? '#22C55E' : '#EF4444';
  const nameParts = player.name.split(' ');
  const displayName = nameParts.length > 1
    ? `${nameParts[0][0]}. ${nameParts.slice(1).join(' ')}`
    : player.name;

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.compactCard,
        {
          backgroundColor: isSelected ? colors.accent + '10' : colors.card,
          borderColor: isSelected ? colors.accent + '50' : colors.cardBorder,
          opacity: (isDisabled && !isSelected) ? 0.4 : 1,
        },
        showPlayingXI && {
          borderLeftWidth: 3,
          borderLeftColor: xiIndicatorColor,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={[styles.compactRolePill, { backgroundColor: getRoleColor(player.role, isDark) + '20' }]}>
          <Text style={{ color: getRoleColor(player.role, isDark), fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>
            {player.role}
          </Text>
        </View>
        <View style={[styles.compactCheck, { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' }]}>
          {isSelected && <Ionicons name="checkmark" size={10} color="#000" />}
        </View>
      </View>
      <View style={{ marginTop: 4, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ color: colors.text, fontSize: 12, fontFamily: 'Inter_600SemiBold' as const }} numberOfLines={1}>
            {displayName}
          </Text>
          {showPlayingXI && (
            <View style={{ backgroundColor: xiIndicatorColor + '20', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 }}>
              <Text style={{ color: xiIndicatorColor, fontSize: 7, fontFamily: 'Inter_700Bold' as const }}>
                {isInXI ? 'IN' : 'OUT'}
              </Text>
            </View>
          )}
          {player.isImpactPlayer && (
            <MaterialCommunityIcons name="lightning-bolt" size={10} color={colors.warning} />
          )}
        </View>
        <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Inter_600SemiBold' as const, marginTop: 2 }}>
          {player.credits} Cr  |  {player.points != null ? player.points : 0} pts
        </Text>
        {player.lastMatchPoints != null ? (
          <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Inter_400Regular' as const, marginTop: 1 }}>
            Last Match: {player.lastMatchPoints} pts
          </Text>
        ) : player.tournamentPoints != null ? (
          <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Inter_400Regular' as const, marginTop: 1 }}>
            Series: {player.tournamentPoints} pts
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function CaptainItem({
  player,
  isCaptain,
  isVC,
  onSelectC,
  onSelectVC,
  colors,
  isDark,
}: {
  player: Player;
  isCaptain: boolean;
  isVC: boolean;
  onSelectC: () => void;
  onSelectVC: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View style={[styles.captainItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.captainLeft}>
        <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role, isDark) + '20' }]}>
          <Text style={[styles.rolePillText, { color: getRoleColor(player.role, isDark), fontFamily: 'Inter_700Bold' }]}>
            {player.role}
          </Text>
        </View>
        <View>
          <Text style={[styles.captainName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
            {player.name}
          </Text>
          <Text style={[styles.captainMeta, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
            {player.teamShort} | {player.credits} Cr
          </Text>
        </View>
      </View>
      <View style={styles.captainButtons}>
        <Pressable
          onPress={onSelectC}
          style={[
            styles.captainBtn,
            {
              backgroundColor: isCaptain ? colors.accent : colors.surfaceElevated,
              borderColor: isCaptain ? colors.accent : colors.border,
            },
          ]}
        >
          <Text style={[styles.captainBtnText, { color: isCaptain ? '#000' : colors.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            C
          </Text>
        </Pressable>
        <Pressable
          onPress={onSelectVC}
          style={[
            styles.captainBtn,
            {
              backgroundColor: isVC ? colors.primary : colors.surfaceElevated,
              borderColor: isVC ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.captainBtnText, { color: isVC ? '#FFF' : colors.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            VC
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CreateTeamScreen() {
  const params = useLocalSearchParams<{ matchId: string; editTeamId?: string }>();
  const matchId = params.matchId;
  const editTeamId = params.editTeamId;
  const { colors, isDark } = useTheme();
  const { saveTeam, updateTeam, getTeamsForMatch, getTeamById } = useTeams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isEditMode = !!editTeamId;
  const editingTeam = isEditMode ? getTeamById(editTeamId!) : undefined;

  const [step, setStep] = useState<Step>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (editingTeam) return new Set(editingTeam.playerIds);
    return new Set();
  });
  const [captainId, setCaptainId] = useState<string | null>(() => editingTeam?.captainId || null);
  const [vcId, setVcId] = useState<string | null>(() => editingTeam?.viceCaptainId || null);
  const [primaryImpactId, setPrimaryImpactId] = useState<string | null>(() => editingTeam?.primaryImpactId || null);
  const [backupImpactId, setBackupImpactId] = useState<string | null>(() => editingTeam?.backupImpactId || null);
  const [captainType, setCaptainType] = useState<'player' | 'impact_slot'>(() => editingTeam?.captainType === 'impact_slot' ? 'impact_slot' : 'player');
  const [vcType, setVcType] = useState<'player' | 'impact_slot'>(() => editingTeam?.vcType === 'impact_slot' ? 'impact_slot' : 'player');
  const [invisibleMode, setInvisibleMode] = useState<boolean>(() => editingTeam?.invisibleMode || false);
  const [filter, setFilter] = useState<RoleFilter>('ALL');
  const [isSaving, setIsSaving] = useState(false);

  const { data: matchData, isLoading: matchLoading } = useQuery<{ match: Match }>({
    queryKey: ['/api/matches', matchId],
    enabled: !!matchId,
  });

  const { data: playersData, isLoading: playersLoading } = useQuery<{
    players: (Player & { lastMatchPoints?: number | null; tournamentPoints?: number | null })[];
    lastMatchXI: Record<string, { xi: string[]; impact: string | null }>;
  }>({
    queryKey: ['/api/matches', matchId, 'players'],
    enabled: !!matchId,
  });

  const { data: weeklyUsageData } = useQuery<{
    multiTeamRemaining: number;
    canUseInvisibleMode: boolean;
    canUseMultiTeam: boolean;
  }>({
    queryKey: ['/api/weekly-usage'],
  });

  const match = matchData?.match;
  const allPlayers = playersData?.players || [];
  const lastMatchXIData = playersData?.lastMatchXI || {};
  const existingTeams = matchId ? getTeamsForMatch(matchId) : [];
  const impactEnabled = match?.impactFeaturesEnabled === true;

  // Groups players for ALL tab: Last Match XI → Impact Player → Rest of Squad
  const allTabSections = useMemo(() => {
    const buildSections = (teamShort: string) => {
      const teamPlayers = (allPlayers || []).filter(
        (p) => (p.teamShort || p.team) === teamShort
      );

      // Priority 1: admin has announced current match Playing XI — highest priority, overrides everything
      const hasCurrentXI = teamPlayers.some((p) => p.isPlayingXI);
      if (hasCurrentXI) {
        const xiPlayers = teamPlayers
          .filter((p) => p.isPlayingXI)
          .sort((a, b) => b.credits - a.credits);
        const impactPlayer = teamPlayers.find((p) => p.isImpactPlayer && !p.isPlayingXI) ?? null;
        const seenIds = new Set([
          ...xiPlayers.map((p) => p.id),
          ...(impactPlayer ? [impactPlayer.id] : []),
        ]);
        const rest = teamPlayers
          .filter((p) => !seenIds.has(p.id))
          .sort((a, b) => b.credits - a.credits);
        return { xi: xiPlayers, impact: impactPlayer, rest, source: 'currentXI' as const };
      }

      // Priority 2: use last-match XI names from backend (prediction hint pre-announcement)
      const lmxi = lastMatchXIData[teamShort];
      if (lmxi && (lmxi.xi || []).length > 0) {
        const xiNames = new Set(lmxi.xi);
        const xiPlayers = (lmxi.xi || [])
          .map((name) => teamPlayers.find((p) => p.name === name))
          .filter(Boolean) as Player[];
        const impactName = lmxi.impact;
        const impactPlayer = impactName
          ? teamPlayers.find((p) => p.name === impactName && !xiNames.has(p.name))
          : null;
        const seenIds = new Set([
          ...xiPlayers.map((p) => p.id),
          ...(impactPlayer ? [impactPlayer.id] : []),
        ]);
        const rest = teamPlayers
          .filter((p) => !seenIds.has(p.id))
          .sort((a, b) => b.credits - a.credits);
        return { xi: xiPlayers, impact: impactPlayer, rest, source: 'lastMatch' as const };
      }

      // Fallback: first match of tournament or no data — no section headers, just credits sort
      return {
        xi: [],
        impact: null,
        rest: [...teamPlayers].sort((a, b) => b.credits - a.credits),
        source: 'fallback' as const,
      };
    };

    return {
      team1: match ? buildSections(match.team1Short) : null,
      team2: match ? buildSections(match.team2Short) : null,
    };
  }, [allPlayers, lastMatchXIData, match]);

  const sortedPlayers = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      const aIn = a.isPlayingXI === true ? 0 : 1;
      const bIn = b.isPlayingXI === true ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return b.credits - a.credits;
    });
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    if (filter === 'ALL') return sortedPlayers;
    return sortedPlayers.filter((p) => p.role === filter);
  }, [sortedPlayers, filter]);

  const hasPlayingXIData = useMemo(() => {
    return allPlayers.some((p) => p.isPlayingXI !== undefined && p.isPlayingXI !== null);
  }, [allPlayers]);

  const selectedPlayers = useMemo(() => {
    return allPlayers.filter((p) => selectedIds.has(p.id));
  }, [allPlayers, selectedIds]);

  const roleCounts = useMemo(() => {
    const counts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    selectedPlayers.forEach((p) => { counts[p.role]++; });
    return counts;
  }, [selectedPlayers]);

  const totalCredits = useMemo(() => {
    return selectedPlayers.reduce((sum, p) => sum + p.credits, 0);
  }, [selectedPlayers]);

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedPlayers.forEach((p) => {
      const key = p.teamShort || p.team || '';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [selectedPlayers]);

  const maxTeamExceeded = useMemo(() => {
    return Object.entries(teamCounts).find(([, count]) => count > MAX_FROM_ONE_TEAM);
  }, [teamCounts]);

  const isValidTeam = useMemo(() => {
    if (selectedIds.size !== 11) return false;
    for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
      const count = roleCounts[role as keyof typeof roleCounts];
      if (count < limits.min || count > limits.max) return false;
    }
    if (maxTeamExceeded) return false;
    return true;
  }, [selectedIds, roleCounts, maxTeamExceeded]);

  const validationError = useMemo(() => {
    if (selectedIds.size > 0 && selectedIds.size !== 11) {
      return `Select ${11 - selectedIds.size} more player${11 - selectedIds.size !== 1 ? 's' : ''} (${selectedIds.size}/11)`;
    }
    for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
      const count = roleCounts[role as keyof typeof roleCounts];
      if (count < limits.min) {
        return `Need at least ${limits.min} ${getRoleLabel(role)} (you have ${count})`;
      }
      if (count > limits.max) {
        return `You must select between ${limits.min}-${limits.max} ${getRoleLabel(role)}s`;
      }
    }
    if (maxTeamExceeded) {
      return `You can only select a maximum of ${MAX_FROM_ONE_TEAM} players from one team.`;
    }
    return null;
  }, [selectedIds, roleCounts, maxTeamExceeded]);

  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const impactEligiblePlayers = useMemo(() => {
    if (!impactEnabled) return [];
    return allPlayers.filter(p => !selectedIds.has(p.id));
  }, [allPlayers, selectedIds, impactEnabled]);

  const primaryImpactPlayer = useMemo(() => {
    if (!primaryImpactId) return null;
    return allPlayers.find(p => p.id === primaryImpactId) || null;
  }, [allPlayers, primaryImpactId]);

  const backupEligiblePlayers = useMemo(() => {
    if (!primaryImpactPlayer || !impactEnabled) return [];
    return impactEligiblePlayers.filter(p =>
      p.id !== primaryImpactId &&
      (p.teamShort || p.team || '') === (primaryImpactPlayer.teamShort || primaryImpactPlayer.team || '')
    );
  }, [impactEligiblePlayers, primaryImpactId, primaryImpactPlayer, impactEnabled]);

  const isDuplicateTeam = (cId: string | null, vId: string | null) => {
    if (selectedIds.size !== 11 || !cId || !vId) return false;
    const selectedArray = Array.from(selectedIds).sort();
    return existingTeams.some((team) => {
      if (isEditMode && team.id === editTeamId) return false;
      const teamIds = [...team.playerIds].sort();
      if (teamIds.length !== selectedArray.length) return false;
      const samePlayerIds = teamIds.every((id, i) => id === selectedArray[i]);
      const sameCaptain = team.captainId === cId;
      const sameVC = team.viceCaptainId === vId;
      const samePrimary = (team.primaryImpactId || null) === primaryImpactId;
      const sameBackup = (team.backupImpactId || null) === backupImpactId;
      const sameCType = (team.captainType || 'player') === captainType;
      const sameVType = (team.vcType || 'player') === vcType;
      return samePlayerIds && sameCaptain && sameVC && samePrimary && sameBackup && sameCType && sameVType;
    });
  };

  const hasValidCaptain = captainType === 'impact_slot' ? !!primaryImpactId : !!captainId;
  const hasValidVC = vcType === 'impact_slot' ? !!primaryImpactId : !!vcId;
  const canProceedFromCaptain = hasValidCaptain && hasValidVC;

  const canSelectPlayer = (player: Player) => {
    if (selectedIds.has(player.id)) return true;
    if (selectedIds.size >= 11) return false;
    const count = roleCounts[player.role];
    if (count >= ROLE_LIMITS[player.role].max) return false;
    const playerTeam = player.teamShort || player.team || '';
    if (playerTeam && (teamCounts[playerTeam] || 0) >= MAX_FROM_ONE_TEAM) return false;
    return true;
  };

  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const selectionWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSelectionWarning = (msg: string) => {
    if (selectionWarningTimer.current) clearTimeout(selectionWarningTimer.current);
    setSelectionWarning(msg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    selectionWarningTimer.current = setTimeout(() => setSelectionWarning(null), 2500);
  };

  const togglePlayer = (player: Player) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSet = new Set(selectedIds);
    if (newSet.has(player.id)) {
      newSet.delete(player.id);
    } else {
      if (selectedIds.size >= 11) {
        showSelectionWarning('You can only select 11 players.');
        return;
      }
      const count = roleCounts[player.role];
      if (count >= ROLE_LIMITS[player.role].max) {
        showSelectionWarning(`Max ${ROLE_LIMITS[player.role].max} ${player.role} players allowed.`);
        return;
      }
      const playerTeam = player.teamShort || player.team || '';
      if (playerTeam && (teamCounts[playerTeam] || 0) >= MAX_FROM_ONE_TEAM) {
        showSelectionWarning(`Max ${MAX_FROM_ONE_TEAM} players from one team allowed.`);
        return;
      }
      newSet.add(player.id);
    }
    setSelectedIds(newSet);
  };

  const handleAutoSelect = () => {
    if (allPlayers.length < 11 || !match) return;
    const teams = new Set<string>();
    allPlayers.forEach(p => teams.add(p.teamShort || p.team || ''));
    const teamKeys = Array.from(teams);
    if (teamKeys.length < 2) return;

    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const xiAnnounced = allPlayers.some(p => p.isPlayingXI === true);
    const eligiblePlayers = xiAnnounced ? allPlayers.filter(p => p.isPlayingXI === true) : allPlayers;

    if (eligiblePlayers.length < 11) {
      showSelectionWarning('Not enough eligible players to auto-select.');
      return;
    }

    for (let attempt = 0; attempt < 500; attempt++) {
      const [teamA, teamB] = Math.random() < 0.5 ? [teamKeys[0], teamKeys[1]] : [teamKeys[1], teamKeys[0]];
      const poolA = shuffle(eligiblePlayers.filter(p => (p.teamShort || p.team || '') === teamA));
      const poolB = shuffle(eligiblePlayers.filter(p => (p.teamShort || p.team || '') === teamB));

      const picked: Player[] = [];
      const roles = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
      let credits = 0;
      let fromA = 0;
      let fromB = 0;

      const tryAdd = (p: Player, isA: boolean) => {
        if (picked.length >= 11) return false;
        if (roles[p.role] >= ROLE_LIMITS[p.role].max) return false;
        if (isA && fromA >= 6) return false;
        if (!isA && fromB >= 5) return false;
        if (credits + p.credits > 100) return false;
        picked.push(p);
        roles[p.role]++;
        credits += p.credits;
        if (isA) fromA++; else fromB++;
        return true;
      };

      const merged = shuffle([
        ...poolA.map(p => ({ p, isA: true })),
        ...poolB.map(p => ({ p, isA: false })),
      ]);

      for (const { p, isA } of merged) {
        tryAdd(p, isA);
        if (picked.length >= 11) break;
      }

      if (picked.length !== 11) continue;
      if (fromA !== 6 || fromB !== 5) continue;
      if (roles.WK < 1 || roles.BAT < 1 || roles.AR < 1 || roles.BOWL < 1) continue;
      if (credits > 100) continue;

      const newIds = new Set(picked.map(p => p.id));
      setSelectedIds(newIds);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    showSelectionWarning('Could not generate a valid team. Try again!');
  };

  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [predictionSaving, setPredictionSaving] = useState(false);
  const [hasPredicted, setHasPredicted] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [splashMessage, setSplashMessage] = useState('');
  const [banterLine, setBanterLine] = useState<string>('');
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.8)).current;

  const { data: existingPrediction } = useQuery<{ myPrediction: { predictedWinner: string } | null }>({
    queryKey: ['/api/predictions', matchId],
    enabled: !!matchId,
  });

  const handleSubmitPressed = () => {
    if (!canProceedFromCaptain || !matchId || isSaving) return;
    if (isDuplicateTeam(captainId, vcId)) {
      setDuplicateError('You have already created this exact team. Please change at least one player or the Captain/VC.');
      setStep('captain');
      return;
    }
    if (existingPrediction?.myPrediction || hasPredicted) {
      handleSaveTeam();
    } else {
      setShowPredictionModal(true);
    }
  };

  const handlePredictionConfirm = async () => {
    if (!selectedWinner || !matchId) return;
    setPredictionSaving(true);
    try {
      await apiRequest('POST', '/api/predictions', {
        matchId,
        predictedWinner: selectedWinner,
      });
      setHasPredicted(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowPredictionModal(false);
      handleSaveTeam();
    } catch (e: any) {
      console.error('Prediction save error:', e);
      setSaveError('Failed to save prediction. Please try again.');
      setShowPredictionModal(false);
    } finally {
      setPredictionSaving(false);
    }
  };

  const handleSaveTeam = async () => {
    if (!canProceedFromCaptain || !matchId || isSaving) return;
    if (isDuplicateTeam(captainId, vcId)) {
      setDuplicateError('You have already created this exact team. Please change at least one player or the Captain/VC.');
      setStep('captain');
      return;
    }
    setIsSaving(true);
    setDuplicateError(null);
    setSaveError(null);
    try {
      const safeCaptainType = primaryImpactId ? captainType : 'player';
      const safeVcType = primaryImpactId ? vcType : 'player';
      const impactFields = impactEnabled ? {
        primaryImpactId: primaryImpactId || undefined,
        backupImpactId: backupImpactId || undefined,
        captainType: safeCaptainType,
        vcType: safeVcType,
        invisibleMode,
      } : {};

      if (isEditMode && editTeamId) {
        await updateTeam({
          teamId: editTeamId,
          playerIds: Array.from(selectedIds),
          captainId,
          viceCaptainId: vcId,
          ...impactFields,
        });
      } else {
        const baseName = user?.teamName || 'Team';
        const existingNames = new Set(existingTeams.map((t) => t.name));
        let teamNumber = existingTeams.length + 1;
        while (existingNames.has(`${baseName} ${teamNumber}`)) {
          teamNumber++;
        }
        await saveTeam({
          matchId,
          name: `${baseName} ${teamNumber}`,
          playerIds: Array.from(selectedIds),
          captainId,
          viceCaptainId: vcId,
          ...impactFields,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const randomMsg = SPLASH_MESSAGES[Math.floor(Math.random() * SPLASH_MESSAGES.length)];
      setSplashMessage(randomMsg);
      setBanterLine(getMatchBanter(match?.team1Short ?? '', match?.team2Short ?? '') ?? '');
      setShowSplash(true);
      splashOpacity.setValue(0);
      splashScale.setValue(0.8);
      Animated.parallel([
        Animated.timing(splashOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(splashScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.timing(splashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowSplash(false);
          setBanterLine('');
          router.replace({ pathname: '/(tabs)/match/[id]', params: { id: matchId } });
        });
      }, 3500);
    } catch (e: any) {
      console.error('Save team error:', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      let msg = 'Failed to submit team. Please try again.';
      try {
        const errStr = String(e?.message || e || '');
        const jsonMatch = errStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.message) msg = parsed.message;
        } else {
          const colonIdx = errStr.indexOf(': ');
          if (colonIdx > 0) {
            const afterCode = errStr.substring(colonIdx + 2).trim();
            if (afterCode) msg = afterCode;
          } else if (errStr && errStr !== '[object Object]') {
            msg = errStr;
          }
        }
      } catch {}
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const filters: RoleFilter[] = ['ALL', 'WK', 'BAT', 'AR', 'BOWL'];

  if (matchLoading || playersLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + webTopInset + 4, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <SkeletonBox width={40} height={24} borderRadius={6} colors={colors} />
          <SkeletonBox width={140} height={20} borderRadius={6} colors={colors} />
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, gap: 4 }}>
          {[1,2,3].map(i => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border }} />)}
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8, backgroundColor: colors.surfaceElevated }}>
          {[1,2,3,4,5].map(i => <SkeletonBox key={i} width={56} height={30} borderRadius={8} colors={colors} />)}
        </View>
        <View style={{ paddingHorizontal: 12, paddingTop: 12, gap: 10 }}>
          {[1,2,3,4,5,6,7].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, padding: 12 }}>
              <SkeletonBox width={36} height={36} borderRadius={8} colors={colors} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox width="65%" height={13} borderRadius={4} colors={colors} />
                <SkeletonBox width="40%" height={11} borderRadius={4} colors={colors} />
              </View>
              <SkeletonBox width={40} height={32} borderRadius={8} colors={colors} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Match not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 4, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
          {step === 'select' ? (isEditMode ? 'Edit Players' : 'Select Players') : step === 'impact' ? 'Impact Picks' : step === 'captain' ? 'Choose C & VC' : step === 'success' ? 'Contest Joined!' : 'Team Preview'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {step !== 'success' && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, gap: 4 }}>
          {(impactEnabled ? ['select', 'impact', 'captain', 'preview'] : ['select', 'captain', 'preview']).map((s, i, arr) => {
            const stepIndex = arr.indexOf(step);
            const isActive = i <= stepIndex;
            return (
              <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: isActive ? colors.accent : colors.border }} />
            );
          })}
        </View>
      )}

      {step === 'select' && (
        <>
          <View style={[styles.statusBar, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.statusItem}>
              <Text style={[styles.statusLabel, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>Players</Text>
              <Text style={[styles.statusValue, { color: selectedIds.size === 11 ? colors.success : colors.text, fontFamily: 'Inter_700Bold' }]}>
                {selectedIds.size}/11
              </Text>
            </View>
            <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statusItem}>
              <Text style={[styles.statusLabel, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>Credits</Text>
              <Text style={[styles.statusValue, { color: totalCredits > 100 ? colors.error : colors.text, fontFamily: 'Inter_700Bold' }]}>
                {totalCredits.toFixed(1)}
              </Text>
            </View>
            {(['WK', 'BAT', 'AR', 'BOWL'] as const).map((role) => (
              <React.Fragment key={role}>
                <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statusItem}>
                  <Text style={[styles.statusLabel, { color: getRoleColor(role, isDark), fontFamily: 'Inter_600SemiBold' }]}>{role}</Text>
                  <View style={styles.statusRoleRow}>
                    <Text style={[styles.statusValue, { color: roleCounts[role] < ROLE_LIMITS[role].min ? colors.error : colors.success, fontFamily: 'Inter_700Bold' }]}>
                      {roleCounts[role]}
                    </Text>
                    <Text style={[styles.statusRoleRange, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                      ({ROLE_LIMITS[role].min}-{ROLE_LIMITS[role].max})
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
            <View style={[styles.filterRow, { flex: 1, marginHorizontal: 0, paddingHorizontal: 0 }]}>
              {filters.map((f) => {
                const isMaxed = f !== 'ALL' && roleCounts[f] >= ROLE_LIMITS[f].max;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[
                      styles.filterBtn,
                      {
                        backgroundColor: filter === f ? colors.primary : colors.surfaceElevated,
                        borderColor: filter === f ? colors.primary : isMaxed ? colors.error + '40' : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        {
                          color: filter === f ? '#FFF' : isMaxed ? colors.error : colors.textSecondary,
                          fontFamily: 'Inter_600SemiBold',
                        },
                      ]}
                    >
                      {f}
                      {isMaxed ? ' MAX' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={handleAutoSelect}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#E6C200' : '#FFD700',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              })}
            >
              <Ionicons name="flash" size={14} color="#000" />
              <Text style={{ color: '#000', fontSize: 11, fontFamily: 'Inter_700Bold' as const }}>Auto</Text>
            </Pressable>
          </View>

          {filter === 'ALL' ? (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.splitHeader}>
                {([
                  { teamShort: match.team1Short, color: match.team1Color },
                  { teamShort: match.team2Short, color: match.team2Color },
                ] as const).map(({ teamShort, color }) => {
                  const logo = getTeamLogo(teamShort);
                  return (
                    <View key={teamShort} style={[styles.splitHeaderCol, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {logo ? (
                          <Image source={logo} style={{ width: 20, height: 20 }} resizeMode="contain" />
                        ) : (
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#FFF', fontSize: 9, fontFamily: 'Inter_700Bold' as const }}>{teamShort[0]}</Text>
                          </View>
                        )}
                        <Text style={{ color: colors.text, fontSize: 13, fontFamily: 'Inter_700Bold' as const }} numberOfLines={1}>
                          {teamShort}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Inter_400Regular' as const }}>
                        {allPlayers.filter(p => (p.teamShort || p.team) === teamShort).length} players
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.splitContainer}>
                {([
                  { key: 'team1', teamShort: match.team1Short, sections: allTabSections.team1 },
                  { key: 'team2', teamShort: match.team2Short, sections: allTabSections.team2 },
                ] as const).map(({ key, sections }) => (
                  <View key={key} style={styles.splitColumn}>
                    {sections && sections.source !== 'fallback' ? (
                      <>
                        {/* LAST MATCH XI / PLAYING XI section */}
                        {(sections.xi || []).length > 0 && (
                          <>
                            <View style={[styles.sectionLabel, { backgroundColor: colors.surfaceElevated }]}>
                              <Text style={[styles.sectionLabelText, { color: sections.source === 'currentXI' ? '#22C55E' : colors.primary }]}>
                                {sections.source === 'lastMatch' ? '⭐ LAST MATCH XI' : '🟢 PLAYING XI'}
                              </Text>
                            </View>
                            {sections.xi.map(item => (
                              <CompactPlayerItem
                                key={item.id}
                                player={item}
                                isSelected={selectedIds.has(item.id)}
                                onToggle={() => togglePlayer(item)}
                                colors={colors}
                                isDark={isDark}
                                showPlayingXI={hasPlayingXIData}
                                isDisabled={!canSelectPlayer(item)}
                              />
                            ))}
                          </>
                        )}
                        {/* IMPACT PLAYER section — only shown when impact feature is enabled */}
                        {impactEnabled && sections.impact && (
                          <>
                            <View style={[styles.sectionLabel, { backgroundColor: colors.surfaceElevated }]}>
                              <Text style={[styles.sectionLabelText, { color: '#F59E0B' }]}>
                                {sections.source === 'currentXI' ? '⚡ IMPACT OPTIONS' : '⚡ IMPACT PLAYER'}
                              </Text>
                            </View>
                            <CompactPlayerItem
                              key={sections.impact.id}
                              player={sections.impact}
                              isSelected={selectedIds.has(sections.impact.id)}
                              onToggle={() => togglePlayer(sections.impact!)}
                              colors={colors}
                              isDark={isDark}
                              showPlayingXI={hasPlayingXIData}
                              isDisabled={!canSelectPlayer(sections.impact)}
                            />
                          </>
                        )}
                        {/* REST OF SQUAD section */}
                        {(sections.rest || []).length > 0 && (
                          <>
                            <View style={[styles.sectionLabel, { backgroundColor: colors.surfaceElevated }]}>
                              <Text style={[styles.sectionLabelText, { color: colors.textTertiary }]}>⚪ REST OF SQUAD</Text>
                            </View>
                            {sections.rest.map(item => (
                              <CompactPlayerItem
                                key={item.id}
                                player={item}
                                isSelected={selectedIds.has(item.id)}
                                onToggle={() => togglePlayer(item)}
                                colors={colors}
                                isDark={isDark}
                                showPlayingXI={hasPlayingXIData}
                                isDisabled={!canSelectPlayer(item)}
                              />
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      /* Fallback: no section grouping, show all players sorted by credits */
                      (sections?.rest || sortedPlayers.filter(p => (p.teamShort || p.team) === (key === 'team1' ? match.team1Short : match.team2Short))).map(item => (
                        <CompactPlayerItem
                          key={item.id}
                          player={item}
                          isSelected={selectedIds.has(item.id)}
                          onToggle={() => togglePlayer(item)}
                          colors={colors}
                          isDark={isDark}
                          showPlayingXI={hasPlayingXIData}
                          isDisabled={!canSelectPlayer(item)}
                        />
                      ))
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <FlatList
              data={filteredPlayers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <PlayerItem
                  player={item}
                  isSelected={selectedIds.has(item.id)}
                  onToggle={() => togglePlayer(item)}
                  colors={colors}
                  isDark={isDark}
                  showPlayingXI={hasPlayingXIData}
                  isDisabled={!canSelectPlayer(item)}
                />
              )}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!!filteredPlayers.length}
            />
          )}

          {selectionWarning && (
            <View style={{ position: 'absolute', bottom: 120, left: 24, right: 24, backgroundColor: '#F59E0B', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
              <Ionicons name="warning" size={20} color="#000" />
              <Text style={{ color: '#000', fontSize: 13, fontFamily: 'Inter_600SemiBold' as const, flex: 1 }}>{selectionWarning}</Text>
            </View>
          )}

          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 12) }]}>
            {!isValidTeam && selectedIds.size > 0 && validationError && (
              <Text style={[styles.validationErrorText, { color: colors.error, fontFamily: 'Inter_600SemiBold' }]}>
                {validationError}
              </Text>
            )}
            {duplicateError && (
              <Text style={[styles.validationErrorText, { color: colors.error, fontFamily: 'Inter_600SemiBold' }]}>
                {duplicateError}
              </Text>
            )}
            <Pressable
              onPress={() => {
                if (isValidTeam) {
                  setDuplicateError(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep(impactEnabled ? 'impact' : 'captain');
                }
              }}
              disabled={!isValidTeam}
              style={[styles.nextBtn, { opacity: isValidTeam ? 1 : 0.5 }]}
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtnGradient}
              >
                <Text style={[styles.nextBtnText, { fontFamily: 'Inter_700Bold' }]}>
                  {impactEnabled ? 'Next: Impact Picks' : 'Next: Choose Captain'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </LinearGradient>
            </Pressable>
          </View>
        </>
      )}

      {step === 'impact' && impactEnabled && (
        <>
          <View style={[styles.captainInfo, { backgroundColor: colors.surfaceElevated }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MaterialCommunityIcons name="lightning-bolt" size={22} color={colors.warning} />
              <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' as const }}>Impact Picks</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular' as const, lineHeight: 18 }}>
              Pick a Primary and Backup Impact player (same franchise, not in your Main XI). If they enter as Impact Sub, they score for you!
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_700Bold' as const, marginBottom: 8, marginTop: 8 }}>
              PRIMARY IMPACT PICK
            </Text>
            {impactEligiblePlayers.length === 0 ? (
              <Text style={{ color: colors.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular' as const, textAlign: 'center', paddingVertical: 20 }}>No eligible players available</Text>
            ) : (
              impactEligiblePlayers.map(player => {
                const isSelected = primaryImpactId === player.id;
                return (
                  <Pressable
                    key={player.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (isSelected) {
                        setPrimaryImpactId(null);
                        setBackupImpactId(null);
                      } else {
                        setPrimaryImpactId(player.id);
                        if (backupImpactId) {
                          const backupPlayer = allPlayers.find(p => p.id === backupImpactId);
                          if (backupPlayer && (backupPlayer.teamShort || backupPlayer.team || '') !== (player.teamShort || player.team || '')) {
                            setBackupImpactId(null);
                          }
                        }
                      }
                    }}
                    style={[styles.captainItem, { backgroundColor: isSelected ? colors.warning + '15' : colors.card, borderColor: isSelected ? colors.warning + '40' : colors.cardBorder }]}
                  >
                    <View style={styles.captainLeft}>
                      <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role, isDark) + '20' }]}>
                        <Text style={[styles.rolePillText, { color: getRoleColor(player.role, isDark), fontFamily: 'Inter_700Bold' }]}>{player.role}</Text>
                      </View>
                      <View>
                        <Text style={[styles.captainName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>{player.name}</Text>
                        <Text style={[styles.captainMeta, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>{player.teamShort} | {player.credits} Cr</Text>
                      </View>
                    </View>
                    <View style={[styles.checkCircle, { borderColor: isSelected ? colors.warning : colors.border, backgroundColor: isSelected ? colors.warning : 'transparent' }]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                    </View>
                  </Pressable>
                );
              })
            )}

            {primaryImpactId && (
              <>
                <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'Inter_700Bold' as const, marginBottom: 8, marginTop: 16 }}>
                  BACKUP IMPACT PICK (same franchise as {primaryImpactPlayer?.teamShort})
                </Text>
                {backupEligiblePlayers.length === 0 ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular' as const, textAlign: 'center', paddingVertical: 20 }}>No eligible backup players from {primaryImpactPlayer?.teamShort}</Text>
                ) : (
                  backupEligiblePlayers.map(player => {
                    const isSelected = backupImpactId === player.id;
                    return (
                      <Pressable
                        key={player.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setBackupImpactId(isSelected ? null : player.id);
                        }}
                        style={[styles.captainItem, { backgroundColor: isSelected ? colors.primary + '15' : colors.card, borderColor: isSelected ? colors.primary + '40' : colors.cardBorder }]}
                      >
                        <View style={styles.captainLeft}>
                          <View style={[styles.rolePill, { backgroundColor: getRoleColor(player.role, isDark) + '20' }]}>
                            <Text style={[styles.rolePillText, { color: getRoleColor(player.role, isDark), fontFamily: 'Inter_700Bold' }]}>{player.role}</Text>
                          </View>
                          <View>
                            <Text style={[styles.captainName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>{player.name}</Text>
                            <Text style={[styles.captainMeta, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>{player.teamShort} | {player.credits} Cr</Text>
                          </View>
                        </View>
                        <View style={[styles.checkCircle, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                          {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </>
            )}
          </ScrollView>

          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 12) }]}>
            <View style={styles.bottomBarRow}>
              <Pressable
                onPress={() => setStep('select')}
                style={[styles.backStepBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep('captain');
                }}
                style={[styles.saveBtn, { flex: 1 }]}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  <Text style={[styles.saveBtnText, { fontFamily: 'Inter_700Bold' }]}>
                    {primaryImpactId ? 'Next: Choose C & VC' : 'Skip Impact Picks'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {step === 'captain' && (
        <>
          <View style={[styles.captainInfo, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.captainInfoRow}>
              <View style={[styles.captainInfoBadge, { backgroundColor: colors.accent + '20' }]}>
                <Text style={[styles.captainInfoLabel, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>C</Text>
              </View>
              <Text style={[styles.captainInfoText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Captain gets 2x points
              </Text>
            </View>
            <View style={styles.captainInfoRow}>
              <View style={[styles.captainInfoBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.captainInfoLabel, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>VC</Text>
              </View>
              <Text style={[styles.captainInfoText, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Vice-Captain gets 1.5x points
              </Text>
            </View>
          </View>

          {(captainId || vcId) && (
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: captainId ? colors.accent + '12' : colors.surfaceElevated, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: captainId ? colors.accent + '40' : colors.border }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: captainId ? colors.accent : colors.border, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontSize: 10, fontFamily: 'Inter_700Bold' as const }}>C</Text>
                </View>
                <Text style={{ color: captainId ? colors.text : colors.textTertiary, fontSize: 12, fontFamily: captainId ? 'Inter_600SemiBold' as const : 'Inter_400Regular' as const, flex: 1 }} numberOfLines={1}>
                  {(() => {
                    if (captainType === 'impact_slot') {
                      const p = allPlayers.find(pl => pl.id === primaryImpactId);
                      return p ? p.name : 'Impact Slot';
                    }
                    const p = selectedPlayers.find(pl => pl.id === captainId);
                    return p ? p.name : 'Pick Captain';
                  })()}
                </Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: vcId ? colors.primary + '12' : colors.surfaceElevated, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: vcId ? colors.primary + '40' : colors.border }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: vcId ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold' as const }}>VC</Text>
                </View>
                <Text style={{ color: vcId ? colors.text : colors.textTertiary, fontSize: 12, fontFamily: vcId ? 'Inter_600SemiBold' as const : 'Inter_400Regular' as const, flex: 1 }} numberOfLines={1}>
                  {(() => {
                    if (vcType === 'impact_slot') {
                      const p = allPlayers.find(pl => pl.id === primaryImpactId);
                      return p ? p.name : 'Impact Slot';
                    }
                    const p = selectedPlayers.find(pl => pl.id === vcId);
                    return p ? p.name : 'Pick Vice-Captain';
                  })()}
                </Text>
              </View>
            </View>
          )}

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {impactEnabled && primaryImpactId && (() => {
              const impactPlayer = allPlayers.find(p => p.id === primaryImpactId);
              if (!impactPlayer) return null;
              const isCOnSlot = captainType === 'impact_slot';
              const isVCOnSlot = vcType === 'impact_slot';
              return (
                <View style={[styles.captainItem, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30', marginBottom: 12 }]}>
                  <View style={styles.captainLeft}>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color={colors.warning} />
                    <View>
                      <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_700Bold' as const }}>IMPACT SLOT</Text>
                      <Text style={[styles.captainName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                        {impactPlayer.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.captainButtons}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (isCOnSlot) {
                          setCaptainType('player');
                        } else {
                          setCaptainId(null);
                          setCaptainType('impact_slot');
                          if (isVCOnSlot) setVcType('player');
                        }
                      }}
                      style={[styles.captainBtn, { backgroundColor: isCOnSlot ? colors.accent : colors.surfaceElevated, borderColor: isCOnSlot ? colors.accent : colors.border }]}
                    >
                      <Text style={[styles.captainBtnText, { color: isCOnSlot ? '#000' : colors.textSecondary, fontFamily: 'Inter_700Bold' }]}>C</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (isVCOnSlot) {
                          setVcType('player');
                        } else {
                          setVcId(null);
                          setVcType('impact_slot');
                          if (isCOnSlot) setCaptainType('player');
                        }
                      }}
                      style={[styles.captainBtn, { backgroundColor: isVCOnSlot ? colors.primary : colors.surfaceElevated, borderColor: isVCOnSlot ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.captainBtnText, { color: isVCOnSlot ? '#FFF' : colors.textSecondary, fontFamily: 'Inter_700Bold' }]}>VC</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })()}

            {selectedPlayers.map(item => (
              <CaptainItem
                key={item.id}
                player={item}
                isCaptain={captainId === item.id && captainType === 'player'}
                isVC={vcId === item.id && vcType === 'player'}
                onSelectC={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (vcId === item.id && vcType === 'player') setVcId(null);
                  setCaptainId(item.id);
                  setCaptainType('player');
                }}
                onSelectVC={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (captainId === item.id && captainType === 'player') setCaptainId(null);
                  setVcId(item.id);
                  setVcType('player');
                }}
                colors={colors}
                isDark={isDark}
              />
            ))}
          </ScrollView>

          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 12) }]}>
            {duplicateError && (
              <Text style={[styles.validationErrorText, { color: colors.error, fontFamily: 'Inter_600SemiBold' }]}>
                {duplicateError}
              </Text>
            )}
            <View style={styles.bottomBarRow}>
              <Pressable
                onPress={() => setStep(impactEnabled ? 'impact' : 'select')}
                style={[styles.backStepBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (canProceedFromCaptain) {
                    setDuplicateError(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setStep('preview');
                  }
                }}
                disabled={!canProceedFromCaptain}
                style={[styles.saveBtn, { flex: 1, opacity: canProceedFromCaptain ? 1 : 0.5 }]}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  <Text style={[styles.saveBtnText, { fontFamily: 'Inter_700Bold' }]}>
                    Preview Team
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {step === 'preview' && (() => {
        const previewPitchPlayers: PitchPlayer[] = selectedPlayers.map(p => ({
          id: p.id,
          name: p.name,
          role: p.role as 'WK' | 'BAT' | 'AR' | 'BOWL',
          points: p.points || 0,
          teamShort: p.teamShort,
        }));
        return (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.previewMatchInfo, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.previewMatchTitle, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
                {match.team1Short} vs {match.team2Short}
              </Text>
              <Text style={[styles.previewMatchVenue, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                {match.venue}
              </Text>
            </View>

            <TeamPitchView
              players={previewPitchPlayers}
              captainId={captainId}
              viceCaptainId={vcId}
            />

            <View style={[styles.previewSummary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.previewSummaryRow}>
                <Text style={[styles.previewSummaryLabel, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>Total Players</Text>
                <Text style={[styles.previewSummaryValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>{selectedIds.size}</Text>
              </View>
              <View style={styles.previewSummaryRow}>
                <Text style={[styles.previewSummaryLabel, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>Total Credits</Text>
                <Text style={[styles.previewSummaryValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>{totalCredits.toFixed(1)}</Text>
              </View>
            </View>

            {impactEnabled && primaryImpactId && (() => {
              const primaryP = allPlayers.find(p => p.id === primaryImpactId);
              const backupP = backupImpactId ? allPlayers.find(p => p.id === backupImpactId) : null;
              return (
                <View style={[styles.previewSummary, { backgroundColor: colors.warning + '08', borderColor: colors.warning + '25', marginTop: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: 14, fontFamily: 'Inter_700Bold' as const }}>Impact Zone</Text>
                  </View>
                  <View style={styles.previewSummaryRow}>
                    <Text style={[styles.previewSummaryLabel, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>Primary</Text>
                    <Text style={[styles.previewSummaryValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>{primaryP?.name || '—'}</Text>
                  </View>
                  {backupP && (
                    <View style={styles.previewSummaryRow}>
                      <Text style={[styles.previewSummaryLabel, { color: colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>Backup</Text>
                      <Text style={[styles.previewSummaryValue, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>{backupP.name}</Text>
                    </View>
                  )}
                  {captainType === 'impact_slot' && (
                    <View style={styles.previewSummaryRow}>
                      <Text style={[styles.previewSummaryLabel, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>Captain on Impact Slot</Text>
                      <Text style={[styles.previewSummaryValue, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>2x</Text>
                    </View>
                  )}
                  {vcType === 'impact_slot' && (
                    <View style={styles.previewSummaryRow}>
                      <Text style={[styles.previewSummaryLabel, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>VC on Impact Slot</Text>
                      <Text style={[styles.previewSummaryValue, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>1.5x</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {impactEnabled && (
              <View style={[styles.previewSummary, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 }]}>
                <Pressable
                  onPress={() => {
                    if (weeklyUsageData?.canUseInvisibleMode === false && !invisibleMode) {
                      return;
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInvisibleMode(!invisibleMode);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="eye-off" size={20} color={invisibleMode ? colors.primary : colors.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' as const }}>Invisible Mode</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' as const }}>
                        {weeklyUsageData?.canUseInvisibleMode === false && !invisibleMode
                          ? 'Weekly limit reached (1/week)'
                          : 'Hide your team from others until match ends'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: invisibleMode ? colors.primary : colors.surfaceElevated, justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', alignSelf: invisibleMode ? 'flex-end' : 'flex-start' }} />
                  </View>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {saveError && (
            <View style={{ position: 'absolute', top: insets.top + webTopInset + 60, left: 16, right: 16, backgroundColor: '#EF4444', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, zIndex: 100 }}>
              <Ionicons name="alert-circle" size={22} color="#FFF" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' as const }}>Submission Failed</Text>
                <Text style={{ color: '#FFFFFFDD', fontSize: 13, fontFamily: 'Inter_500Medium' as const, marginTop: 2 }}>{saveError}</Text>
              </View>
              <Pressable onPress={() => setSaveError(null)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#FFF" />
              </Pressable>
            </View>
          )}

          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 12) }]}>
            <View style={styles.bottomBarRow}>
              <Pressable
                onPress={() => { setSaveError(null); setStep('captain'); }}
                style={[styles.backStepBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={handleSubmitPressed}
                disabled={isSaving}
                style={[styles.saveBtn, { flex: 1, opacity: isSaving ? 0.5 : 1 }]}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={22} color="#000" />
                      <Text style={[styles.saveBtnText, { fontFamily: 'Inter_700Bold' }]}>
                        {isEditMode ? 'Update Team' : 'Submit Team'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </>
        );
      })()}

      {step === 'success' && (() => {
        const pitchPlayers: PitchPlayer[] = selectedPlayers.map(p => ({
          id: p.id,
          name: p.name,
          role: p.role as 'WK' | 'BAT' | 'AR' | 'BOWL',
          points: p.points || 0,
          teamShort: p.teamShort,
        }));
        return (
          <>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#22C55E20', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                  <Ionicons name="checkmark-circle" size={44} color="#22C55E" />
                </View>
                <Text style={{ color: colors.text, fontSize: 22, fontFamily: 'Inter_700Bold' as const }}>
                  Success!
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_500Medium' as const, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 }}>
                  {isEditMode
                    ? 'Your team has been updated successfully.'
                    : 'Your team has been submitted and you have joined the contest.'}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' as const, marginTop: 4 }}>
                  {match?.team1Short} vs {match?.team2Short}
                </Text>
              </View>
              <TeamPitchView
                players={pitchPlayers}
                captainId={captainId}
                viceCaptainId={vcId}
              />
            </ScrollView>
            <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 12) }]}>
              <Pressable
                onPress={() => router.replace('/(tabs)/my-matches')}
                style={[styles.saveBtn, { flex: 1 }]}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  <Ionicons name="trophy" size={20} color="#000" />
                  <Text style={[styles.saveBtnText, { fontFamily: 'Inter_700Bold' }]}>
                    Go to My Matches
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        );
      })()}

      <Modal
        visible={showSplash}
        transparent
        animationType="none"
        onRequestClose={() => {}}
      >
        <View style={splashStyles.overlay}>
          <Animated.View style={[splashStyles.content, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}>
            <Text style={splashStyles.emoji}>🏏</Text>
            <Text style={[splashStyles.message, { color: '#FFF', fontFamily: 'Inter_700Bold' as const }]}>
              {splashMessage}
            </Text>
            <View style={splashStyles.checkRow}>
              <View style={splashStyles.checkCircle}>
                <Ionicons name="checkmark" size={32} color="#FFF" />
              </View>
            </View>
            <Text style={[splashStyles.subtext, { fontFamily: 'Inter_500Medium' as const }]}>
              Team submitted successfully!
            </Text>
            {banterLine ? (
              <Text style={[splashStyles.subtext, { fontFamily: 'Inter_500Medium' as const, color: '#FFFFFFbb' }]}>
                {banterLine}
              </Text>
            ) : null}
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showPredictionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPredictionModal(false)}
      >
        <View style={predStyles.overlay}>
          <View style={[predStyles.modal, { backgroundColor: colors.card }]}>
            <View style={predStyles.modalHeader}>
              <MaterialCommunityIcons name="trophy" size={32} color={colors.accent} />
              <Text style={[predStyles.modalTitle, { color: colors.text, fontFamily: 'Inter_700Bold' as const }]}>
                Who will win?
              </Text>
              <Text style={[predStyles.modalSubtitle, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' as const }]}>
                Pick the match winner before submitting your team
              </Text>
            </View>

            <View style={predStyles.teamOptions}>
              <Pressable
                onPress={() => { setSelectedWinner(match?.team1Short || ''); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[
                  predStyles.teamOption,
                  {
                    borderColor: selectedWinner === match?.team1Short ? colors.accent : colors.border,
                    backgroundColor: selectedWinner === match?.team1Short ? colors.accent + '15' : colors.surfaceElevated,
                  },
                ]}
              >
                <View style={[predStyles.teamBadge, { backgroundColor: (match?.team1Color || '#333') + '30' }]}>
                  <Text style={[predStyles.teamBadgeText, { color: match?.team1Color || '#333', fontFamily: 'Inter_700Bold' as const }]}>
                    {(match?.team1Short || '?')[0]}
                  </Text>
                </View>
                <Text style={[predStyles.teamName, { color: colors.text, fontFamily: 'Inter_600SemiBold' as const }]}>
                  {match?.team1Short}
                </Text>
                <Text style={[predStyles.teamFullName, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' as const }]} numberOfLines={1}>
                  {match?.team1}
                </Text>
                {selectedWinner === match?.team1Short && (
                  <View style={[predStyles.checkCircle, { backgroundColor: colors.accent }]}>
                    <Ionicons name="checkmark" size={16} color="#000" />
                  </View>
                )}
              </Pressable>

              <Text style={[predStyles.vsText, { color: colors.textTertiary, fontFamily: 'Inter_700Bold' as const }]}>
                VS
              </Text>

              <Pressable
                onPress={() => { setSelectedWinner(match?.team2Short || ''); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[
                  predStyles.teamOption,
                  {
                    borderColor: selectedWinner === match?.team2Short ? colors.accent : colors.border,
                    backgroundColor: selectedWinner === match?.team2Short ? colors.accent + '15' : colors.surfaceElevated,
                  },
                ]}
              >
                <View style={[predStyles.teamBadge, { backgroundColor: (match?.team2Color || '#666') + '30' }]}>
                  <Text style={[predStyles.teamBadgeText, { color: match?.team2Color || '#666', fontFamily: 'Inter_700Bold' as const }]}>
                    {(match?.team2Short || '?')[0]}
                  </Text>
                </View>
                <Text style={[predStyles.teamName, { color: colors.text, fontFamily: 'Inter_600SemiBold' as const }]}>
                  {match?.team2Short}
                </Text>
                <Text style={[predStyles.teamFullName, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' as const }]} numberOfLines={1}>
                  {match?.team2}
                </Text>
                {selectedWinner === match?.team2Short && (
                  <View style={[predStyles.checkCircle, { backgroundColor: colors.accent }]}>
                    <Ionicons name="checkmark" size={16} color="#000" />
                  </View>
                )}
              </Pressable>
            </View>

            <Text style={[predStyles.lockNotice, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' as const }]}>
              Predictions are hidden until the match goes live
            </Text>

            <View style={predStyles.modalActions}>
              <Pressable
                onPress={() => setShowPredictionModal(false)}
                style={[predStyles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[predStyles.cancelBtnText, { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' as const }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handlePredictionConfirm}
                disabled={!selectedWinner || predictionSaving}
                style={[predStyles.confirmBtn, { opacity: (!selectedWinner || predictionSaving) ? 0.5 : 1 }]}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={predStyles.confirmBtnGradient}
                >
                  {predictionSaving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={[predStyles.confirmBtnText, { fontFamily: 'Inter_700Bold' as const }]}>
                      Confirm & Submit
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const predStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  modalTitle: {
    fontSize: 20,
    marginTop: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  teamOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  teamOption: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
    position: 'relative' as const,
  },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamBadgeText: {
    fontSize: 22,
  },
  teamName: {
    fontSize: 16,
  },
  teamFullName: {
    fontSize: 11,
    textAlign: 'center' as const,
  },
  checkCircle: {
    position: 'absolute' as const,
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    fontSize: 14,
  },
  lockNotice: {
    fontSize: 11,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  confirmBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#000',
  },
});

const splashStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  emoji: {
    fontSize: 64,
  },
  message: {
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 32,
  },
  checkRow: {
    marginTop: 8,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtext: {
    fontSize: 14,
    color: '#FFFFFFAA',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center' as const,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  headerTitle: {
    fontSize: 18,
  },
  statusBar: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center' as const,
  },
  statusItem: {
    alignItems: 'center',
    gap: 2,
  },
  statusLabel: {
    fontSize: 10,
  },
  statusValue: {
    fontSize: 14,
  },
  statusRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusRoleRange: {
    fontSize: 9,
  },
  statusDivider: {
    width: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    cursor: 'pointer' as any,
  },
  filterText: {
    fontSize: 12,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    cursor: 'pointer' as any,
  },
  playerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  rolePillText: {
    fontSize: 10,
  },
  playerItemInfo: {
    flex: 1,
  },
  playerItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerItemName: {
    fontSize: 14,
  },
  playerItemTeam: {
    fontSize: 11,
    marginTop: 1,
  },
  playerItemRight: {
    alignItems: 'flex-end',
    marginRight: 10,
    gap: 4,
  },
  playerCredits: {
    fontSize: 14,
  },
  formRow: {
    flexDirection: 'row',
    gap: 3,
  },
  formDot: {
    width: 22,
    height: 18,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formDotText: {
    fontSize: 9,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center' as const,
  },
  validationErrorText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  nextBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    cursor: 'pointer' as any,
  },
  nextBtnGradient: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
  },
  nextBtnText: {
    fontSize: 16,
    color: '#000',
  },
  captainInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  captainInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  captainInfoBadge: {
    width: 30,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captainInfoLabel: {
    fontSize: 12,
  },
  captainInfoText: {
    fontSize: 13,
  },
  captainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  captainLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  captainName: {
    fontSize: 14,
  },
  captainMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  captainButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  captainBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  captainBtnText: {
    fontSize: 15,
  },
  bottomBarRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backStepBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    cursor: 'pointer' as any,
  },
  saveBtnGradient: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 16,
    color: '#000',
  },
  previewMatchInfo: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  previewMatchTitle: {
    fontSize: 18,
  },
  previewMatchVenue: {
    fontSize: 12,
    marginTop: 4,
  },
  previewCaptainRow: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  previewCaptainItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewCaptainBadge: {
    width: 32,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCaptainBadgeText: {
    fontSize: 13,
    color: '#000',
  },
  previewCaptainName: {
    fontSize: 13,
    flex: 1,
  },
  previewCaptainMult: {
    fontSize: 12,
  },
  previewDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 10,
  },
  previewSection: {
    marginBottom: 14,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  previewRolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewRolePillText: {
    fontSize: 11,
  },
  previewRoleCount: {
    fontSize: 12,
  },
  previewPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  previewPlayerLeft: {
    flex: 1,
  },
  previewPlayerName: {
    fontSize: 14,
  },
  previewPlayerTeam: {
    fontSize: 11,
    marginTop: 2,
  },
  previewBadgePill: {
    width: 28,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBadgePillText: {
    fontSize: 12,
    color: '#000',
  },
  previewSummary: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    gap: 8,
  },
  previewSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewSummaryLabel: {
    fontSize: 13,
  },
  previewSummaryValue: {
    fontSize: 14,
  },
  splitHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    position: 'sticky' as any,
    top: 0,
    zIndex: 10,
  },
  splitHeaderCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  splitContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  splitColumn: {
    flex: 1,
    gap: 6,
  },
  sectionLabel: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionLabelText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold' as const,
    letterSpacing: 0.5,
  },
  compactCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    minHeight: 64,
    cursor: 'pointer' as any,
  },
  compactRolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  compactCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
