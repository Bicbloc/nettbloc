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

  useEffect(() => {
    console.log('🔧 AuthContext: Initialisation des listeners d\'authentification');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`🔄 AuthContext: Auth state change - Event: ${event}, Session:`, !!session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Nettoyer les données d'hôtel obsolètes lors de l'authentification
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('🧹 Nettoyage des données d\'hôtel obsolètes après connexion');
          localStorage.removeItem('selectedHotelCode');
          localStorage.removeItem('selectedHotelId');
          localStorage.removeItem('selectedHotelName');
          localStorage.removeItem('userEmail');
        }
      }
    );

    // Get initial session
    console.log('🔍 AuthContext: Vérification de la session initiale');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 AuthContext: Session initiale récupérée:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('❌ AuthContext: Erreur récupération session initiale:', error);
      setLoading(false);
    });

    return () => {
      console.log('🧹 AuthContext: Nettoyage des listeners');
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