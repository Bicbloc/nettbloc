import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { HotelStorageService } from '@/services/hotelStorageService';

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
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    // Timeout de sécurité - max 5 secondes de loading
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ Auth timeout - forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        console.log('🔐 Auth state changed:', { event, session_exists: !!session, user_id: session?.user?.id });

        // Keep this callback lightweight and synchronous
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    const initializeSession = async () => {
      console.log('🚀 Starting session initialization...');
      const startTime = Date.now();
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        console.log('🚀 Session result:', {
          duration: Date.now() - startTime,
          session_exists: !!session,
          user_id: session?.user?.id,
          error: error?.message
        });

        if (error) {
          console.error('❌ Session error:', error);
          if (isMounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Session init failed after', Date.now() - startTime, 'ms:', error);
        if (isMounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    initializeSession();

    return () => {
      clearTimeout(safetyTimeout);
      setIsMounted(false);
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
    // Ne PAS nettoyer le localStorage - garder les données de session
    // pour permettre la restauration rapide
    console.log('🔐 Connexion sans nettoyage localStorage pour persistance');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  };

  const signOut = async () => {
    HotelStorageService.clear();
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