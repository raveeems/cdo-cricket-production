import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserTeam } from '@/lib/mock-data';

interface TeamContextValue {
  teams: UserTeam[];
  isLoading: boolean;
  getTeamsForMatch: (matchId: string) => UserTeam[];
  saveTeam: (team: UserTeam) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue | null>(null);

const TEAMS_KEY = '@cdo_user_teams';

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const stored = await AsyncStorage.getItem(TEAMS_KEY);
      if (stored) {
        setTeams(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load teams:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTeam = async (team: UserTeam) => {
    const updated = [...teams.filter((t) => t.id !== team.id), team];
    await AsyncStorage.setItem(TEAMS_KEY, JSON.stringify(updated));
    setTeams(updated);
  };

  const deleteTeam = async (teamId: string) => {
    const updated = teams.filter((t) => t.id !== teamId);
    await AsyncStorage.setItem(TEAMS_KEY, JSON.stringify(updated));
    setTeams(updated);
  };

  const getTeamsForMatch = (matchId: string) => {
    return teams.filter((t) => t.matchId === matchId);
  };

  const refreshTeams = async () => {
    await loadTeams();
  };

  const value = useMemo(() => ({
    teams,
    isLoading,
    getTeamsForMatch,
    saveTeam,
    deleteTeam,
    refreshTeams,
  }), [teams, isLoading]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeams() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeams must be used within TeamProvider');
  }
  return context;
}
