import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { HotelStorageService } from '@/services/hotelStorageService';

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
  const initAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  const initializeSession = useCallback(async () => {
    console.log('🚀 Starting session initialization...');
    const startTime = Date.now();
    
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      console.log('🚀 Session result:', {
        duration: Date.now() - startTime,
        session_exists: !!currentSession,
        user_id: currentSession?.user?.id,
        error: error?.message
      });

      if (!isMountedRef.current) return;

      if (error) {
        console.error('❌ Session error:', error);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    } catch (error) {
      console.error('❌ Session init failed after', Date.now() - startTime, 'ms:', error);
      if (isMountedRef.current) {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Set up auth state listener FIRST (before checking session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMountedRef.current) return;

        console.log('🔐 Auth state changed:', { 
          event, 
          session_exists: !!currentSession, 
          user_id: currentSession?.user?.id 
        });

        // Keep this callback lightweight and synchronous
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Clear storage on sign out
        if (event === 'SIGNED_OUT') {
          HotelStorageService.clear();
        }
      }
    );

    // THEN get initial session
    initializeSession();

    // Safety timeout - 15 seconds with retry
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && loading) {
        initAttemptsRef.current += 1;
        
        if (initAttemptsRef.current < 3) {
          console.warn(`⚠️ Auth timeout - retry attempt ${initAttemptsRef.current}`);
          initializeSession();
        } else {
          console.error('❌ Auth initialization failed after 3 attempts');
          setLoading(false);
        }
      }
    }, 15000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [initializeSession]);

  const signUp = async (email: string, password: string, companyName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          company_name: companyName
        }
      }
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Signing in...');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  };

  const signOut = async () => {
    // Préserver l'ID de l'hôtel pour restaurer les données après reconnexion
    const hotelId = localStorage.getItem('selectedHotelId');
    const lastHotelSession = localStorage.getItem('hotel_session');
    
    HotelStorageService.clear();
    localStorage.removeItem('nettobloc_session_id');
    
    // Restaurer l'ID de l'hôtel pour permettre la restauration des sections
    if (hotelId) {
      localStorage.setItem('selectedHotelId', hotelId);
      localStorage.setItem('lastHotelId', hotelId);
    }
    if (lastHotelSession) {
      localStorage.setItem('hotel_session', lastHotelSession);
    }
    
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user && !!session
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
