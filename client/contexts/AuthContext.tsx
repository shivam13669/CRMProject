import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AdminUser, LoginRequest, LoginResponse, ApiResponse } from '@shared/api';

interface AuthContextType {
  admin: AdminUser | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('healthcare_crm_token');
    const savedAdmin = localStorage.getItem('healthcare_crm_admin');
    
    if (savedToken && savedAdmin) {
      setToken(savedToken);
      setAdmin(JSON.parse(savedAdmin));
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        console.error('Login failed with status:', response.status);
        return false;
      }

      // Clone the response to avoid "body stream already read" error
      const responseClone = response.clone();

      let result: ApiResponse<LoginResponse>;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        // Try to get the raw text to see what we received
        const text = await responseClone.text();
        console.error('Response text:', text);
        return false;
      }

      if (result.success && result.data) {
        const { token: newToken, admin: adminData } = result.data;
        setToken(newToken);
        setAdmin(adminData);

        // Save to localStorage
        localStorage.setItem('healthcare_crm_token', newToken);
        localStorage.setItem('healthcare_crm_admin', JSON.stringify(adminData));

        return true;
      }

      console.error('Login failed:', result.message || 'Unknown error');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem('healthcare_crm_token');
    localStorage.removeItem('healthcare_crm_admin');
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
