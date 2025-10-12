/**
 * Auth Hook for VibeCode WebGUI
 * Simple implementation to make components compile
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => false,
  logout: async () => {},
  signup: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading the user from local storage or a token
    const checkAuth = async () => {
      try {
        // This would be a real API call in production
        const storedUser = localStorage.getItem('vibeCodeUser');
        
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        logger.error('Authentication check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      // This would be a real API call in production
      // Simulate successful login
      const mockUser: User = {
        id: 'user_' + Math.random().toString(36).substr(2, 9),
        name: email.split('@')[0],
        email,
        role: 'user',
      };

      setUser(mockUser);
      localStorage.setItem('vibeCodeUser', JSON.stringify(mockUser));
      return true;
    } catch (error) {
      logger.error('Login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);

    try {
      // This would be a real API call in production
      localStorage.removeItem('vibeCodeUser');
      setUser(null);
    } catch (error) {
      logger.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      // This would be a real API call in production
      // Simulate successful signup
      const mockUser: User = {
        id: 'user_' + Math.random().toString(36).substr(2, 9),
        name,
        email,
        role: 'user',
      };

      setUser(mockUser);
      localStorage.setItem('vibeCodeUser', JSON.stringify(mockUser));
      return true;
    } catch (error) {
      logger.error('Signup failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        signup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);