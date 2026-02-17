import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const fetchFn = Platform.OS === 'web' ? globalThis.fetch.bind(globalThis) : expoFetch;
import { getAuthToken, setAuthToken, clearAuthToken } from '@/lib/auth-token';

interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  teamName: string;
  isVerified: boolean;
  isAdmin: boolean;
  joinedAt: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  login: (phone: string, password: string) => Promise<boolean>;
  signup: (username: string, email: string, phone: string, password: string) => Promise<boolean>;
  verifyReferenceCode: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updateTeamName: (teamName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await getAuthToken();
      const baseUrl = getApiUrl();
      const url = new URL('/api/auth/me', baseUrl);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetchFn(url.toString(), {
        credentials: 'include',
        headers,
      });
      if (res.status === 401) {
        await clearAuthToken();
        setUser(null);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {
      console.error('Failed to load user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string, password: string): Promise<boolean> => {
    try {
      const res = await apiRequest('POST', '/api/auth/login', { phone, password });
      const data = await res.json();
      if (data.token) {
        await setAuthToken(data.token);
      }
      setUser(data.user);
      return true;
    } catch (e: any) {
      console.error('Login failed:', e);
      return false;
    }
  };

  const signup = async (username: string, email: string, phone: string, password: string): Promise<boolean> => {
    try {
      const res = await apiRequest('POST', '/api/auth/signup', { username, email, phone, password });
      const data = await res.json();
      if (data.token) {
        await setAuthToken(data.token);
      }
      setUser(data.user);
      return true;
    } catch (e: any) {
      console.error('Signup failed:', e);
      return false;
    }
  };

  const verifyReferenceCode = async (code: string): Promise<boolean> => {
    try {
      await apiRequest('POST', '/api/auth/verify-code', { code });
      if (user) {
        setUser({ ...user, isVerified: true });
      }
      return true;
    } catch (e: any) {
      console.error('Verify code failed:', e);
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
    } catch (e) {
      console.error('Logout failed:', e);
    }
    await clearAuthToken();
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    setUser({ ...user, ...updates });
  };

  const updateTeamName = async (teamName: string): Promise<boolean> => {
    try {
      const res = await apiRequest('PUT', '/api/auth/team-name', { teamName });
      const data = await res.json();
      if (user) {
        setUser({ ...user, teamName: data.teamName });
      }
      return true;
    } catch (e: any) {
      console.error('Update team name failed:', e);
      return false;
    }
  };

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    isVerified: user?.isVerified ?? false,
    isAdmin: user?.isAdmin ?? false,
    login,
    signup,
    verifyReferenceCode,
    logout,
    updateUser,
    updateTeamName,
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
