import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  clearCorruptedSession: () => void;
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

// Helper to clear corrupted auth data
const clearAuthStorage = () => {
  console.log('🧹 Clearing corrupted auth storage...');
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('supabase') || key.includes('sb-'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('🧹 Cleared', keysToRemove.length, 'auth keys');
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  const clearCorruptedSession = useCallback(() => {
    clearAuthStorage();
    setSession(null);
    setUser(null);
    setLoading(false);
  }, []);

  const initializeSession = useCallback(async (retryCount = 0) => {
    console.log('🚀 Starting session initialization...', { retryCount });
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
        // Check for various auth errors
        const errorMessage = error.message?.toLowerCase() || '';
        if (
          errorMessage.includes('refresh_token') || 
          errorMessage.includes('refresh token') ||
          errorMessage.includes('network') ||
          errorMessage.includes('networkerror') ||
          errorMessage.includes('failed to fetch')
        ) {
          console.warn('🔄 Detected auth/network error, clearing storage...');
          clearAuthStorage();
        }
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Session init failed after', Date.now() - startTime, 'ms:', error);
      
      const errorMessage = error?.message?.toLowerCase() || '';
      const isNetworkError = 
        errorMessage.includes('network') || 
        errorMessage.includes('failed to fetch') ||
        errorMessage.includes('timeout') ||
        error?.name === 'TypeError';

      // Retry logic for network errors with progressive delay
      if (isNetworkError && retryCount < 2 && isMountedRef.current) {
        const delay = (retryCount + 1) * 1000; // 1s, 2s
        console.log(`🔄 Network error, retrying in ${delay}ms...`);
        setTimeout(() => {
          if (isMountedRef.current) {
            initializeSession(retryCount + 1);
          }
        }, delay);
        return;
      }

      // Check for refresh token errors
      if (errorMessage.includes('refresh_token') || errorMessage.includes('refresh token')) {
        console.warn('🔄 Detected corrupted refresh token in catch, clearing storage...');
        clearAuthStorage();
      }
      
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

        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !currentSession) {
          console.warn('🔄 Token refresh failed, clearing storage...');
          clearAuthStorage();
        }

        // Keep this callback lightweight and synchronous
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Clear storage on sign out
        if (event === 'SIGNED_OUT') {
          storageService.clearHotel();
        }
      }
    );

    // THEN get initial session
    initializeSession();

    // Safety timeout - 5 seconds (reduced for better UX)
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && loading) {
        initAttemptsRef.current += 1;
        
        if (initAttemptsRef.current < 2) {
          console.warn(`⚠️ Auth timeout - retry attempt ${initAttemptsRef.current}`);
          initializeSession(0);
        } else {
          console.error('❌ Auth initialization failed after retries, forcing completion');
          setLoading(false);
        }
      }
    }, 5000);

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
    // IMPORTANT: Préserver TOUTES les données d'assignation pour restauration après reconnexion
    // Ces données ne doivent être effacées que lors de la clôture de journée
    const hotelId = localStorage.getItem('selectedHotelId');
    const lastHotelSession = localStorage.getItem('hotel_session');
    const hotelSessionPersistence = localStorage.getItem('hotel_session_persistence');
    const housekeeperNames = localStorage.getItem('housekeeper_names');
    
    // Sauvegarder les clés assignments_* avant clear
    const assignmentKeys: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('assignments_')) {
        assignmentKeys[key] = localStorage.getItem(key) || '';
      }
    }
    
    // Clear uniquement les données de session, pas les assignations
    localStorage.removeItem('nettobloc_session_id');
    
    // Restaurer TOUTES les données nécessaires pour la persistance des sections
    if (hotelId) {
      localStorage.setItem('selectedHotelId', hotelId);
      localStorage.setItem('lastHotelId', hotelId);
      localStorage.setItem('currentHotelId', hotelId);
    }
    if (lastHotelSession) {
      localStorage.setItem('hotel_session', lastHotelSession);
    }
    if (hotelSessionPersistence) {
      localStorage.setItem('hotel_session_persistence', hotelSessionPersistence);
    }
    if (housekeeperNames) {
      localStorage.setItem('housekeeper_names', housekeeperNames);
    }
    
    // Restaurer toutes les clés d'assignation
    Object.entries(assignmentKeys).forEach(([key, value]) => {
      if (value) localStorage.setItem(key, value);
    });
    
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    clearCorruptedSession,
    isAuthenticated: !!user && !!session
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
