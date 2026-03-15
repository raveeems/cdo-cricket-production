import { teamBanter } from '../assets/ipl/banter/teamBanter';

export function getMatchBanter(team1Short: string, team2Short: string): string | null {
  try {
    const lines1: string[] = teamBanter[team1Short?.toUpperCase()] || [];
    const lines2: string[] = teamBanter[team2Short?.toUpperCase()] || [];
    const combined = [...lines1, ...lines2];
    if (combined.length === 0) return null;
    return combined[Math.floor(Math.random() * combined.length)];
  } catch {
    return null;
  }
}
