import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MatchInfo {
  id: string;
  team1Short: string;
  team2Short: string;
  startTime: string;
  potProcessed?: boolean;
  entryStake?: number;
}

interface PotMatch {
  id: string;
  team1Short: string;
  team2Short: string;
  startTime: string;
  potProcessed?: boolean;
  entrantUserIds?: string[];
}

interface UserInfo {
  id: string;
  username: string;
  teamName?: string;
}

interface TournamentPotProps {
  colors: any;
  matches: MatchInfo[];
  potTournamentNames: string[];
  potSelectedTournament: string;
  potShowNewInput: boolean;
  potNewTournament: string;
  potLoadingMatches: boolean;
  potUnprocessedMatches: PotMatch[];
  potSelectedMatchId: string;
  potStake: string;
  potMode: 'entries_only' | 'entries_plus_penalty';
  potPenaltyUserIds: string[];
  potExcludeUserIds: string[];
  potUsersLoading: boolean;
  allUsers: UserInfo[];
  potProcessing: boolean;
  onSetPotSelectedTournament: (val: string) => void;
  onSetPotShowNewInput: (val: boolean) => void;
  onSetPotNewTournament: (val: string) => void;
  onSetPotSelectedMatchId: (val: string) => void;
  onSetPotStake: (val: string) => void;
  onSetPotMode: (val: 'entries_only' | 'entries_plus_penalty') => void;
  onSetPotPenaltyUserIds: (updater: (prev: string[]) => string[]) => void;
  onSetPotExcludeUserIds: (updater: (prev: string[]) => string[]) => void;
  onProcess: () => void;
  potResetting: boolean;
  onResetTournament: () => void;
}

export function TournamentPot({
  colors,
  matches,
  potTournamentNames,
  potSelectedTournament,
  potShowNewInput,
  potNewTournament,
  potLoadingMatches,
  potUnprocessedMatches,
  potSelectedMatchId,
  potStake,
  potMode,
  potPenaltyUserIds,
  potExcludeUserIds,
  potUsersLoading,
  allUsers,
  potProcessing,
  onSetPotSelectedTournament,
  onSetPotShowNewInput,
  onSetPotNewTournament,
  onSetPotSelectedMatchId,
  onSetPotStake,
  onSetPotMode,
  onSetPotPenaltyUserIds,
  onSetPotExcludeUserIds,
  onProcess,
  potResetting,
  onResetTournament,
}: TournamentPotProps) {
  const unprocessedCount = potUnprocessedMatches.filter(m => !m.potProcessed).length;
  const processedCount = matches.filter(m => m.potProcessed).length;
  const [showProcessed, setShowProcessed] = React.useState(false);
  const [confirmingReset, setConfirmingReset] = React.useState(false);
  const visibleMatches = potUnprocessedMatches.filter(m => showProcessed ? true : !m.potProcessed);

  return (
    <View style={{ marginBottom: 28 }}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text style={{ fontSize: 18, marginBottom: 0, borderLeftWidth: 3, paddingLeft: 10, color: colors.text, fontFamily: 'Inter_700Bold', borderLeftColor: colors.accent }}>
          Tournament Pot Management
        </Text>
        {unprocessedCount > 0 && (
          <View style={{ backgroundColor: '#F59E0B20', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, borderWidth: 1, borderColor: '#F59E0B40' }}>
            <Text style={{ color: '#F59E0B', fontSize: 11, fontFamily: 'Inter_700Bold' }}>{unprocessedCount}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 13, marginBottom: 14, lineHeight: 18, color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>
        Process zero-sum pot distribution for completed matches.
      </Text>

      <View style={{ borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14, backgroundColor: colors.card, borderColor: colors.cardBorder }}>

        {/* Tournament selector */}
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase', color: colors.textTertiary }}>
          TOURNAMENT / SERIES
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {potTournamentNames.map(name => (
              <Pressable
                key={name}
                onPress={() => { onSetPotSelectedTournament(name); onSetPotShowNewInput(false); onSetPotNewTournament(''); }}
                style={{
                  borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1,
                  backgroundColor: name === potSelectedTournament ? colors.primary : colors.surfaceElevated,
                  borderColor: name === potSelectedTournament ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: name === potSelectedTournament ? '#FFF' : colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                  {name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => { onSetPotShowNewInput(true); onSetPotSelectedTournament(''); }}
              style={{
                borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1,
                borderStyle: 'dashed' as any,
                backgroundColor: potShowNewInput ? colors.primary + '15' : colors.surfaceElevated,
                borderColor: potShowNewInput ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: potShowNewInput ? colors.primary : colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                + Add New
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {potShowNewInput && (
          <TextInput
            style={{ height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, marginBottom: 8, backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }}
            value={potNewTournament}
            onChangeText={onSetPotNewTournament}
            placeholder="e.g. T20 World Cup"
            placeholderTextColor={colors.textTertiary}
          />
        )}

        {/* Match selector */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 4 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textTertiary }}>
            SELECT MATCH
          </Text>
          {processedCount > 0 && (
            <Pressable onPress={() => setShowProcessed(prev => !prev)}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.primary }}>
                {showProcessed ? 'Hide processed' : `Show processed (${processedCount})`}
              </Text>
            </Pressable>
          )}
        </View>
        {potLoadingMatches ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        ) : visibleMatches.length === 0 ? (
          <View style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surfaceElevated, borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>No completed matches found</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {visibleMatches.map(m => {
                const isSelected = m.id === potSelectedMatchId;
                const isProcessed = !!m.potProcessed;
                const matchDate = new Date(m.startTime);
                const formatted = matchDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const fullMatch = matches.find(fm => fm.id === m.id);
                const stake = fullMatch?.entryStake;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => { onSetPotSelectedMatchId(m.id); onSetPotPenaltyUserIds(() => []); }}
                    style={{
                      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5, alignItems: 'center',
                      backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                      borderColor: isSelected ? colors.primary : isProcessed ? colors.success + '50' : colors.border,
                    }}
                  >
                    <Text style={{ color: isSelected ? '#FFF' : colors.text, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                      {m.team1Short} vs {m.team2Short}
                    </Text>
                    <Text style={{ color: isSelected ? '#FFFFFF90' : colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 }}>
                      {formatted}{stake ? ` · ₹${stake}` : ''}{isProcessed ? ' · ✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Stake input */}
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginBottom: 6, marginTop: 4, textTransform: 'uppercase', color: colors.textTertiary }}>
          ENTRY STAKE (₹)
        </Text>
        <TextInput
          style={{ height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, marginBottom: 8, backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border, fontFamily: 'Inter_500Medium' }}
          value={potStake}
          onChangeText={onSetPotStake}
          placeholder="30"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
        />

        {/* Pot mode */}
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', color: colors.textTertiary }}>
          POT MODE
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {([['entries_only', 'Entries Only'], ['entries_plus_penalty', 'Entries + Penalty']] as const).map(([mode, label]) => (
            <Pressable
              key={mode}
              onPress={() => { onSetPotMode(mode); if (mode === 'entries_only') onSetPotPenaltyUserIds(() => []); }}
              style={{
                flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center',
                backgroundColor: potMode === mode ? colors.error + '15' : colors.surfaceElevated,
                borderColor: potMode === mode ? colors.error : colors.border,
              }}
            >
              <Text style={{ color: potMode === mode ? colors.error : colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Penalty user selector */}
        {potMode === 'entries_plus_penalty' && (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginBottom: 8 }}>
              Select users who receive a penalty (₹{potStake || '?'} deducted — same as stake). These users are NOT contest entrants.
            </Text>
            {potUsersLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={{ gap: 6 }}>
                {(() => {
                  const selectedMatchData = potUnprocessedMatches.find(m => m.id === potSelectedMatchId);
                  const entrantIds = new Set(selectedMatchData?.entrantUserIds || []);
                  return allUsers.map(u => {
                    const isSelected = potPenaltyUserIds.includes(u.id);
                    const isEntrant = entrantIds.has(u.id);
                    return (
                      <Pressable
                        key={u.id}
                        onPress={() => {
                          if (isEntrant) return;
                          onSetPotPenaltyUserIds(prev =>
                            prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          );
                        }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1,
                          backgroundColor: isEntrant ? colors.surfaceElevated : isSelected ? colors.error + '12' : colors.surfaceElevated,
                          borderColor: isEntrant ? colors.border : isSelected ? colors.error + '50' : colors.border,
                          opacity: isEntrant ? 0.45 : 1,
                        }}
                      >
                        <View style={{
                          width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
                          borderColor: isEntrant ? colors.border : isSelected ? colors.error : colors.border,
                          backgroundColor: isEntrant ? 'transparent' : isSelected ? colors.error : 'transparent',
                        }}>
                          {isSelected && !isEntrant && <Ionicons name="checkmark" size={13} color="#FFF" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: isEntrant ? colors.textTertiary : colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{u.username}</Text>
                          {isEntrant ? (
                            <Text style={{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11 }}>Already entered contest</Text>
                          ) : u.teamName ? (
                            <Text style={{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11 }}>{u.teamName}</Text>
                          ) : null}
                        </View>
                        {isSelected && !isEntrant && (
                          <Text style={{ color: colors.error, fontFamily: 'Inter_700Bold', fontSize: 12 }}>-₹{potStake || '?'}</Text>
                        )}
                      </Pressable>
                    );
                  });
                })()}
                {allUsers.length === 0 && (
                  <Text style={{ color: colors.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular' }}>No users found.</Text>
                )}
              </View>
            )}
            {potPenaltyUserIds.length > 0 && (
              <View style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.error + '10', borderWidth: 1, borderColor: colors.error + '30' }}>
                <Text style={{ color: colors.error, fontFamily: 'Inter_700Bold', fontSize: 12, marginBottom: 2 }}>Penalty Summary</Text>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                  {potPenaltyUserIds.length} {potPenaltyUserIds.length === 1 ? 'user' : 'users'} × ₹{potStake || '?'} = ₹{potPenaltyUserIds.length * (parseInt(potStake) || 0)} added to pot
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Exclude entrants */}
        {potSelectedMatchId && (() => {
          const selectedMatchData = potUnprocessedMatches.find(m => m.id === potSelectedMatchId);
          const entrantIds = selectedMatchData?.entrantUserIds || [];
          if (entrantIds.length === 0) return null;
          const entrantUsers = allUsers.filter(u => entrantIds.includes(u.id));
          if (entrantUsers.length === 0) return null;
          return (
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="person-remove-outline" size={14} color="#F59E0B" />
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textTertiary }}>
                  EXCLUDE FROM POT
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginBottom: 8 }}>
                Select entrants to remove from this match's pot calculation entirely — no win, no loss. Use this for users who withdrew.
              </Text>
              <View style={{ gap: 6 }}>
                {entrantUsers.map(u => {
                  const isExcluded = potExcludeUserIds.includes(u.id);
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => onSetPotExcludeUserIds(prev =>
                        prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1,
                        backgroundColor: isExcluded ? '#F59E0B12' : colors.surfaceElevated,
                        borderColor: isExcluded ? '#F59E0B50' : colors.border,
                      }}
                    >
                      <View style={{
                        width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
                        borderColor: isExcluded ? '#F59E0B' : colors.border,
                        backgroundColor: isExcluded ? '#F59E0B' : 'transparent',
                      }}>
                        {isExcluded && <Ionicons name="checkmark" size={13} color="#FFF" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{u.username}</Text>
                        {u.teamName ? (
                          <Text style={{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11 }}>{u.teamName}</Text>
                        ) : null}
                      </View>
                      {isExcluded && (
                        <Text style={{ color: '#F59E0B', fontFamily: 'Inter_700Bold', fontSize: 11 }}>EXCLUDED</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              {potExcludeUserIds.length > 0 && (
                <View style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#F59E0B10', borderWidth: 1, borderColor: '#F59E0B30' }}>
                  <Text style={{ color: '#F59E0B', fontFamily: 'Inter_700Bold', fontSize: 12, marginBottom: 2 }}>Exclusion Summary</Text>
                  <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                    {potExcludeUserIds.length} {potExcludeUserIds.length === 1 ? 'user' : 'users'} will be excluded — no pot contribution in either direction.
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* Re-process warning */}
        {(() => {
          const selectedMatch = potUnprocessedMatches.find(m => m.id === potSelectedMatchId);
          if (!selectedMatch?.potProcessed) return null;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, padding: 8, backgroundColor: '#F59E0B10', borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B30' }}>
              <Ionicons name="refresh-circle-outline" size={16} color="#F59E0B" />
              <Text style={{ color: '#F59E0B', fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 }}>
                This match was already processed. Submitting will re-process and replace previous entries.
              </Text>
            </View>
          );
        })()}

        {/* Process button */}
        <Pressable
          onPress={onProcess}
          disabled={potProcessing || (!potSelectedTournament && !potNewTournament.trim()) || !potSelectedMatchId}
          style={{
            height: 44, borderRadius: 12, backgroundColor: '#F59E0B',
            justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8,
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

      {/* Already processed count */}
      {processedCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 2 }}>
          <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
          <Text style={{ color: colors.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            {processedCount} {processedCount === 1 ? 'match' : 'matches'} already processed
          </Text>
        </View>
      )}

      {/* Reset entire tournament pot */}
      {(potSelectedTournament || potNewTournament.trim()) && processedCount > 0 && (
        <View style={{ marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: '#EF444430', backgroundColor: '#EF444408', padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name="warning-outline" size={15} color="#EF4444" />
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', color: '#EF4444' }}>
              RESET ENTIRE TOURNAMENT POT
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginBottom: 10 }}>
            Wipes ALL pot results for <Text style={{ fontFamily: 'Inter_700Bold', color: colors.text }}>{potSelectedTournament || potNewTournament.trim()}</Text> — every ledger entry deleted, all matches marked unprocessed, all penalty lists cleared. You can then re-process each match individually with the correct settings.
          </Text>

          {!confirmingReset ? (
            <Pressable
              onPress={() => setConfirmingReset(true)}
              disabled={potResetting}
              style={{
                height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#EF4444',
                justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
                backgroundColor: 'transparent',
                opacity: potResetting ? 0.5 : 1,
              }}
            >
              <Ionicons name="refresh" size={16} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Reset & Reopen Tournament Pot</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ color: '#EF4444', fontFamily: 'Inter_700Bold', fontSize: 13, textAlign: 'center' }}>
                Are you sure? This cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setConfirmingReset(false)}
                  style={{ flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setConfirmingReset(false); onResetTournament(); }}
                  disabled={potResetting}
                  style={{
                    flex: 1, height: 42, borderRadius: 10, backgroundColor: '#EF4444',
                    justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6,
                    opacity: potResetting ? 0.5 : 1,
                  }}
                >
                  {potResetting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Yes, Reset Everything</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
