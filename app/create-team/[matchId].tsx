import React, { useState, useMemo, useRef } from 'react';
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
  Animated as RNAnimated,
} from 'react-native';
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

type Step = 'select' | 'captain' | 'preview' | 'success';
type RoleFilter = 'ALL' | 'WK' | 'BAT' | 'AR' | 'BOWL';

const ROLE_LIMITS = {
  WK: { min: 1, max: 4 },
  BAT: { min: 1, max: 6 },
  AR: { min: 1, max: 4 },
  BOWL: { min: 1, max: 4 },
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
          backgroundColor: isSelected ? colors.primary + '15' : colors.card,
          borderColor: isSelected ? colors.primary + '40' : colors.cardBorder,
          borderLeftWidth: showPlayingXI ? 3 : 1,
          borderLeftColor: showPlayingXI ? xiIndicatorColor : (isSelected ? colors.primary + '40' : colors.cardBorder),
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
                  {isInXI ? 'XI' : 'OUT'}
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
          {player.credits}
        </Text>
        <View style={styles.formRow}>
          {player.recentForm.slice(0, 3).map((v, i) => (
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
      <View style={[styles.checkCircle, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
        {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
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
  const [filter, setFilter] = useState<RoleFilter>('ALL');
  const [isSaving, setIsSaving] = useState(false);

  const { data: matchData, isLoading: matchLoading } = useQuery<{ match: Match }>({
    queryKey: ['/api/matches', matchId],
    enabled: !!matchId,
  });

  const { data: playersData, isLoading: playersLoading } = useQuery<{ players: Player[] }>({
    queryKey: ['/api/matches', matchId, 'players'],
    enabled: !!matchId,
  });

  const match = matchData?.match;
  const allPlayers = playersData?.players || [];
  const existingTeams = matchId ? getTeamsForMatch(matchId) : [];

  const filteredPlayers = useMemo(() => {
    if (filter === 'ALL') return allPlayers;
    return allPlayers.filter((p) => p.role === filter);
  }, [allPlayers, filter]);

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
      return samePlayerIds && sameCaptain && sameVC;
    });
  };

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

  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [predictionSaving, setPredictionSaving] = useState(false);
  const [hasPredicted, setHasPredicted] = useState(false);

  const { data: existingPrediction } = useQuery<{ myPrediction: { predictedWinner: string } | null }>({
    queryKey: ['/api/predictions', matchId],
    enabled: !!matchId,
  });

  const handleSubmitPressed = () => {
    if (!captainId || !vcId || !matchId || isSaving) return;
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
    if (!captainId || !vcId || !matchId || isSaving) return;
    if (isDuplicateTeam(captainId, vcId)) {
      setDuplicateError('You have already created this exact team. Please change at least one player or the Captain/VC.');
      setStep('captain');
      return;
    }
    setIsSaving(true);
    setDuplicateError(null);
    setSaveError(null);
    try {
      if (isEditMode && editTeamId) {
        await updateTeam({
          teamId: editTeamId,
          playerIds: Array.from(selectedIds),
          captainId,
          viceCaptainId: vcId,
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
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
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
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          {step === 'select' ? (isEditMode ? 'Edit Players' : 'Select Players') : step === 'captain' ? 'Choose C & VC' : step === 'success' ? 'Contest Joined!' : 'Team Preview'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

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

          <View style={styles.filterRow}>
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
            scrollEnabled={filteredPlayers.length > 0}
          />

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
                  setStep('captain');
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
                  Next: Choose Captain
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </LinearGradient>
            </Pressable>
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

          <FlatList
            data={selectedPlayers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CaptainItem
                player={item}
                isCaptain={captainId === item.id}
                isVC={vcId === item.id}
                onSelectC={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (vcId === item.id) setVcId(null);
                  setCaptainId(item.id);
                }}
                onSelectVC={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (captainId === item.id) setCaptainId(null);
                  setVcId(item.id);
                }}
                colors={colors}
                isDark={isDark}
              />
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={selectedPlayers.length > 0}
          />

          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 12) }]}>
            {duplicateError && (
              <Text style={[styles.validationErrorText, { color: colors.error, fontFamily: 'Inter_600SemiBold' }]}>
                {duplicateError}
              </Text>
            )}
            <View style={styles.bottomBarRow}>
              <Pressable
                onPress={() => setStep('select')}
                style={[styles.backStepBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (captainId && vcId) {
                    setDuplicateError(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setStep('preview');
                  }
                }}
                disabled={!captainId || !vcId}
                style={[styles.saveBtn, { flex: 1, opacity: captainId && vcId ? 1 : 0.5 }]}
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
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  statusBar: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
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
  },
  validationErrorText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  nextBtn: {
    borderRadius: 14,
    overflow: 'hidden',
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
  },
  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
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
});
