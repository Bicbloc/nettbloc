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
      console.log('Tentative de connexion avec le code:', accessCode);
      
      // Check if it's a simple hotel code (like HTL002) - make access request
      if (accessCode.length <= 6 && !accessCode.includes('-')) {
        console.log('Code simple détecté, création de demande d\'accès');
        const requestResult = await requestHotelAccess(accessCode);
        if (requestResult.success) {
          return { success: false, error: "Demande d'accès envoyée. En attente d'approbation de l'admin." };
        } else {
          return { success: false, error: requestResult.error };
        }
      }

      // First, check if it's a generated access code in housekeeper_access_codes
      console.log('Recherche du code dans housekeeper_access_codes');
      const { data: accessCodeData, error: codeError } = await supabase
        .from('housekeeper_access_codes')
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
        .is('used_at', null)
        .maybeSingle();

      console.log('Résultat de la recherche:', { accessCodeData, codeError });

      if (accessCodeData && !codeError) {
        console.log('Code trouvé, création de session');
        
        // Mark the code as used
        const { error: updateError } = await supabase
          .from('housekeeper_access_codes')
          .update({ used_at: new Date().toISOString() })
          .eq('id', accessCodeData.id);

        if (updateError) {
          console.error('Erreur lors de la mise à jour du code:', updateError);
          return { success: false, error: "Erreur lors de l'utilisation du code" };
        }

        // Create a new hotel access session
        const sessionToken = Math.random().toString(36).substring(2, 15);
        const { data: newSession, error: sessionError } = await supabase
          .from('hotel_access_sessions')
          .insert({
            housekeeper_profile_id: profile.id,
            hotel_id: accessCodeData.hotel_id,
            access_code: accessCode,
            session_token: sessionToken,
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
            is_active: true
          })
          .select(`
            *,
            hotels:hotel_id (
              id,
              name,
              hotel_code,
              address
            )
          `)
          .single();

        if (sessionError) {
          console.error('Erreur lors de la création de session:', sessionError);
          return { success: false, error: "Erreur lors de la création de la session" };
        }

        console.log('Session créée avec succès:', newSession);

        const hotelSession: HotelSession = {
          ...newSession,
          hotel: Array.isArray(newSession.hotels) ? newSession.hotels[0] : newSession.hotels
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

        // Create notification for admin
        await supabase
          .from('notifications')
          .insert({
            user_id: accessCodeData.created_by,
            hotel_id: accessCodeData.hotel_id,
            title: 'Nouvelle connexion femme de chambre',
            description: `${profile.name} s'est connectée avec le code ${accessCode}`,
            type: 'housekeeper_connected',
            user_type: 'admin'
          });

        return { success: true, session: hotelSession };
      }

      console.log('Code non trouvé dans housekeeper_access_codes');
      return { success: false, error: "Code d'accès invalide ou déjà utilisé" };

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
      console.log('Recherche hôtel avec code:', hotelCode);
      
      // Find hotel by hotel code with explicit RLS bypass for public search
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('id, name, hotel_code')
        .eq('hotel_code', hotelCode)
        .maybeSingle();

      console.log('Résultat recherche hôtel:', { hotel, hotelError });

      if (hotelError) {
        console.error('Erreur recherche hôtel:', hotelError);
        return { success: false, error: `Erreur de recherche: ${hotelError.message}` };
      }
      
      if (!hotel) {
        return { success: false, error: "Code d'hôtel invalide ou hôtel introuvable" };
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

      // Create notification for hotel admin
      const { data: hotelOwner } = await supabase
        .from('hotels')
        .select('user_id')
        .eq('id', hotel.id)
        .single();

      if (hotelOwner) {
        await supabase
          .from('notifications')
          .insert({
            user_id: hotelOwner.user_id,
            hotel_id: hotel.id,
            title: 'Nouvelle demande d\'accès',
            description: `${profile.name} demande l'accès à votre hôtel (${hotelCode})`,
            type: 'housekeeper_access_request',
            user_type: 'admin'
          });
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
