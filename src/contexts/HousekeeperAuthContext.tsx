import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { APP_ORIGIN } from '@/constants/appUrl';
import { useAuth } from './AuthContext';
import { validateEmailForUserType } from '@/services/userTypeValidationService';

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
  // Utiliser l'auth centralisé au lieu de dupliquer
  const { user, session, loading: authLoading } = useAuth();
  
  // États spécifiques aux housekeepers
  const [profile, setProfile] = useState<HousekeeperProfile | null>(null);
  const [currentHotelSession, setCurrentHotelSession] = useState<HotelSession | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileLoadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Charger le profil housekeeper quand l'utilisateur change
  useEffect(() => {
    // Clear any pending timeout
    if (profileLoadTimeoutRef.current) {
      clearTimeout(profileLoadTimeoutRef.current);
    }

    if (user && !authLoading) {
      loadHousekeeperProfile(user);
      
      // Safety timeout - don't block forever if profile load fails
      profileLoadTimeoutRef.current = setTimeout(() => {
        if (profileLoading) {
          setProfileLoading(false);
        }
      }, 5000);
    } else if (!user && !authLoading) {
      setProfile(null);
      setCurrentHotelSession(null);
    }

    return () => {
      if (profileLoadTimeoutRef.current) {
        clearTimeout(profileLoadTimeoutRef.current);
      }
    };
  }, [user, authLoading]);

  // Auto-refresh on visibility change and online status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && !authLoading) {
        loadHousekeeperProfile(user);
      }
    };

    const handleOnline = () => {
      if (user && !authLoading) {
        loadHousekeeperProfile(user);
      }
    };

    const handleFocus = () => {
      if (user && !authLoading && !profile) {
        loadHousekeeperProfile(user);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, authLoading, profile]);

  // Subscribe to realtime session updates
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('housekeeper-session-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hotel_access_sessions',
          filter: `housekeeper_profile_id=eq.${profile.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const data = payload.new as any;
            if (data.is_active && new Date(data.expires_at) > new Date()) {
              // Reload session data
              loadHousekeeperProfile({ id: profile.id, email: profile.email } as User);
            } else if (!data.is_active && currentHotelSession?.id === data.id) {
              // Session ended
              setCurrentHotelSession(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const loadHousekeeperProfile = async (user: User) => {
    setProfileLoading(true);
    try {
      const { data: profileData, error } = await supabase
        .from('housekeeper_profiles')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        console.error('❌ Error loading housekeeper profile:', error);
        setProfileLoading(false);
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
            hotel: Array.isArray(sessionData.hotels) ? sessionData.hotels[0] : sessionData.hotels,
            started_at: sessionData.started_at || sessionData.created_at,
            rooms_cleaned_today: sessionData.rooms_cleaned_today || 0
          } as HotelSession);
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error('❌ Error in loadHousekeeperProfile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    // Cross-role email validation
    const validation = await validateEmailForUserType(email, 'housekeeper');
    if (!validation.isValid) {
      return { error: new Error(validation.error || "Email déjà utilisé pour un autre rôle") };
    }

    const redirectUrl = `${APP_ORIGIN}/housekeeper/login`;
    
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
      
      // Check if it's a simple hotel code (like HTL002) - make access request
      if (accessCode.length <= 6 && !accessCode.includes('-')) {
        const requestResult = await requestHotelAccess(accessCode);
        if (requestResult.success) {
          return { success: false, error: "Demande d'accès envoyée. En attente d'approbation de l'admin." };
        } else {
          return { success: false, error: requestResult.error };
        }
      }

      // First, check if it's a generated access code in housekeeper_access_codes
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


      if (accessCodeData && !codeError) {
        
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


        const hotelSession: HotelSession = {
          ...newSession,
          hotel: Array.isArray(newSession.hotels) ? newSession.hotels[0] : newSession.hotels,
          started_at: newSession.started_at || newSession.created_at,
          rooms_cleaned_today: newSession.rooms_cleaned_today || 0
        } as HotelSession;

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
      
      // Find hotel by hotel code via RPC sécurisée (bypass RLS)
      const { data: hotel, error: hotelError } = await supabase
        .rpc('search_hotel_by_code', { p_code: hotelCode })
        .maybeSingle();


      if (hotelError) {
        console.error('Erreur recherche hôtel:', hotelError);
        return { success: false, error: `Erreur de recherche: ${hotelError.message}` };
      }
      
      if (!hotel) {
        return { success: false, error: "Code d'établissement introuvable. Vérifiez le code auprès de votre responsable." };
      }

      // Check if user already has an active access to this hotel
      const { data: existingActiveSession } = await supabase
        .from('hotel_access_sessions')
        .select('id, is_active')
        .eq('housekeeper_profile_id', profile.id)
        .eq('hotel_id', hotel.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingActiveSession) {
        return { success: false, error: "Vous avez déjà accès à cet hôtel. Allez dans 'Mes Hôtels' pour le voir." };
      }

      // Check if there's already a pending request
      const { data: existingPendingRequest } = await supabase
        .from('housekeeper_access_requests')
        .select('id, status')
        .eq('housekeeper_profile_id', profile.id)
        .eq('hotel_id', hotel.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingPendingRequest) {
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
    loading: authLoading || profileLoading,
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
