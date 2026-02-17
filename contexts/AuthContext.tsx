import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VALID_REFERENCE_CODES, ADMIN_USER_IDS } from '@/lib/mock-data';

interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
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
  login: (email: string, password: string) => Promise<boolean>;
  signup: (username: string, email: string, phone: string, password: string) => Promise<boolean>;
  verifyReferenceCode: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = '@cdo_auth_user';
const CODES_STORAGE_KEY = '@cdo_ref_codes';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (u: User) => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const storedUsers = await AsyncStorage.getItem('@cdo_users');
    const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
    const found = users.find((u) => u.email === email);
    if (found) {
      await saveUser(found);
      return true;
    }
    return false;
  };

  const signup = async (username: string, email: string, phone: string, password: string): Promise<boolean> => {
    const uid = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const isAdmin = ADMIN_USER_IDS.includes(uid);
    const newUser: User = {
      id: uid,
      username,
      email,
      phone,
      isVerified: false,
      isAdmin,
      joinedAt: new Date().toISOString(),
    };

    const storedUsers = await AsyncStorage.getItem('@cdo_users');
    const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
    users.push(newUser);
    await AsyncStorage.setItem('@cdo_users', JSON.stringify(users));
    await saveUser(newUser);
    return true;
  };

  const verifyReferenceCode = async (code: string): Promise<boolean> => {
    const storedCodes = await AsyncStorage.getItem(CODES_STORAGE_KEY);
    const customCodes: string[] = storedCodes ? JSON.parse(storedCodes) : [];
    const allCodes = [...VALID_REFERENCE_CODES, ...customCodes];

    if (allCodes.includes(code) && user) {
      const updatedUser = { ...user, isVerified: true };
      await saveUser(updatedUser);

      const storedUsers = await AsyncStorage.getItem('@cdo_users');
      const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        users[idx] = updatedUser;
        await AsyncStorage.setItem('@cdo_users', JSON.stringify(users));
      }
      return true;
    }
    return false;
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    await saveUser(updatedUser);
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
