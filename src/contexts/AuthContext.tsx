import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let initializationPromise: Promise<void> | null = null;
    
    console.log('🔐 AuthContext: Initialisation...');

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        console.log('🔐 Auth event:', event, session ? 'avec session' : 'sans session');
        
        // Wait for initialization to complete first
        if (initializationPromise) {
          await initializationPromise;
        }
        
        // Update state immediately without setTimeout
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    // Get initial session with retry
    const initializeSession = async () => {
      let retries = 3;
      
      while (retries > 0 && isMounted) {
        try {
          console.log(`🔐 Récupération session initiale (${4 - retries}/3)...`);
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.warn('❌ Erreur récupération session:', error);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
          
          if (isMounted) {
            console.log('✅ Session récupérée:', session ? 'authentifié' : 'non authentifié');
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
          return;
          
        } catch (error) {
          console.error('❌ Erreur fatale récupération session:', error);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Final fallback
      if (isMounted) {
        console.log('⚠️ Impossible de récupérer la session, on continue sans');
        setLoading(false);
      }
    };

    initializationPromise = initializeSession();

    // Reduced timeout fallback
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.log('⏰ Timeout auth, on continue sans session');
        setLoading(false);
      }
    }, 3000);

    return () => {
      setIsMounted(false);
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
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
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
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