import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { APP_ORIGIN } from '@/constants/appUrl';
import { useToast } from '@/hooks/use-toast';
import { storageService } from '@/services/storageService';
import { validateEmailForUserType } from '@/services/userTypeValidationService';

interface TechnicianProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  total_hotels_worked: number;
  specialties: string[];
  certifications: any[];
}

interface HotelSession {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  is_active: boolean;
  access_code: string;
}

interface TechnicianAuthContextType {
  user: User | null;
  session: Session | null;
  profile: TechnicianProfile | null;
  currentHotelSession: HotelSession | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  connectToHotel: (hotelCode: string) => Promise<{ success: boolean; error?: any }>;
  requestHotelAccess: (hotelCode: string) => Promise<{ success: boolean; error?: any }>;
  disconnectFromHotel: () => Promise<void>;
  updateProfile: (updates: Partial<TechnicianProfile>) => Promise<{ error: any }>;
}

const TechnicianAuthContext = createContext<TechnicianAuthContextType | undefined>(undefined);

export const useTechnicianAuth = () => {
  const context = useContext(TechnicianAuthContext);
  if (!context) {
    throw new Error('useTechnicianAuth must be used within TechnicianAuthProvider');
  }
  return context;
};

export const TechnicianAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<TechnicianProfile | null>(null);
  const [currentHotelSession, setCurrentHotelSession] = useState<HotelSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadTechnicianProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          loadTechnicianProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setCurrentHotelSession(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadTechnicianProfile = async (userId: string) => {
    try {
      // Get user email first to query by email (RLS policy uses email verification)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setProfile(null);
        setLoading(false);
        return;
      }
      
      // Use email to query (matches RLS policy which uses email verification)
      const { data: profileData, error: profileError } = await supabase
        .from('technician_profiles')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
      }
      
      if (!profileData) {
        setProfile(null);
        setLoading(false);
        return;
      }
      
      // Map database response to TechnicianProfile interface
      const mappedProfile: TechnicianProfile = {
        id: profileData.id,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        is_active: profileData.is_active,
        total_hotels_worked: profileData.total_hotels_worked,
        specialties: profileData.specialties || [],
        certifications: Array.isArray(profileData.certifications) ? profileData.certifications : []
      };
      
      setProfile(mappedProfile);

      // Load active hotel session (use technician_profile_id column if exists, fallback to profile id match)
      const { data: sessionData } = await supabase
        .from('hotel_access_sessions')
        .select(`
          id,
          hotel_id,
          access_code,
          is_active,
          hotels (name)
        `)
        .or(`housekeeper_profile_id.eq.${userId},access_code.ilike.${userId.substring(0, 8)}%`)
        .eq('is_active', true)
        .maybeSingle();

      if (sessionData) {
        const hotelSession = {
          id: sessionData.id,
          hotel_id: sessionData.hotel_id,
          hotel_name: (sessionData.hotels as any)?.name,
          is_active: sessionData.is_active,
          access_code: sessionData.access_code
        };
        setCurrentHotelSession(hotelSession);
        
        // Sync with storageService
        if (sessionData.hotel_id) {
          storageService.saveHotel({
            id: sessionData.hotel_id,
            name: hotelSession.hotel_name || '',
            code: ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading technician profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    try {
      // Validate cross-role email exclusivity
      const validation = await validateEmailForUserType(email, 'technician');
      if (!validation.isValid) {
        return { error: new Error(validation.error || "Email déjà utilisé pour un autre rôle") };
      }

      const redirectUrl = `${APP_ORIGIN}/technician/login`;
      
      // The profile is created automatically via database trigger (handle_technician_signup)
      // when role='technician' is set in user metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { name, phone, role: 'technician' }
        }
      });

      if (authError) throw authError;

      // Vérifier si c'est un utilisateur déjà existant (user_repeated_signup)
      if (authData.user?.identities && authData.user.identities.length === 0) {
        return { error: new Error("Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.") };
      }

      return { error: null };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      if (currentHotelSession) {
        await disconnectFromHotel();
      }
      await supabase.auth.signOut();
      setProfile(null);
      setCurrentHotelSession(null);
      storageService.clearHotel();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const requestHotelAccess = async (hotelCode: string) => {
    if (!user || !profile) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Utiliser RPC sécurisée pour rechercher l'hôtel (bypass RLS)
      const { data: hotel, error: hotelError } = await supabase
        .rpc('search_hotel_by_code', { p_code: hotelCode })
        .maybeSingle();

      if (hotelError) {
        console.error('Erreur recherche hôtel:', hotelError);
        throw new Error('Erreur lors de la recherche de l\'établissement');
      }
      
      if (!hotel) {
        throw new Error('Code établissement introuvable. Vérifiez le code auprès de votre responsable.');
      }

      const { error: requestError } = await supabase
        .from('technician_access_requests')
        .insert({
          technician_profile_id: profile.id,
          hotel_id: hotel.id,
          hotel_code: hotelCode.toUpperCase(),
          status: 'pending'
        });

      if (requestError) throw requestError;

      toast({
        title: "Demande envoyée ✅",
        description: "Votre demande d'accès a été envoyée à l'établissement"
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error requesting access:', error);
      return { success: false, error };
    }
  };

  const connectToHotel = async (hotelCode: string) => {
    if (!user || !profile) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Utiliser RPC sécurisée pour rechercher l'hôtel (bypass RLS)
      const { data: hotel, error: hotelError } = await supabase
        .rpc('search_hotel_by_code', { p_code: hotelCode })
        .maybeSingle();

      if (hotelError) {
        console.error('Erreur recherche hôtel:', hotelError);
        throw new Error('Erreur lors de la recherche de l\'établissement');
      }
      
      if (!hotel) {
        throw new Error('Code établissement introuvable. Vérifiez le code auprès de votre responsable.');
      }

      const { data: existingSession } = await supabase
        .from('hotel_access_sessions')
        .select('*')
        .eq('housekeeper_profile_id', profile.id)
        .eq('hotel_id', hotel.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingSession) {
        const hotelSession = {
          id: existingSession.id,
          hotel_id: hotel.id,
          hotel_name: hotel.name,
          is_active: true,
          access_code: existingSession.access_code
        };
        setCurrentHotelSession(hotelSession);
        storageService.saveHotel({ id: hotel.id, name: hotel.name, code: hotelCode });
        return { success: true };
      }

      return await requestHotelAccess(hotelCode);
    } catch (error: any) {
      console.error('Error connecting to hotel:', error);
      return { success: false, error };
    }
  };

  const disconnectFromHotel = async () => {
    if (!currentHotelSession) return;

    try {
      await supabase
        .from('hotel_access_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', currentHotelSession.id);

      setCurrentHotelSession(null);
      storageService.clearHotel();

      toast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté de l'établissement"
      });
    } catch (error) {
      console.error('Error disconnecting from hotel:', error);
    }
  };

  const updateProfile = async (updates: Partial<TechnicianProfile>) => {
    if (!user || !profile) {
      return { error: 'Not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('technician_profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, ...updates });
      return { error: null };
    } catch (error: any) {
      return { error };
    }
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
    updateProfile
  };

  return (
    <TechnicianAuthContext.Provider value={value}>
      {children}
    </TechnicianAuthContext.Provider>
  );
};
