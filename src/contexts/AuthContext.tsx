import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, companyName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Timeout de sécurité - force la fin du loading après 5 secondes
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn('⚠️ Auth timeout - forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMountedRef.current) return;

        console.log('🔐 Auth state changed:', { event, session_exists: !!session, user_id: session?.user?.id });

        // Keep this callback lightweight and synchronous
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Session error:', error);
          // Nettoyer le localStorage si session corrompue
          if (error.message?.includes('refresh_token') || error.message?.includes('invalid')) {
            console.log('🧹 Nettoyage session corrompue');
            await supabase.auth.signOut();
            localStorage.clear();
          }
          if (isMountedRef.current) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        console.log('🚀 Initial session:', { session_exists: !!session, user_id: session?.user?.id });

        if (isMountedRef.current) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Failed to get session:', error);
        if (isMountedRef.current) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    initializeSession();

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

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
    
    // Si pas d'erreur, connexion automatique (Supabase gère ça automatiquement maintenant)
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Nettoyer tous les hotel IDs du localStorage avant la connexion
    localStorage.removeItem('selectedHotelId');
    localStorage.removeItem('selectedHotelCode');
    localStorage.removeItem('selectedHotelName');
    localStorage.removeItem('currentHotelId');
    localStorage.removeItem('hotelId');
    localStorage.removeItem('lastSavedHotelId');
    console.log('🧹 localStorage nettoyé pour nouvelle connexion');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};