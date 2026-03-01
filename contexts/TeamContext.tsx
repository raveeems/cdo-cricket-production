import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { getAuthToken } from '@/lib/auth-token';

interface Team {
  id: string;
  matchId: string;
  name: string;
  playerIds: string[];
  captainId: string;
  viceCaptainId: string;
  totalPoints: number;
  createdAt: string;
}

interface SaveTeamInput {
  matchId: string;
  name: string;
  playerIds: string[];
  captainId: string;
  viceCaptainId: string;
}

interface UpdateTeamInput {
  teamId: string;
  playerIds: string[];
  captainId: string;
  viceCaptainId: string;
}

interface TeamContextValue {
  teams: Team[];
  isLoading: boolean;
  getTeamsForMatch: (matchId: string) => Team[];
  getTeamById: (teamId: string) => Team | undefined;
  saveTeam: (input: SaveTeamInput) => Promise<void>;
  updateTeam: (input: UpdateTeamInput) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const doLoadTeams = async (setter: (t: Team[]) => void, setDone: (v: boolean) => void) => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL('/api/my-teams', baseUrl);
      const headers: Record<string, string> = {};
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await globalThis.fetch(url.toString(), { 
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setter(data.teams || []);
      }
    } catch (e) {
      // silently fail
    } finally {
      setDone(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      doLoadTeams(setTeams, setIsLoading);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const saveTeam = async (input: SaveTeamInput) => {
    try {
      const res = await apiRequest('POST', '/api/teams', input);
      const data = await res.json();
      setTeams((prev) => [...prev, data.team]);
    } catch (e) {
      console.error('Failed to save team:', e);
      throw e;
    }
  };

  const getTeamById = (teamId: string) => {
    return teams.find((t) => t.id === teamId);
  };

  const updateTeam = async (input: UpdateTeamInput) => {
    try {
      const res = await apiRequest('PUT', `/api/teams/${input.teamId}`, {
        playerIds: input.playerIds,
        captainId: input.captainId,
        viceCaptainId: input.viceCaptainId,
      });
      const data = await res.json();
      setTeams((prev) => prev.map((t) => t.id === input.teamId ? data.team : t));
    } catch (e) {
      console.error('Failed to update team:', e);
      throw e;
    }
  };

  const deleteTeam = async (teamId: string) => {
    try {
      await apiRequest('DELETE', `/api/teams/${teamId}`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (e) {
      console.error('Failed to delete team:', e);
      throw e;
    }
  };

  const getTeamsForMatch = (matchId: string) => {
    return teams.filter((t) => t.matchId === matchId);
  };

  const refreshTeams = async () => {
    await doLoadTeams(setTeams, setIsLoading);
  };

  const value = useMemo(() => ({
    teams,
    isLoading,
    getTeamsForMatch,
    getTeamById,
    saveTeam,
    updateTeam,
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
