import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User, Role } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  token: string | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (data: RegisterFormData) => Promise<any>;
  verifyOTP: (email: string, otp: string) => Promise<any>;
  resendVerification: (email: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
  resetPassword: (email: string, otp: string, password: string) => Promise<any>;
  logout: () => Promise<any>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<any>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
  hasPermission: (permission: string) => boolean;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  role_id: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load permissions on mount if token exists
  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const setAuthData = (userData: User, roleData: Role | null, authToken: string) => {
    setUser(userData);
    setRole(roleData);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const clearAuthData = () => {
    setUser(null);
    setRole(null);
    setToken(null);
    setPermissions([]);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.me();
      if (response.data.success) {
        setUser(response.data.data.user);
        setRole(response.data.data.role);
        await fetchPermissions();
      }
    } catch (error) {
      clearAuthData();
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await authApi.permissions();
      if (response.data.success) {
        setPermissions(response.data.data || []);
      } else {
        setPermissions([]);
      }
    } catch (error) {
      setPermissions([]);
    }
  };

  // ----- Authentication methods -----
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      if (response.data.success) {
        const { user, role, token } = response.data.data;
        setAuthData(user, role, token);
        await fetchPermissions();
        return response.data;
      }
      throw new Error(response.data.message || 'Login failed');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      if (response.data.success) {
        return response.data;
      }
      throw new Error(response.data.message || 'Registration failed');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.verifyOTP({ email, otp });
      if (response.data.success) {
        const { user, role, token } = response.data.data;
        setAuthData(user, role, token);
        await fetchPermissions();
        return response.data;
      }
      throw new Error(response.data.message || 'OTP verification failed');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'OTP verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async (email: string) => {
    try {
      const response = await authApi.resendVerification({ email });
      if (response.data.success) {
        return response.data;
      }
      throw new Error(response.data.message || 'Failed to resend OTP');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Failed to resend OTP');
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const response = await authApi.forgotPassword({ email });
      if (response.data.success) {
        return response.data;
      }
      throw new Error(response.data.message || 'Failed to send reset link');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Failed to send reset link');
    }
  };

  const resetPassword = async (email: string, otp: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.resetPassword({
        email,
        otp,
        password,
        password_confirmation: password,
      });
      if (response.data.success) {
        return response.data;
      }
      throw new Error(response.data.message || 'Password reset failed');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const response = await authApi.logout();
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Logout failed');
    } finally {
      clearAuthData();
    }
  };

  const updateProfile = async (data: { name?: string; phone?: string }) => {
    try {
      const response = await authApi.updateProfile(data);
      if (response.data.success) {
        setUser(response.data.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        return response.data;
      }
      throw new Error(response.data.message || 'Profile update failed');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Profile update failed');
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authApi.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPassword,
      });
      if (response.data.success) {
        return response.data;
      }
      throw new Error(response.data.message || 'Password change failed');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Password change failed');
    }
  };

  // ----- Permission helper -----
  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const value: AuthContextType = {
    user,
    role,
    token,
    permissions,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    verifyOTP,
    resendVerification,
    forgotPassword,
    resetPassword,
    logout,
    refreshUser,
    updateProfile,
    changePassword,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};