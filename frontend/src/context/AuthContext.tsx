import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  loginMethod: 'google' | 'phone';
  loggedInAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<boolean>;
  verifyPhoneOtp: (phone: string, otp: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'curaa_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize session from LocalStorage or Supabase
  useEffect(() => {
    const initAuth = async () => {
      // 1. Check local storage first for quick restore
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (e) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }

      // 2. If Supabase is configured, check live Supabase session
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const sbUser = session.user;
            const parsedUser: User = {
              id: sbUser.id,
              name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || sbUser.phone || 'Authenticated User',
              email: sbUser.email || undefined,
              phone: sbUser.phone || undefined,
              avatar: sbUser.user_metadata?.avatar_url || undefined,
              loginMethod: sbUser.app_metadata?.provider === 'google' ? 'google' : 'phone',
              loggedInAt: new Date().toISOString()
            };
            setUser(parsedUser);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsedUser));
          }
        } catch (err) {
          console.error('Supabase session check error:', err);
        }
      }

      setLoading(false);
    };

    initAuth();

    // Listen to Supabase auth state changes if configured
    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const sbUser = session.user;
          const parsedUser: User = {
            id: sbUser.id,
            name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || sbUser.phone || 'Authenticated User',
            email: sbUser.email || undefined,
            phone: sbUser.phone || undefined,
            avatar: sbUser.user_metadata?.avatar_url || undefined,
            loginMethod: sbUser.app_metadata?.provider === 'google' ? 'google' : 'phone',
            loggedInAt: new Date().toISOString()
          };
          setUser(parsedUser);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsedUser));
        } else if (!localStorage.getItem(LOCAL_STORAGE_KEY)) {
          setUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Google Login
  const loginWithGoogle = async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        console.error('Supabase Google OAuth error:', error);
        throw error;
      }
      return;
    }

    // Demo Mode Google Login Simulation
    const mockUser: User = {
      id: 'usr_g_' + Date.now(),
      name: 'Dr. Rahul Sharma',
      email: 'rahul.sharma@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      loginMethod: 'google',
      loggedInAt: new Date().toISOString()
    };
    setUser(mockUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockUser));
  };

  // Send Phone OTP
  const sendPhoneOtp = async (phone: string): Promise<boolean> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOtp({
        phone
      });
      if (error) {
        console.error('Supabase Phone OTP send error:', error);
        throw error;
      }
      return true;
    }

    // Demo mode: Return true instantly
    return true;
  };

  // Verify Phone OTP
  const verifyPhoneOtp = async (phone: string, otp: string): Promise<boolean> => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms'
      });

      if (error) {
        console.error('Supabase OTP verify error:', error);
        throw error;
      }

      if (data.user) {
        const sbUser = data.user;
        const parsedUser: User = {
          id: sbUser.id,
          name: sbUser.user_metadata?.full_name || phone,
          phone: phone,
          loginMethod: 'phone',
          loggedInAt: new Date().toISOString()
        };
        setUser(parsedUser);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsedUser));
        return true;
      }
      return false;
    }

    // Demo mode OTP verification (Accepts any 6-digit OTP or default '123456')
    if (otp.length === 6) {
      const mockUser: User = {
        id: 'usr_p_' + Date.now(),
        name: `Patient (${phone.slice(-4)})`,
        phone: phone,
        loginMethod: 'phone',
        loggedInAt: new Date().toISOString()
      };
      setUser(mockUser);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockUser));
      return true;
    }
    return false;
  };

  // Logout
  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        loginWithGoogle,
        sendPhoneOtp,
        verifyPhoneOtp,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
