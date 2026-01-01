import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, companyName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;
      
      console.log('🔐 Auth:', event);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        storageService.clearHotel();
      }
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    // Safety timeout - 5 seconds max
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⚠️ Auth timeout');
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, companyName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { company_name: companyName }
      }
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    // Preserve hotel data for reconnection
    const hotelId = localStorage.getItem('selectedHotelId');
    const housekeeperNames = localStorage.getItem('housekeeper_names');
    const assignmentKeys: Record<string, string> = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('assignments_')) {
        assignmentKeys[key] = localStorage.getItem(key) || '';
      }
    }

    await supabase.auth.signOut();

    // Restore after signout
    if (hotelId) localStorage.setItem('selectedHotelId', hotelId);
    if (housekeeperNames) localStorage.setItem('housekeeper_names', housekeeperNames);
    Object.entries(assignmentKeys).forEach(([key, value]) => {
      if (value) localStorage.setItem(key, value);
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      isAuthenticated: !!user && !!session
    }}>
      {children}
    </AuthContext.Provider>
  );
};
