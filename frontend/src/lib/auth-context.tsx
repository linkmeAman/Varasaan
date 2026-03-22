'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { apiClient, type LoginRequest, type UserSessionResponse } from './api-client';

export type AuthContextValue = {
  user: UserSessionResponse | null;
  isLoading: boolean;
  error: string | null;
  login: (input: LoginRequest) => Promise<UserSessionResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserSessionResponse | null>;
  setUser: Dispatch<SetStateAction<UserSessionResponse | null>>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

function isUnauthorized(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (error as { response?: { status?: number } }).response?.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrapSession = async () => {
      setIsLoading(true);
      try {
        const currentUser = await apiClient.currentUser();
        if (!mounted) {
          return;
        }
        setUser(currentUser);
        setError(null);
      } catch (authError) {
        if (!mounted) {
          return;
        }
        setUser(null);
        setError(isUnauthorized(authError) ? null : readErrorMessage(authError, 'Unable to restore your session.'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapSession();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshSession = async () => {
    setIsLoading(true);
    try {
      const currentUser = await apiClient.currentUser();
      setUser(currentUser);
      setError(null);
      return currentUser;
    } catch (authError) {
      setUser(null);
      setError(isUnauthorized(authError) ? null : readErrorMessage(authError, 'Unable to refresh your session.'));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (input: LoginRequest) => {
    setIsLoading(true);
    try {
      await apiClient.login({ body: input });
      const currentUser = await apiClient.currentUser();
      setUser(currentUser);
      setError(null);
      return currentUser;
    } catch (authError) {
      setUser(null);
      setError(readErrorMessage(authError, 'Unable to sign in with the provided credentials.'));
      throw authError;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.logout({});
    } catch {
      // best-effort logout
    } finally {
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        refreshSession,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

