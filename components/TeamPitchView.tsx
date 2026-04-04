import React from 'react';
import { View, Text, StyleSheet, Dimensions, Modal, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlayerImage } from '@/utils/playerImages';

interface PitchPlayer {
  id: string;
  name: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL';
  points?: number;
  teamShort?: string;
  externalId?: string;
  isPlayingXI?: boolean;
  isImpactPlayer?: boolean;
  isImpactActivated?: boolean;
}

interface TeamPitchViewProps {
  players: PitchPlayer[];
  captainId: string | null;
  viceCaptainId: string | null;
  teamName?: string;
  totalPoints?: number;
  visible?: boolean;
  onClose?: () => void;
  isModal?: boolean;
  matchCompleted?: boolean;
  team1Short?: string;
  impactPlayer?: PitchPlayer | null;
  backupPlayer?: PitchPlayer | null;
  captainType?: string | null;
  vcType?: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TEAM_COLORS: Record<string, string> = {
  IND: '#0077FF',
  PAK: '#009900',
  AUS: '#FFD700',
  ENG: '#CC0000',
  SA: '#006400',
  NZ: '#000000',
  WI: '#800000',
  SL: '#000080',
  BAN: '#006400',
  AFG: '#0066CC',
  NED: '#FF8000',
  CSK: '#FFFF3C',
  RCB: '#EC1C24',
  MI: '#004B8D',
  KKR: '#3A225D',
  SRH: '#F7A721',
  RR: '#EA1A85',
  DC: '#00008B',
  PBKS: '#DD1F2D',
  LSG: '#3FD5F3',
  GT: '#1B2133',
};

function getTeamColor(teamCode?: string): string {
  if (!teamCode) return '#FFFFFF';
  return TEAM_COLORS[teamCode.toUpperCase()] || '#FFFFFF';
}

function shortenName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p[0]?.toUpperCase() + '.').join(' ');
  return `${initials} ${last}`;
}

function PitchPlayerNode({
  player,
  isCaptain,
  isVC,
  xiAnnounced,
  matchCompleted,
  team1Short,
}: {
  player: PitchPlayer;
  isCaptain: boolean;
  isVC: boolean;
  xiAnnounced: boolean;
  matchCompleted: boolean;
  team1Short?: string;
}) {
  const { colors } = useTheme();
  const isTeam1 = team1Short
    ? player.teamShort?.toUpperCase() === team1Short.toUpperCase()
    : true;
  const pts = player.points ?? 0;
  let displayPts = pts;
  if (isCaptain) displayPts = pts * 2;
  else if (isVC) displayPts = Math.round(pts * 1.5);

  const jerseyColor = getTeamColor(player.teamShort);
  const playerImage = getPlayerImage(player.externalId ?? player.id);

  let dotColor: string;
  if (!xiAnnounced) {
    dotColor = '#6B7280';
  } else if (player.isImpactPlayer) {
    dotColor = '#9333EA';
  } else if (player.isPlayingXI) {
    dotColor = '#22C55E';
  } else {
    dotColor = '#EF4444';
  }

  return (
    <View style={pitchStyles.playerNode}>
      <View style={pitchStyles.jerseyContainer}>
        <View style={pitchStyles.jersey}>
          {playerImage ? (
            <Image source={playerImage} style={pitchStyles.playerPhoto} />
          ) : (
            <Ionicons name="shirt" size={30} color={jerseyColor} />
          )}
        </View>
        {!matchCompleted && (
          <View style={[pitchStyles.statusDot, { backgroundColor: dotColor }]} />
        )}
        {(isCaptain || isVC) && (
          <View style={[pitchStyles.cvBadge, isCaptain ? pitchStyles.captainBadge : pitchStyles.vcBadge]}>
            <Text style={[pitchStyles.cvBadgeText, isCaptain ? { color: '#000' } : { color: '#FFF' }]}>
              {isCaptain ? 'C' : 'VC'}
            </Text>
          </View>
        )}
      </View>
      <View style={[
        pitchStyles.namePill,
        isTeam1
          ? { backgroundColor: 'rgba(0,0,0,0.75)' }
          : { backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)' },
      ]}>
        <Text style={[
          pitchStyles.nameText,
          isTeam1 ? { color: '#FFF' } : { color: '#111' },
        ]} numberOfLines={1}>
          {shortenName(player.name)}
        </Text>
      </View>
      <Text style={[
        pitchStyles.pointsText,
        matchCompleted && displayPts > 0 && { color: '#FFD700', fontWeight: '700' as const },
      ]}>
        {displayPts} pts
      </Text>
    </View>
  );
}

function BenchStrip({ primary, backup, captainType, vcType }: {
  primary: PitchPlayer | null | undefined;
  backup: PitchPlayer | null | undefined;
  captainType?: string | null;
  vcType?: string | null;
}) {
  const { colors } = useTheme();
  if (!primary && !backup) return null;

  const impactIsCaptain = captainType === 'impact_slot';
  const impactIsVC = vcType === 'impact_slot';
  const primaryActivated = primary?.isImpactActivated ?? false;
  const backupActivated = backup?.isImpactActivated ?? false;

  function BenchCard({ player, label, isCaptain, isVC }: { player: PitchPlayer | null | undefined; label: string; isCaptain: boolean; isVC: boolean }) {
    const isActivated = player?.isImpactActivated ?? false;
    const rawPts = player?.points ?? 0;
    // When active, +4 impact bonus is added by the server on top of raw scorecard points.
    // Show the true contribution (pts + 4) so the displayed number matches the team total.
    const ptsWithBonus = isActivated ? rawPts + 4 : rawPts;
    let displayPts = ptsWithBonus;
    if (isCaptain) displayPts = ptsWithBonus * 2;
    else if (isVC) displayPts = Math.round(ptsWithBonus * 1.5);
    const jerseyColor = getTeamColor(player?.teamShort);
    const playerImage = player ? getPlayerImage(player.externalId ?? player.id) : null;
    return (
      <View style={[benchStyles.card, isActivated && benchStyles.activatedCard]}>
        <Text style={[benchStyles.cardLabel, isActivated && { color: '#C084FC' }]}>{label}</Text>
        <View style={benchStyles.avatarWrap}>
          <View style={[benchStyles.avatar, isActivated && benchStyles.activatedAvatar]}>
            {playerImage ? (
              <Image source={playerImage} style={benchStyles.avatarImg} />
            ) : (
              <Ionicons name="shirt" size={22} color={jerseyColor} />
            )}
          </View>
          {(isCaptain || isVC) && (
            <View style={[benchStyles.cvBadge, isCaptain ? benchStyles.captainBadge : benchStyles.vcBadge]}>
              <Text style={[benchStyles.cvText, { color: isCaptain ? '#000' : '#FFF' }]}>{isCaptain ? 'C' : 'VC'}</Text>
            </View>
          )}
        </View>
        <Text style={[benchStyles.playerName, { color: player ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {player ? shortenName(player.name) : '—'}
        </Text>
        <Text style={benchStyles.teamText}>{player?.teamShort ?? ''} {player?.role ?? ''}</Text>
        {isActivated ? (
          <View style={benchStyles.activeBadge}>
            <Text style={benchStyles.activeBadgeText}>⚡ ACTIVE</Text>
          </View>
        ) : null}
        <Text style={[benchStyles.ptsText, isActivated ? { color: '#C084FC', fontFamily: 'Inter_700Bold' as const } : { color: colors.textTertiary }]}>
          {displayPts} pts
        </Text>
        {isActivated && (
          <Text style={benchStyles.bonusLabel}>+4 impact bonus</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[benchStyles.strip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[benchStyles.stripTitle, { color: colors.textSecondary }]}>⚡ IMPACT BENCH</Text>
      <View style={benchStyles.cardsRow}>
        <BenchCard
          player={primary}
          label="PRIMARY"
          isCaptain={impactIsCaptain && primaryActivated}
          isVC={impactIsVC && primaryActivated}
        />
        {backup && (
          <BenchCard
            player={backup}
            label="BACKUP"
            isCaptain={impactIsCaptain && backupActivated}
            isVC={impactIsVC && backupActivated}
          />
        )}
      </View>
    </View>
  );
}

function PitchContent({ players, captainId, viceCaptainId, teamName, totalPoints, matchCompleted = false, team1Short, impactPlayer, backupPlayer, captainType, vcType }: Omit<TeamPitchViewProps, 'visible' | 'onClose' | 'isModal'>) {
  const { colors } = useTheme();

  // Exclude impact sub players from the main XI grid — they appear only in the bench strip below.
  // Without this, users with impact subs selected see 13 players on the pitch instead of 11.
  const impactIds = new Set([impactPlayer?.id, backupPlayer?.id].filter(Boolean) as string[]);
  const xiPlayers = players.filter(p => !impactIds.has(p.id));

  const xiAnnounced = xiPlayers.some(p => p.isPlayingXI);

  const wk = xiPlayers.filter(p => p.role === 'WK');
  const bat = xiPlayers.filter(p => p.role === 'BAT');
  const ar = xiPlayers.filter(p => p.role === 'AR');
  const bowl = xiPlayers.filter(p => p.role === 'BOWL');

  const rows: { label: string; players: PitchPlayer[] }[] = [
    { label: 'WICKET-KEEPER', players: wk },
    { label: 'BATTERS', players: bat },
    { label: 'ALL-ROUNDERS', players: ar },
    { label: 'BOWLERS', players: bowl },
  ];

  return (
    <View>
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={pitchStyles.pitch}
      >
        <View style={pitchStyles.pitchOverlay}>
          <View style={pitchStyles.pitchLine1} />
          <View style={pitchStyles.pitchLine2} />
          <View style={pitchStyles.pitchCircle} />
          <View style={pitchStyles.pitchStrip} />
        </View>

        {teamName && (
          <View style={pitchStyles.teamHeader}>
            <Text style={pitchStyles.teamNameText}>{teamName}</Text>
            {totalPoints !== undefined && (
              <Text style={pitchStyles.teamPointsText}>{totalPoints} pts</Text>
            )}
          </View>
        )}

        {rows.map((row) => (
          <View key={row.label} style={pitchStyles.roleSection}>
            <Text style={pitchStyles.roleLabel}>{row.label}</Text>
            <View style={pitchStyles.playersRow}>
              {row.players.map(p => (
                <PitchPlayerNode
                  key={p.id}
                  player={p}
                  isCaptain={captainId === p.id}
                  isVC={viceCaptainId === p.id}
                  xiAnnounced={xiAnnounced}
                  matchCompleted={matchCompleted}
                  team1Short={team1Short}
                />
              ))}
            </View>
          </View>
        ))}
      </LinearGradient>

      {(impactPlayer || backupPlayer) && (
        <BenchStrip
          primary={impactPlayer}
          backup={backupPlayer}
          captainType={captainType}
          vcType={vcType}
        />
      )}
    </View>
  );
}

export default function TeamPitchView({
  players,
  captainId,
  viceCaptainId,
  teamName,
  totalPoints,
  visible = true,
  onClose,
  isModal = false,
  matchCompleted = false,
  team1Short,
  impactPlayer,
  backupPlayer,
  captainType,
  vcType,
}: TeamPitchViewProps) {
  if (!isModal) {
    return (
      <PitchContent
        players={players}
        captainId={captainId}
        viceCaptainId={viceCaptainId}
        teamName={teamName}
        totalPoints={totalPoints}
        matchCompleted={matchCompleted}
        team1Short={team1Short}
        impactPlayer={impactPlayer}
        backupPlayer={backupPlayer}
        captainType={captainType}
        vcType={vcType}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={pitchStyles.modalOverlay}>
        <View style={pitchStyles.modalContent}>
          <Pressable onPress={onClose} style={pitchStyles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
          <PitchContent
            players={players}
            captainId={captainId}
            viceCaptainId={viceCaptainId}
            teamName={teamName}
            totalPoints={totalPoints}
            matchCompleted={matchCompleted}
            team1Short={team1Short}
            impactPlayer={impactPlayer}
            backupPlayer={backupPlayer}
            captainType={captainType}
            vcType={vcType}
          />
        </View>
      </View>
    </Modal>
  );
}

export { PitchPlayer };

const pitchStyles = StyleSheet.create({
  pitch: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  pitchOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pitchLine1: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pitchLine2: {
    position: 'absolute',
    top: '65%',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pitchCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    position: 'absolute',
    top: '42%',
  },
  pitchStrip: {
    width: 6,
    height: 50,
    backgroundColor: 'rgba(210,180,120,0.35)',
    borderRadius: 3,
    position: 'absolute',
    top: '46%',
  },
  teamHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  teamNameText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  teamPointsText: {
    color: '#FFD700',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    marginTop: 2,
  },
  roleSection: {
    alignItems: 'center',
    marginVertical: 6,
  },
  roleLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  playersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 4,
  },
  playerNode: {
    alignItems: 'center',
    width: 68,
    marginBottom: 4,
  },
  jerseyContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  jersey: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playerPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    resizeMode: 'cover',
  },
  statusDot: {
    position: 'absolute',
    top: -2,
    left: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  cvBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  captainBadge: {
    backgroundColor: '#FFF',
  },
  vcBadge: {
    backgroundColor: '#1E293B',
  },
  cvBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  namePill: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 70,
  },
  nameText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  pointsText: {
    color: '#FFD700',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    marginTop: 1,
  },
  impactSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(147,51,234,0.35)',
    marginTop: 4,
    paddingTop: 4,
  },
  impactLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactLabel: {
    color: 'rgba(167,85,255,0.85)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalContent: {
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

const benchStyles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stripTitle: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 3,
  },
  activatedCard: {
    borderColor: '#9333EA',
    backgroundColor: 'rgba(147,51,234,0.08)',
  },
  cardLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  avatarWrap: {
    position: 'relative',
    marginVertical: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  activatedAvatar: {
    borderWidth: 2,
    borderColor: '#9333EA',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  cvBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  captainBadge: {
    backgroundColor: '#FFF',
  },
  vcBadge: {
    backgroundColor: '#1E293B',
  },
  cvText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
  },
  playerName: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  teamText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  activeBadge: {
    backgroundColor: 'rgba(147,51,234,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.3)',
  },
  activeBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#C084FC',
    letterSpacing: 0.5,
  },
  ptsText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  bonusLabel: {
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    color: '#9333EA',
    opacity: 0.8,
    textAlign: 'center',
  },
});
