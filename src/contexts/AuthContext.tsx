import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { APP_ORIGIN } from '@/constants/appUrl';

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
    let sessionRestoredFromGetSession = false;

    // 1. Configurer le listener EN PREMIER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        // Ne pas traiter INITIAL_SESSION ici - on laisse getSession() gérer
        // la restauration initiale pour éviter les race conditions
        if (event === 'INITIAL_SESSION') {
          // Si getSession a déjà restauré la session, ignorer
          if (sessionRestoredFromGetSession) return;
          // Sinon, mettre à jour l'état mais NE PAS marquer comme initialisé
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          return;
        }

        // Pour les autres événements, mise à jour synchrone
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
          storageService.clearActivePortal();
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
        emailRedirectTo: `${APP_ORIGIN}/`,
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
    // Nettoyer TOUS les profils de rôles pour éviter les conflits de session
    try {
      localStorage.removeItem('housekeeper_profile');
      localStorage.removeItem('governess_profile');
      localStorage.removeItem('technician_profile');
      storageService.clearHotel();
      storageService.clearActivePortal();
      storageService.clearVolatile();
    } catch (e) {
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Forcer le nettoyage du token même si signOut échoue
      localStorage.removeItem('sb-rarhqnvvbjzfdevnghnz-auth-token');
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
