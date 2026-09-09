'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';

interface User {
  id: number;
  email: string;
  isVerified?: boolean;
  role?: string;
  name?: string;
  username?: string;
  [key: string]: unknown;
}

interface Profile {
  id: number;
  name: string;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, redirectUrl?: string) => void;
  logout: () => void;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const GUEST_USER: User = {
  id: 0,
  email: 'guest@localhost',
  name: 'Guest',
  username: 'guest',
  role: 'guest',
  isVerified: true,
};

const GUEST_PROFILE: Profile = { id: 0, name: 'Guest' };
const AuthContext = createContext<AuthContextType | null>(null);

/** Local development mode: the app is intentionally anonymous. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const refreshSession = useCallback(async () => {}, []);
  const refreshProfile = useCallback(async () => {}, []);
  const login = useCallback((_token: string, redirectUrl = '/dashboard') => {
    if (typeof window !== 'undefined') window.location.assign(redirectUrl);
  }, []);
  const logout = useCallback(() => {
    if (typeof window !== 'undefined') window.location.assign('/');
  }, []);

  return (
    <AuthContext.Provider value={{
      user: GUEST_USER,
      profile: GUEST_PROFILE,
      loading: false,
      // The stripped project is intentionally anonymous. The guest identity
      // keeps legacy components stable while all persistence stays local.
      isAuthenticated: false,
      login,
      logout,
      refreshSession,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
