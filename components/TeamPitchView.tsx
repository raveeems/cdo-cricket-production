import React from 'react';
import { View, Text, StyleSheet, Dimensions, Modal, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface PitchPlayer {
  id: string;
  name: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL';
  points?: number;
  teamShort?: string;
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

function PitchPlayerNode({ player, isCaptain, isVC }: { player: PitchPlayer; isCaptain: boolean; isVC: boolean }) {
  const { colors } = useTheme();
  const pts = player.points ?? 0;
  let displayPts = pts;
  if (isCaptain) displayPts = pts * 2;
  else if (isVC) displayPts = Math.round(pts * 1.5);

  const jerseyColor = getTeamColor(player.teamShort);

  return (
    <View style={pitchStyles.playerNode}>
      <View style={pitchStyles.jerseyContainer}>
        <View style={pitchStyles.jersey}>
          <Ionicons name="shirt" size={30} color={jerseyColor} />
        </View>
        {(isCaptain || isVC) && (
          <View style={[pitchStyles.cvBadge, isCaptain ? pitchStyles.captainBadge : pitchStyles.vcBadge]}>
            <Text style={[pitchStyles.cvBadgeText, isCaptain ? { color: '#000' } : { color: '#FFF' }]}>
              {isCaptain ? 'C' : 'VC'}
            </Text>
          </View>
        )}
      </View>
      <View style={pitchStyles.namePill}>
        <Text style={pitchStyles.nameText} numberOfLines={1}>
          {shortenName(player.name)}
        </Text>
      </View>
      <Text style={pitchStyles.pointsText}>
        {displayPts} pts
      </Text>
    </View>
  );
}

function PitchContent({ players, captainId, viceCaptainId, teamName, totalPoints }: Omit<TeamPitchViewProps, 'visible' | 'onClose' | 'isModal'>) {
  const { colors } = useTheme();

  const wk = players.filter(p => p.role === 'WK');
  const bat = players.filter(p => p.role === 'BAT');
  const ar = players.filter(p => p.role === 'AR');
  const bowl = players.filter(p => p.role === 'BOWL');

  const rows: { label: string; players: PitchPlayer[] }[] = [
    { label: 'WICKET-KEEPER', players: wk },
    { label: 'BATTERS', players: bat },
    { label: 'ALL-ROUNDERS', players: ar },
    { label: 'BOWLERS', players: bowl },
  ];

  return (
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

      {rows.map((row, idx) => (
        <View key={row.label} style={pitchStyles.roleSection}>
          <Text style={pitchStyles.roleLabel}>{row.label}</Text>
          <View style={pitchStyles.playersRow}>
            {row.players.map(p => (
              <PitchPlayerNode
                key={p.id}
                player={p}
                isCaptain={captainId === p.id}
                isVC={viceCaptainId === p.id}
              />
            ))}
          </View>
        </View>
      ))}
    </LinearGradient>
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
}: TeamPitchViewProps) {
  if (!isModal) {
    return (
      <PitchContent
        players={players}
        captainId={captainId}
        viceCaptainId={viceCaptainId}
        teamName={teamName}
        totalPoints={totalPoints}
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
