import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isInitialized: boolean;
  signUp: (
    email: string,
    password: string,
    companyName?: string
  ) => Promise<{ error: AuthError | null; needsEmailVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; success: boolean }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Événement global pour la reconnexion realtime après login
export const AUTH_EVENTS = {
  SIGNED_IN: 'auth:signed_in',
  SIGNED_OUT: 'auth:signed_out',
  SESSION_REFRESHED: 'auth:session_refreshed',
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  /**
   * Rafraîchit la session - retourne true si succès
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;

    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('⚠️ Refresh session failed:', error.message);
        if (error.message.includes('invalid') || error.message.includes('expired')) {
          storageService.clearVolatile();
          setSession(null);
          setUser(null);
        }
        return false;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_REFRESHED));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erreur refresh session:', error);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  /**
   * Démarre le refresh automatique du token (toutes les 10 minutes)
   */
  const startTokenRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    refreshIntervalRef.current = setInterval(() => {
      refreshSession();
    }, 10 * 60 * 1000);
  }, [refreshSession]);

  /**
   * Arrête le refresh automatique
   */
  const stopTokenRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Configurer le listener EN PREMIER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        console.log('🔐 Auth event:', event);

        // Mise à jour synchrone de l'état (y compris INITIAL_SESSION)
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        setIsInitialized(true);

        if (event === 'SIGNED_IN' && currentSession) {
          startTokenRefresh();
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SIGNED_IN, {
            detail: { userId: currentSession.user.id }
          }));
        } else if (event === 'SIGNED_OUT') {
          stopTokenRefresh();
          storageService.clearHotel();
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SIGNED_OUT));
        }
      }
    );

    // 2. Vérifier la session existante avec try/catch/finally
    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.warn('⚠️ getSession error:', error.message);
          setSession(null);
          setUser(null);
        } else {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          
          if (currentSession) {
            startTokenRefresh();
          }
        }
      } catch (err) {
        console.error('❌ getSession exception:', err);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };
    
    initSession();

    return () => {
      mounted = false;
      stopTokenRefresh();
      subscription.unsubscribe();
    };
  }, [refreshSession, startTokenRefresh, stopTokenRefresh]);

  const signUp = useCallback(async (email: string, password: string, companyName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { company_name: companyName }
      }
    });

    // Si Supabase exige la confirmation email, il n'y aura pas de session immédiate.
    const needsEmailVerification = !error && !data?.session;

    return { error, needsEmailVerification };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    storageService.cleanupLegacyKeys();
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      return { error, success: false };
    }
    
    // Mise à jour IMMÉDIATE sans attendre onAuthStateChange
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      setLoading(false);
      startTokenRefresh();
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SIGNED_IN, { 
        detail: { userId: data.session.user.id } 
      }));
    }
    
    return { error: null, success: true };
  }, [startTokenRefresh]);

  const signOut = useCallback(async () => {
    stopTokenRefresh();
    const hotelData = storageService.getHotel();
    await supabase.auth.signOut();
    if (hotelData) {
      storageService.saveHotel(hotelData);
    }
  }, [stopTokenRefresh]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isInitialized,
      signUp,
      signIn,
      signOut,
      isAuthenticated: !!user && !!session,
      refreshSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};
