import { Match } from '@/lib/mock-data';

const hoursFromNow = (h: number): string =>
  new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

export const DEV_MOCK_MATCHES: Match[] = [
  {
    id: 'mock-csk-rcb',
    team1: 'Chennai Super Kings',
    team1Short: 'CSK',
    team1Color: '#FFCB05',
    team2: 'Royal Challengers Bengaluru',
    team2Short: 'RCB',
    team2Color: '#EC1C24',
    venue: 'M.A. Chidambaram Stadium, Chennai',
    startTime: hoursFromNow(8),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026 · DEV',
    totalPrize: '0',
    entryFee: 0,
    spotsTotal: 0,
    spotsFilled: 0,
    impactFeaturesEnabled: true,
  },
  {
    id: 'mock-mi-kkr',
    team1: 'Mumbai Indians',
    team1Short: 'MI',
    team1Color: '#004BA0',
    team2: 'Kolkata Knight Riders',
    team2Short: 'KKR',
    team2Color: '#3A225D',
    venue: 'Wankhede Stadium, Mumbai',
    startTime: hoursFromNow(14),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026 · DEV',
    totalPrize: '0',
    entryFee: 0,
    spotsTotal: 0,
    spotsFilled: 0,
    impactFeaturesEnabled: true,
  },
  {
    id: 'mock-pbks-gt',
    team1: 'Punjab Kings',
    team1Short: 'PBKS',
    team1Color: '#ED1B24',
    team2: 'Gujarat Titans',
    team2Short: 'GT',
    team2Color: '#1B2A5E',
    venue: 'Maharaja Yadavindra Singh Stadium, Mullanpur',
    startTime: hoursFromNow(20),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026 · DEV',
    totalPrize: '0',
    entryFee: 0,
    spotsTotal: 0,
    spotsFilled: 0,
    impactFeaturesEnabled: true,
  },
  {
    id: 'mock-lsg-srh',
    team1: 'Lucknow Super Giants',
    team1Short: 'LSG',
    team1Color: '#00B4D8',
    team2: 'Sunrisers Hyderabad',
    team2Short: 'SRH',
    team2Color: '#FF822A',
    venue: 'BRSABV Ekana Cricket Stadium, Lucknow',
    startTime: hoursFromNow(26),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026 · DEV',
    totalPrize: '0',
    entryFee: 0,
    spotsTotal: 0,
    spotsFilled: 0,
    impactFeaturesEnabled: true,
  },
  {
    id: 'mock-dc-rr',
    team1: 'Delhi Capitals',
    team1Short: 'DC',
    team1Color: '#17449B',
    team2: 'Rajasthan Royals',
    team2Short: 'RR',
    team2Color: '#EA1A85',
    venue: 'Arun Jaitley Stadium, Delhi',
    startTime: hoursFromNow(32),
    status: 'upcoming',
    statusNote: '',
    league: 'IPL 2026 · DEV',
    totalPrize: '0',
    entryFee: 0,
    spotsTotal: 0,
    spotsFilled: 0,
    impactFeaturesEnabled: true,
  },
];

export function getMockMatchById(id: string): Match | undefined {
  return DEV_MOCK_MATCHES.find((m) => m.id === id);
}

export function injectDevMockMatches(realMatches: Match[]): Match[] {
  if (!__DEV__) return realMatches;

  const realPairs = new Set(
    realMatches.map(m => `${m.team1Short}-${m.team2Short}`)
  );

  const toInject = DEV_MOCK_MATCHES.filter(mock => {
    const forward = `${mock.team1Short}-${mock.team2Short}`;
    const reverse = `${mock.team2Short}-${mock.team1Short}`;
    return !realPairs.has(forward) && !realPairs.has(reverse);
  });

  return [...realMatches, ...toInject];
}
