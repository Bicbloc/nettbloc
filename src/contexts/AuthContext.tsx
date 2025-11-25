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
    let sessionChecked = false;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('🔐 Auth state changed:', { event, session_exists: !!session, user_id: session?.user?.id });
        
        // Clear timeout since auth state changed
        if (timeoutId) clearTimeout(timeoutId);
        sessionChecked = true;
        
        // Use setTimeout(0) to prevent blocking the auth callback
        setTimeout(() => {
          if (isMounted) {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
        }, 0);
      }
    );

    // Get initial session with immediate response
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Session error:', error);
          if (isMounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }
        
        console.log('🚀 Initial session:', { session_exists: !!session, user_id: session?.user?.id });
        sessionChecked = true;
        
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Failed to get session:', error);
        if (isMounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    initializeSession();

    // Extended timeout - give more time for auth to complete
    timeoutId = setTimeout(() => {
      if (isMounted && !sessionChecked) {
        console.log('⏰ Auth timeout - no session response after 5s, continuing as unauthenticated');
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    }, 5000); // Back to 5000ms for reliability

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