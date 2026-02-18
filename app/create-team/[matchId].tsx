import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeams } from '@/contexts/TeamContext';
import { useAuth } from '@/contexts/AuthContext';
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
  BAT: { min: 3, max: 6 },
  AR: { min: 1, max: 4 },
  BOWL: { min: 3, max: 6 },
};

function PlayerItem({
  player,
  isSelected,
  onToggle,
  colors,
  isDark,
  showPlayingXI,
}: {
  player: Player;
  isSelected: boolean;
  onToggle: () => void;
  colors: any;
  isDark: boolean;
  showPlayingXI: boolean;
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

  const isValidTeam = useMemo(() => {
    if (selectedIds.size !== 11) return false;
    for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
      const count = roleCounts[role as keyof typeof roleCounts];
      if (count < limits.min || count > limits.max) return false;
    }
    return true;
  }, [selectedIds, roleCounts]);

  const validationError = useMemo(() => {
    if (selectedIds.size > 0 && selectedIds.size !== 11) {
      return `Select ${11 - selectedIds.size} more player${11 - selectedIds.size !== 1 ? 's' : ''} (${selectedIds.size}/11)`;
    }
    for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
      const count = roleCounts[role as keyof typeof roleCounts];
      if (count < limits.min) {
        return `Need at least ${limits.min} ${getRoleLabel(role)}${limits.min > 1 ? 's' : ''} (you have ${count})`;
      }
      if (count > limits.max) {
        return `Too many ${getRoleLabel(role)}s (max ${limits.max})`;
      }
    }
    return null;
  }, [selectedIds, roleCounts]);

  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const isDuplicateTeam = useMemo(() => {
    if (selectedIds.size !== 11) return false;
    const selectedArray = Array.from(selectedIds).sort();
    return existingTeams.some((team) => {
      if (isEditMode && team.id === editTeamId) return false;
      const teamIds = [...team.playerIds].sort();
      if (teamIds.length !== selectedArray.length) return false;
      return teamIds.every((id, i) => id === selectedArray[i]);
    });
  }, [selectedIds, existingTeams, isEditMode, editTeamId]);

  const canSelectPlayer = (player: Player) => {
    if (selectedIds.has(player.id)) return true;
    if (selectedIds.size >= 11) return false;
    const count = roleCounts[player.role];
    if (count >= ROLE_LIMITS[player.role].max) return false;
    return true;
  };

  const togglePlayer = (player: Player) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSet = new Set(selectedIds);
    if (newSet.has(player.id)) {
      newSet.delete(player.id);
    } else {
      if (!canSelectPlayer(player)) return;
      newSet.add(player.id);
    }
    setSelectedIds(newSet);
  };

  const handleSaveTeam = async () => {
    if (!captainId || !vcId || !matchId || isSaving) return;
    setIsSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

      setStep('success');
    } catch (e) {
      console.error('Save team error:', e);
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
          {step === 'select' ? (isEditMode ? 'Edit Players' : 'Select Players') : step === 'captain' ? 'Choose C & VC' : step === 'success' ? 'Team Saved!' : 'Team Preview'}
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
            {filters.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: filter === f ? colors.primary : colors.surfaceElevated,
                    borderColor: filter === f ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: filter === f ? '#FFF' : colors.textSecondary,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                >
                  {f}
                </Text>
              </Pressable>
            ))}
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
              />
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={filteredPlayers.length > 0}
          />

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
                  if (isDuplicateTeam) {
                    setDuplicateError('This team already exists. Change at least one player.');
                    return;
                  }
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

      {step === 'preview' && (
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

            <View style={[styles.previewCaptainRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.previewCaptainItem}>
                <View style={[styles.previewCaptainBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.previewCaptainBadgeText, { fontFamily: 'Inter_700Bold' }]}>C</Text>
                </View>
                <Text style={[styles.previewCaptainName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                  {selectedPlayers.find((p) => p.id === captainId)?.name || 'N/A'}
                </Text>
                <Text style={[styles.previewCaptainMult, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>2x</Text>
              </View>
              <View style={[styles.previewDivider, { backgroundColor: colors.border }]} />
              <View style={styles.previewCaptainItem}>
                <View style={[styles.previewCaptainBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.previewCaptainBadgeText, { color: '#FFF', fontFamily: 'Inter_700Bold' }]}>VC</Text>
                </View>
                <Text style={[styles.previewCaptainName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                  {selectedPlayers.find((p) => p.id === vcId)?.name || 'N/A'}
                </Text>
                <Text style={[styles.previewCaptainMult, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>1.5x</Text>
              </View>
            </View>

            {(['WK', 'BAT', 'AR', 'BOWL'] as const).map((role) => {
              const rolePlayers = selectedPlayers.filter((p) => p.role === role);
              if (rolePlayers.length === 0) return null;
              return (
                <View key={role} style={styles.previewSection}>
                  <View style={styles.previewSectionHeader}>
                    <View style={[styles.previewRolePill, { backgroundColor: getRoleColor(role, isDark) + '20' }]}>
                      <Text style={[styles.previewRolePillText, { color: getRoleColor(role, isDark), fontFamily: 'Inter_700Bold' }]}>
                        {role}
                      </Text>
                    </View>
                    <Text style={[styles.previewRoleCount, { color: colors.textTertiary, fontFamily: 'Inter_500Medium' }]}>
                      {rolePlayers.length} player{rolePlayers.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {rolePlayers.map((p) => (
                    <View key={p.id} style={[styles.previewPlayerRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.previewPlayerLeft}>
                        <Text style={[styles.previewPlayerName, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={[styles.previewPlayerTeam, { color: colors.textTertiary, fontFamily: 'Inter_400Regular' }]}>
                          {p.teamShort} | {p.credits} Cr
                        </Text>
                      </View>
                      {p.id === captainId && (
                        <View style={[styles.previewBadgePill, { backgroundColor: colors.accent }]}>
                          <Text style={[styles.previewBadgePillText, { fontFamily: 'Inter_700Bold' }]}>C</Text>
                        </View>
                      )}
                      {p.id === vcId && (
                        <View style={[styles.previewBadgePill, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.previewBadgePillText, { color: '#FFF', fontFamily: 'Inter_700Bold' }]}>VC</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}

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

          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 12) }]}>
            <View style={styles.bottomBarRow}>
              <Pressable
                onPress={() => setStep('captain')}
                style={[styles.backStepBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={handleSaveTeam}
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
                        {isEditMode ? 'Update Team' : 'Save Team'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </>
      )}

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
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#22C55E20', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
                </View>
                <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold' as const }}>
                  {isEditMode ? 'Team Updated!' : 'Team Created!'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular' as const, marginTop: 4 }}>
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
                onPress={() => router.back()}
                style={[styles.saveBtn, { flex: 1 }]}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  <Ionicons name="home" size={20} color="#000" />
                  <Text style={[styles.saveBtnText, { fontFamily: 'Inter_700Bold' }]}>
                    Back to Match
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        );
      })()}
    </View>
  );
}

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
