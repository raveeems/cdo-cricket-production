import { ImageSourcePropType } from 'react-native';

const LOGOS: Record<string, ImageSourcePropType> = {
  CSK: require('../assets/ipl/logos/csk.png'),
  RCB: require('../assets/ipl/logos/rcb.png'),
  MI: require('../assets/ipl/logos/mi.png'),
  KKR: require('../assets/ipl/logos/kkr.png'),
  SRH: require('../assets/ipl/logos/srh.png'),
  GT: require('../assets/ipl/logos/gt.png'),
  PBKS: require('../assets/ipl/logos/pbks.png'),
  RR: require('../assets/ipl/logos/rr.png'),
  DC: require('../assets/ipl/logos/dc.png'),
  LSG: require('../assets/ipl/logos/lsg.png'),
};

export function getTeamLogo(teamShortCode: string): ImageSourcePropType | null {
  if (!teamShortCode) return null;
  return LOGOS[teamShortCode.toUpperCase()] ?? null;
}
