import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface HousekeeperProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profile_picture_url?: string;
  total_rooms_cleaned: number;
  total_hotels_worked: number;
  average_rating?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HotelSession {
  id: string;
  hotel_id: string;
  access_code: string;
  session_token: string;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  rooms_cleaned_today: number;
  hotel?: {
    id: string;
    name: string;
    hotel_code: string;
    address?: string;
  };
}

interface HousekeeperAuthContextType {
  user: User | null;
  session: Session | null;
  profile: HousekeeperProfile | null;
  currentHotelSession: HotelSession | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  connectToHotel: (accessCode: string) => Promise<{ success: boolean; error?: string; session?: HotelSession }>;
  requestHotelAccess: (hotelCode: string) => Promise<{ success: boolean; error?: string }>;
  disconnectFromHotel: () => Promise<void>;
  updateProfile: (updates: Partial<HousekeeperProfile>) => Promise<{ error: any }>;
  isAuthenticated: boolean;
  isConnectedToHotel: boolean;
}

const HousekeeperAuthContext = createContext<HousekeeperAuthContextType | undefined>(undefined);

export const useHousekeeperAuth = () => {
  const context = useContext(HousekeeperAuthContext);
  if (context === undefined) {
    throw new Error('useHousekeeperAuth must be used within a HousekeeperAuthProvider');
  }
  return context;
};

export const HousekeeperAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<HousekeeperProfile | null>(null);
  const [currentHotelSession, setCurrentHotelSession] = useState<HotelSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        // Use setTimeout to prevent blocking the auth callback
        setTimeout(() => {
          if (isMounted) {
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
              loadHousekeeperProfile(session.user);
            } else {
              setProfile(null);
              setCurrentHotelSession(null);
            }
            setLoading(false);
          }
        }, 0);
      }
    );

    // Get initial session
    const initializeSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await loadHousekeeperProfile(session.user);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to get session:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeSession();

    // Set timeout fallback
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
      }
    }, 5000);

    return () => {
      setIsMounted(false);
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const loadHousekeeperProfile = async (user: User) => {
    try {
      const { data: profileData, error } = await supabase
        .from('housekeeper_profiles')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        console.error('Error loading housekeeper profile:', error);
        return;
      }

      if (profileData) {
        setProfile(profileData);
        
        // Load current active hotel session if any
        const { data: sessionData, error: sessionError } = await supabase
          .from('hotel_access_sessions')
          .select(`
            *,
            hotels:hotel_id (
              id,
              name,
              hotel_code,
              address
            )
          `)
          .eq('housekeeper_profile_id', profileData.id)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (sessionData && !sessionError) {
          setCurrentHotelSession({
            ...sessionData,
            hotel: Array.isArray(sessionData.hotels) ? sessionData.hotels[0] : sessionData.hotels
          });
        }
      }
    } catch (error) {
      console.error('Error in loadHousekeeperProfile:', error);
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/housekeeper/auth`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
          phone
        }
      }
    });
    
    // Create housekeeper profile if signup successful
    if (!error && data.user) {
      const { error: profileError } = await supabase
        .from('housekeeper_profiles')
        .insert({
          email,
          name,
          phone,
          total_rooms_cleaned: 0,
          total_hotels_worked: 0,
          is_active: true
        });
        
      if (profileError) {
        console.error('Error creating housekeeper profile:', profileError);
      }
    }
    
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
    // Disconnect from current hotel if connected
    if (currentHotelSession) {
      await disconnectFromHotel();
    }
    
    await supabase.auth.signOut();
    setProfile(null);
    setCurrentHotelSession(null);
  };

  const connectToHotel = async (accessCode: string): Promise<{ success: boolean; error?: string; session?: HotelSession }> => {
    if (!profile) {
      return { success: false, error: "Profil femme de chambre non trouvé" };
    }

    try {
      // Find the hotel session by access code
      const { data: sessionData, error } = await supabase
        .from('hotel_access_sessions')
        .select(`
          *,
          hotels:hotel_id (
            id,
            name,
            hotel_code,
            address
          )
        `)
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error || !sessionData) {
        return { success: false, error: "Code d'accès invalide ou expiré" };
      }

      // Update the session to link it to this housekeeper
      const { error: updateError } = await supabase
        .from('hotel_access_sessions')
        .update({
          housekeeper_profile_id: profile.id,
          started_at: new Date().toISOString()
        })
        .eq('id', sessionData.id);

      if (updateError) {
        return { success: false, error: "Erreur lors de la connexion à l'hôtel" };
      }

      const hotelSession: HotelSession = {
        ...sessionData,
        hotel: Array.isArray(sessionData.hotels) ? sessionData.hotels[0] : sessionData.hotels
      };

      setCurrentHotelSession(hotelSession);
      
      // Create hotel history entry
      await supabase
        .from('housekeeper_hotel_history')
        .insert({
          housekeeper_profile_id: profile.id,
          hotel_id: hotelSession.hotel_id,
          started_at: new Date().toISOString(),
          rooms_cleaned: 0
        });

      return { success: true, session: hotelSession };
    } catch (error) {
      console.error('Error connecting to hotel:', error);
      return { success: false, error: "Erreur lors de la connexion" };
    }
  };

  const requestHotelAccess = async (hotelCode: string): Promise<{ success: boolean; error?: string }> => {
    if (!profile) {
      return { success: false, error: "Profil femme de chambre non trouvé" };
    }

    try {
      // Find hotel by hotel code
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('id, name, hotel_code')
        .eq('hotel_code', hotelCode)
        .maybeSingle();

      if (hotelError || !hotel) {
        return { success: false, error: "Code d'hôtel invalide" };
      }

      // Check if request already exists
      const { data: existingRequest, error: requestError } = await supabase
        .from('housekeeper_access_requests')
        .select('id, status')
        .eq('housekeeper_profile_id', profile.id)
        .eq('hotel_id', hotel.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequest) {
        return { success: false, error: "Une demande d'accès est déjà en cours pour cet hôtel" };
      }

      // Create access request
      const { error: insertError } = await supabase
        .from('housekeeper_access_requests')
        .insert({
          housekeeper_profile_id: profile.id,
          hotel_id: hotel.id,
          hotel_code: hotelCode
        });

      if (insertError) {
        console.error('Error creating access request:', insertError);
        return { success: false, error: "Erreur lors de la création de la demande" };
      }

      return { success: true };
    } catch (error) {
      console.error('Error requesting hotel access:', error);
      return { success: false, error: "Erreur lors de la demande d'accès" };
    }
  };

  const disconnectFromHotel = async () => {
    if (!currentHotelSession || !profile) return;

    try {
      // End the current session
      await supabase
        .from('hotel_access_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', currentHotelSession.id);

      // Update hotel history
      const { data: historyData } = await supabase
        .from('housekeeper_hotel_history')
        .select('*')
        .eq('housekeeper_profile_id', profile.id)
        .eq('hotel_id', currentHotelSession.hotel_id)
        .is('ended_at', null)
        .maybeSingle();

      if (historyData) {
        await supabase
          .from('housekeeper_hotel_history')
          .update({
            ended_at: new Date().toISOString(),
            rooms_cleaned: currentHotelSession.rooms_cleaned_today
          })
          .eq('id', historyData.id);
      }

      setCurrentHotelSession(null);
    } catch (error) {
      console.error('Error disconnecting from hotel:', error);
    }
  };

  const updateProfile = async (updates: Partial<HousekeeperProfile>) => {
    if (!profile) {
      return { error: "Profil non trouvé" };
    }

    const { error } = await supabase
      .from('housekeeper_profiles')
      .update(updates)
      .eq('id', profile.id);

    if (!error) {
      setProfile({ ...profile, ...updates });
    }

    return { error };
  };

  const value = {
    user,
    session,
    profile,
    currentHotelSession,
    loading,
    signUp,
    signIn,
    signOut,
    connectToHotel,
    requestHotelAccess,
    disconnectFromHotel,
    updateProfile,
    isAuthenticated: !!user && !!profile,
    isConnectedToHotel: !!currentHotelSession
  };

  return (
    <HousekeeperAuthContext.Provider value={value}>
      {children}
    </HousekeeperAuthContext.Provider>
  );
};
