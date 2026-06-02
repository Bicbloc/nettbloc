import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
    companyName?: string,
    extras?: { country_code?: string; preferred_language?: 'fr' | 'en'; vat_number?: string }
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

        // INITIAL_SESSION fires reliably even when getSession() stalls on the
        // auth lock (WebView / multi-tab). Use it to restore + unblock the app.
        if (event === 'INITIAL_SESSION') {
          if (sessionRestoredFromGetSession) return;
          sessionRestoredFromGetSession = true;
          clearTimeout(safetyTimeout);
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
          setIsInitialized(true);
          if (currentSession) startTokenRefresh();
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

    // Filet de sécurité: si getSession() se bloque (verrou auth en WebView /
    // multi-onglets), on débloque quand même l'app pour éviter le spinner infini
    // "Vérification de l'authentification..." qui tourne en boucle.
    const safetyTimeout = setTimeout(() => {
      if (mounted && !sessionRestoredFromGetSession) {
        console.warn('⚠️ getSession() trop lent - déblocage forcé de l\'auth');
        setLoading(false);
        setIsInitialized(true);
      }
    }, 5000);

    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        sessionRestoredFromGetSession = true;
        
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
          sessionRestoredFromGetSession = true;
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          clearTimeout(safetyTimeout);
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };
    
    initSession();


    // Récupération automatique de la session quand l'app revient au premier plan
    // (ex: l'utilisateur quitte Chrome puis revient). Sans cela, le token peut
    // être expiré et les requêtes (inventaire, etc.) ne retournent aucune valeur.
    let lastResume = 0;
    const handleResume = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      // throttle pour éviter les appels multiples rapprochés
      if (now - lastResume < 3000) return;
      lastResume = now;

      const { data: { session: current } } = await supabase.auth.getSession();
      if (!mounted || !current) return;

      // Re-valider/rafraîchir la session puis signaler aux écrans de recharger
      const ok = await refreshSession();
      if (ok && mounted) {
        startTokenRefresh();
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_REFRESHED));
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      stopTokenRefresh();
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [refreshSession, startTokenRefresh, stopTokenRefresh]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    companyName?: string,
    extras?: { country_code?: string; preferred_language?: 'fr' | 'en'; vat_number?: string }
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${APP_ORIGIN}/`,
        data: {
          company_name: companyName,
          country_code: extras?.country_code,
          preferred_language: extras?.preferred_language,
          vat_number: extras?.vat_number,
        }
      }
    });

    // Si l'utilisateur a une session immédiatement, on persiste les champs profils.
    if (!error && data?.user && extras) {
      try {
        await supabase
          .from('profiles')
          .update({
            country_code: extras.country_code || null,
            preferred_language: extras.preferred_language || 'fr',
            vat_number: extras.vat_number?.trim() || null,
          })
          .eq('id', data.user.id);
      } catch (e) {
        // best-effort: les données restent dans raw_user_meta_data pour reprise ultérieure
      }
    }

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

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isInitialized,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user && !!session,
    refreshSession
  }), [user, session, loading, isInitialized, signUp, signIn, signOut, refreshSession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
