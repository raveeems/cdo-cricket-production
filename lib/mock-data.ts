export interface Player {
  id: string;
  name: string;
  team: string;
  teamShort: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL';
  credits: number;
  points: number;
  selectedBy: number;
  recentForm: number[];
  isImpactPlayer?: boolean;
  isPlayingXI?: boolean;
  imageUrl?: string;
}

export interface Match {
  id: string;
  team1: string;
  team1Short: string;
  team1Color: string;
  team2: string;
  team2Short: string;
  team2Color: string;
  venue: string;
  startTime: string;
  status: 'upcoming' | 'live' | 'completed' | 'delayed';
  statusNote: string;
  scoreString?: string;
  lastSyncAt?: string;
  league: string;
  totalPrize: string;
  entryFee: number;
  spotsTotal: number;
  spotsFilled: number;
  participantCount?: number;
}

export interface ContestTeam {
  id: string;
  userId: string;
  matchId: string;
  name: string;
  username: string;
  userTeamName: string;
  playerIds: string[];
  captainId: string | null;
  viceCaptainId: string | null;
  totalPoints: number;
  createdAt: string;
}

export interface UserTeam {
  id: string;
  matchId: string;
  name: string;
  players: string[];
  captainId: string;
  viceCaptainId: string;
  totalPoints: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  matchesPlayed: number;
  teamsCreated: number;
}

const now = new Date();
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();

export const MOCK_MATCHES: Match[] = [
  {
    id: 'm1',
    team1: 'Mumbai Indians',
    team1Short: 'MI',
    team1Color: '#004BA0',
    team2: 'Chennai Super Kings',
    team2Short: 'CSK',
    team2Color: '#FFCB05',
    venue: 'Wankhede Stadium, Mumbai',
    startTime: hoursFromNow(6),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026',
    totalPrize: '10L',
    entryFee: 49,
    spotsTotal: 100,
    spotsFilled: 67,
  },
  {
    id: 'm2',
    team1: 'Royal Challengers Bengaluru',
    team1Short: 'RCB',
    team1Color: '#EC1C24',
    team2: 'Kolkata Knight Riders',
    team2Short: 'KKR',
    team2Color: '#3A225D',
    venue: 'M. Chinnaswamy Stadium',
    startTime: hoursFromNow(18),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026',
    totalPrize: '5L',
    entryFee: 29,
    spotsTotal: 200,
    spotsFilled: 145,
  },
  {
    id: 'm3',
    team1: 'Delhi Capitals',
    team1Short: 'DC',
    team1Color: '#17449B',
    team2: 'Rajasthan Royals',
    team2Short: 'RR',
    team2Color: '#EA1A85',
    venue: 'Arun Jaitley Stadium, Delhi',
    startTime: hoursFromNow(30),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026',
    totalPrize: '8L',
    entryFee: 39,
    spotsTotal: 150,
    spotsFilled: 89,
  },
  {
    id: 'm4',
    team1: 'Sunrisers Hyderabad',
    team1Short: 'SRH',
    team1Color: '#FF822A',
    team2: 'Punjab Kings',
    team2Short: 'PBKS',
    team2Color: '#ED1B24',
    venue: 'Rajiv Gandhi Stadium',
    startTime: hoursFromNow(42),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026',
    totalPrize: '6L',
    entryFee: 19,
    spotsTotal: 300,
    spotsFilled: 178,
  },
];

export const MOCK_PLAYERS: Record<string, Player[]> = {
  m1: [
    { id: 'p1', name: 'Rohit Sharma', team: 'Mumbai Indians', teamShort: 'MI', role: 'BAT', credits: 10, points: 456, selectedBy: 89, recentForm: [45, 12, 78, 34, 56] },
    { id: 'p2', name: 'Ishan Kishan', team: 'Mumbai Indians', teamShort: 'MI', role: 'WK', credits: 9, points: 389, selectedBy: 72, recentForm: [33, 67, 12, 45, 23] },
    { id: 'p3', name: 'Suryakumar Yadav', team: 'Mumbai Indians', teamShort: 'MI', role: 'BAT', credits: 9.5, points: 512, selectedBy: 85, recentForm: [89, 45, 23, 67, 34] },
    { id: 'p4', name: 'Tilak Varma', team: 'Mumbai Indians', teamShort: 'MI', role: 'BAT', credits: 8.5, points: 345, selectedBy: 65, recentForm: [34, 56, 78, 12, 45] },
    { id: 'p5', name: 'Hardik Pandya', team: 'Mumbai Indians', teamShort: 'MI', role: 'AR', credits: 9.5, points: 478, selectedBy: 78, recentForm: [23, 45, 67, 34, 12] },
    { id: 'p6', name: 'Tim David', team: 'Mumbai Indians', teamShort: 'MI', role: 'BAT', credits: 8, points: 290, selectedBy: 55, recentForm: [67, 12, 34, 89, 23], isImpactPlayer: true },
    { id: 'p7', name: 'Jasprit Bumrah', team: 'Mumbai Indians', teamShort: 'MI', role: 'BOWL', credits: 9.5, points: 423, selectedBy: 82, recentForm: [3, 2, 4, 1, 3] },
    { id: 'p8', name: 'Piyush Chawla', team: 'Mumbai Indians', teamShort: 'MI', role: 'BOWL', credits: 7, points: 210, selectedBy: 35, recentForm: [2, 1, 0, 3, 1] },
    { id: 'p9', name: 'Gerald Coetzee', team: 'Mumbai Indians', teamShort: 'MI', role: 'BOWL', credits: 8, points: 310, selectedBy: 48, recentForm: [2, 3, 1, 2, 4] },

    { id: 'p10', name: 'MS Dhoni', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'WK', credits: 8.5, points: 356, selectedBy: 91, recentForm: [34, 23, 56, 12, 45] },
    { id: 'p11', name: 'Ruturaj Gaikwad', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'BAT', credits: 9.5, points: 489, selectedBy: 88, recentForm: [78, 45, 23, 89, 56] },
    { id: 'p12', name: 'Devon Conway', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'BAT', credits: 9, points: 412, selectedBy: 70, recentForm: [56, 34, 67, 23, 45] },
    { id: 'p13', name: 'Shivam Dube', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'AR', credits: 8.5, points: 378, selectedBy: 68, recentForm: [45, 67, 12, 34, 78] },
    { id: 'p14', name: 'Ravindra Jadeja', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'AR', credits: 9, points: 445, selectedBy: 76, recentForm: [34, 56, 23, 45, 67] },
    { id: 'p15', name: 'Moeen Ali', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'AR', credits: 8, points: 334, selectedBy: 52, recentForm: [23, 45, 12, 67, 34], isImpactPlayer: true },
    { id: 'p16', name: 'Deepak Chahar', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'BOWL', credits: 8, points: 312, selectedBy: 58, recentForm: [3, 1, 2, 4, 2] },
    { id: 'p17', name: 'Tushar Deshpande', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'BOWL', credits: 7.5, points: 278, selectedBy: 42, recentForm: [1, 2, 3, 1, 2] },
    { id: 'p18', name: 'Matheesha Pathirana', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'BOWL', credits: 8, points: 345, selectedBy: 62, recentForm: [4, 2, 1, 3, 2] },
    { id: 'p19', name: 'Rachin Ravindra', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'BAT', credits: 7.5, points: 267, selectedBy: 38, recentForm: [34, 12, 56, 23, 45] },
    { id: 'p20', name: 'Daryl Mitchell', team: 'Chennai Super Kings', teamShort: 'CSK', role: 'AR', credits: 8, points: 312, selectedBy: 45, recentForm: [45, 23, 34, 56, 12] },
  ],
  m2: [
    { id: 'p21', name: 'Virat Kohli', team: 'RCB', teamShort: 'RCB', role: 'BAT', credits: 10.5, points: 534, selectedBy: 95, recentForm: [89, 56, 34, 78, 45] },
    { id: 'p22', name: 'Faf du Plessis', team: 'RCB', teamShort: 'RCB', role: 'BAT', credits: 9, points: 412, selectedBy: 75, recentForm: [45, 67, 23, 56, 34] },
    { id: 'p23', name: 'Glenn Maxwell', team: 'RCB', teamShort: 'RCB', role: 'AR', credits: 9, points: 398, selectedBy: 72, recentForm: [67, 12, 89, 23, 45] },
    { id: 'p24', name: 'Rajat Patidar', team: 'RCB', teamShort: 'RCB', role: 'BAT', credits: 8, points: 312, selectedBy: 58, recentForm: [34, 56, 12, 45, 23] },
    { id: 'p25', name: 'Dinesh Karthik', team: 'RCB', teamShort: 'RCB', role: 'WK', credits: 8, points: 289, selectedBy: 62, recentForm: [23, 45, 67, 12, 34] },
    { id: 'p26', name: 'Wanindu Hasaranga', team: 'RCB', teamShort: 'RCB', role: 'AR', credits: 8.5, points: 367, selectedBy: 65, recentForm: [2, 3, 1, 4, 2] },
    { id: 'p27', name: 'Mohammed Siraj', team: 'RCB', teamShort: 'RCB', role: 'BOWL', credits: 8.5, points: 378, selectedBy: 68, recentForm: [3, 2, 4, 1, 3] },
    { id: 'p28', name: 'Josh Hazlewood', team: 'RCB', teamShort: 'RCB', role: 'BOWL', credits: 8, points: 334, selectedBy: 55, recentForm: [2, 3, 1, 2, 4] },
    { id: 'p29', name: 'Karn Sharma', team: 'RCB', teamShort: 'RCB', role: 'BOWL', credits: 7, points: 198, selectedBy: 28, recentForm: [1, 2, 0, 1, 3] },

    { id: 'p30', name: 'Shreyas Iyer', team: 'KKR', teamShort: 'KKR', role: 'BAT', credits: 9.5, points: 467, selectedBy: 82, recentForm: [56, 78, 34, 45, 67] },
    { id: 'p31', name: 'Phil Salt', team: 'KKR', teamShort: 'KKR', role: 'WK', credits: 9, points: 423, selectedBy: 78, recentForm: [78, 34, 56, 23, 89] },
    { id: 'p32', name: 'Andre Russell', team: 'KKR', teamShort: 'KKR', role: 'AR', credits: 9.5, points: 489, selectedBy: 85, recentForm: [45, 67, 23, 78, 34] },
    { id: 'p33', name: 'Sunil Narine', team: 'KKR', teamShort: 'KKR', role: 'AR', credits: 9, points: 434, selectedBy: 80, recentForm: [34, 56, 45, 12, 67] },
    { id: 'p34', name: 'Rinku Singh', team: 'KKR', teamShort: 'KKR', role: 'BAT', credits: 8.5, points: 378, selectedBy: 72, recentForm: [23, 67, 45, 56, 12] },
    { id: 'p35', name: 'Venkatesh Iyer', team: 'KKR', teamShort: 'KKR', role: 'AR', credits: 8, points: 312, selectedBy: 55, recentForm: [34, 12, 56, 23, 45] },
    { id: 'p36', name: 'Mitchell Starc', team: 'KKR', teamShort: 'KKR', role: 'BOWL', credits: 9, points: 412, selectedBy: 75, recentForm: [4, 2, 3, 1, 4] },
    { id: 'p37', name: 'Varun Chakravarthy', team: 'KKR', teamShort: 'KKR', role: 'BOWL', credits: 8, points: 334, selectedBy: 60, recentForm: [2, 3, 1, 4, 2] },
    { id: 'p38', name: 'Harshit Rana', team: 'KKR', teamShort: 'KKR', role: 'BOWL', credits: 7.5, points: 267, selectedBy: 42, recentForm: [1, 2, 3, 2, 1] },
    { id: 'p39', name: 'Ramandeep Singh', team: 'KKR', teamShort: 'KKR', role: 'BAT', credits: 7, points: 210, selectedBy: 32, recentForm: [12, 34, 23, 45, 11], isImpactPlayer: true },
  ],
};

MOCK_PLAYERS['m3'] = MOCK_PLAYERS['m1'].map(p => ({ ...p, id: `m3_${p.id}` }));
MOCK_PLAYERS['m4'] = MOCK_PLAYERS['m2'].map(p => ({ ...p, id: `m4_${p.id}` }));

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: 'u1', username: 'CricketKing', totalPoints: 2456, matchesPlayed: 12, teamsCreated: 24 },
  { rank: 2, userId: 'u2', username: 'DhoniFan07', totalPoints: 2312, matchesPlayed: 12, teamsCreated: 20 },
  { rank: 3, userId: 'u3', username: 'ViratArmy', totalPoints: 2198, matchesPlayed: 11, teamsCreated: 22 },
  { rank: 4, userId: 'u4', username: 'IPLGuru', totalPoints: 2045, matchesPlayed: 10, teamsCreated: 18 },
  { rank: 5, userId: 'u5', username: 'SixerMachine', totalPoints: 1987, matchesPlayed: 12, teamsCreated: 21 },
  { rank: 6, userId: 'u6', username: 'BumrahFan', totalPoints: 1876, matchesPlayed: 11, teamsCreated: 17 },
  { rank: 7, userId: 'u7', username: 'WicketHunter', totalPoints: 1765, matchesPlayed: 10, teamsCreated: 15 },
  { rank: 8, userId: 'u8', username: 'BoundaryBoss', totalPoints: 1654, matchesPlayed: 9, teamsCreated: 14 },
  { rank: 9, userId: 'u9', username: 'SpinWizard', totalPoints: 1543, matchesPlayed: 10, teamsCreated: 16 },
  { rank: 10, userId: 'u10', username: 'PacerPower', totalPoints: 1432, matchesPlayed: 8, teamsCreated: 12 },
];

export const VALID_REFERENCE_CODES = ['1234', '5678', '9012', '3456'];

export const ADMIN_USER_IDS = ['admin1', 'admin2'];

export function getTimeUntilMatch(startTime: string, status?: string): string {
  if (status === 'delayed') return 'Delayed';
  const diff = new Date(startTime).getTime() - Date.now();
  if (diff <= 0) return 'Started';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function isMatchVisible(startTime: string): boolean {
  const diff = new Date(startTime).getTime() - Date.now();
  return diff > 0 && diff <= 48 * 60 * 60 * 1000;
}

export function canEditTeam(startTime: string, status?: string): boolean {
  if (status === 'live' || status === 'completed') return false;
  const diff = new Date(startTime).getTime() - Date.now();
  return diff > 1000;
}

export function getRoleColor(role: string, isDark: boolean): string {
  const colors: Record<string, string> = {
    WK: isDark ? '#1E3A5F' : '#2C5282',
    BAT: isDark ? '#1E3A5F' : '#2C5282',
    AR: isDark ? '#1E3A5F' : '#2C5282',
    BOWL: isDark ? '#1E3A5F' : '#2C5282',
  };
  return colors[role] || '#888';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    WK: 'Wicket-Keeper',
    BAT: 'Batsman',
    AR: 'All-Rounder',
    BOWL: 'Bowler',
  };
  return labels[role] || role;
}
