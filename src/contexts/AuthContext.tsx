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
        
        // Si le token est corrompu/expiré, forcer la déconnexion propre
        if (error.message.includes('invalid') || error.message.includes('expired')) {
          console.log('🔄 Token corrompu détecté, nettoyage...');
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
        console.log('✅ Session rafraîchie');
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
    
    // Refresh toutes les 10 minutes pour éviter expiration
    refreshIntervalRef.current = setInterval(() => {
      refreshSession();
    }, 10 * 60 * 1000);
    
    console.log('🔄 Auto-refresh token activé');
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
    let initialSessionLoaded = false;

    const handleAuthChange = (event: string, currentSession: Session | null) => {
      if (!mounted) return;
      
      console.log('🔐 Auth:', event);
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (initialSessionLoaded) {
        setLoading(false);
      }

      // Gérer les événements spécifiques
      if (event === 'SIGNED_IN' && currentSession) {
        startTokenRefresh();
        // Émettre événement global pour RealtimeManager
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SIGNED_IN, { 
          detail: { userId: currentSession.user.id } 
        }));
      } else if (event === 'SIGNED_OUT') {
        stopTokenRefresh();
        storageService.clearHotel();
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SIGNED_OUT));
      } else if (event === 'TOKEN_REFRESHED' && currentSession) {
        // Supabase a auto-refresh le token
        console.log('🔄 Token auto-refresh par Supabase');
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Get initial session with retry logic
    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('⚠️ Erreur getSession:', error.message);
          
          // Tentative de récupération avec refresh
          if (error.message.includes('invalid') || error.message.includes('expired')) {
            console.log('🔄 Tentative de récupération par refresh...');
            const refreshed = await refreshSession();
            if (!refreshed && mounted) {
              // Échec total - nettoyer et continuer
              storageService.clearVolatile();
            }
          }
        } else if (currentSession && mounted) {
          setSession(currentSession);
          setUser(currentSession.user);
          startTokenRefresh();
        }
      } catch (error) {
        console.error('❌ Erreur init session:', error);
      } finally {
        if (mounted) {
          initialSessionLoaded = true;
          setLoading(false);
        }
      }
    };

    initSession();

    // Safety timeout réduit à 2 secondes
    const timeout = setTimeout(() => {
      if (mounted && !initialSessionLoaded) {
        console.warn('⚠️ Auth timeout - forçage fin du chargement');
        initialSessionLoaded = true;
        setLoading(false);
      }
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      stopTokenRefresh();
      subscription.unsubscribe();
    };
  }, [refreshSession, startTokenRefresh, stopTokenRefresh]);

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
    // Nettoyer le cache avant connexion pour éviter les conflits
    storageService.cleanupLegacyKeys();
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (!error) {
      // Connexion réussie - démarrer le refresh
      startTokenRefresh();
    }
    
    return { error };
  }, [startTokenRefresh]);

  const signOut = useCallback(async () => {
    stopTokenRefresh();
    
    // Preserve hotel data for reconnection
    const hotelData = storageService.getHotel();

    await supabase.auth.signOut();

    // Restore hotel after signout (user may want to reconnect)
    if (hotelData) {
      storageService.saveHotel(hotelData);
    }
  }, [stopTokenRefresh]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
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
