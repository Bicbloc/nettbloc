import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { APP_ORIGIN } from '@/constants/appUrl';
import { useToast } from '@/hooks/use-toast';
import { storageService } from '@/services/storageService';
import { validateEmailForUserType } from '@/services/userTypeValidationService';

interface CafetiereProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  total_hotels_worked: number;
}

interface HotelSession {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  is_active: boolean;
  access_code: string;
}

interface CafetiereAuthContextType {
  user: User | null;
  session: Session | null;
  profile: CafetiereProfile | null;
  currentHotelSession: HotelSession | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  requestHotelAccess: (hotelCode: string) => Promise<{ success: boolean; error?: any }>;
  updateProfile: (updates: Partial<CafetiereProfile>) => Promise<{ error: any }>;
}

const CafetiereAuthContext = createContext<CafetiereAuthContextType | undefined>(undefined);

export const useCafetiereAuth = () => {
  const context = useContext(CafetiereAuthContext);
  if (!context) {
    throw new Error('useCafetiereAuth must be used within CafetiereAuthProvider');
  }
  return context;
};

export const CafetiereAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CafetiereProfile | null>(null);
  const [currentHotelSession, setCurrentHotelSession] = useState<HotelSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isCafetiereRoute = () =>
    typeof window !== 'undefined' && window.location.pathname.startsWith('/cafetiere');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user && isCafetiereRoute()) {
        loadCafetiereProfile();
      } else {
        setProfile(null);
        setCurrentHotelSession(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user && isCafetiereRoute()) {
        setTimeout(() => {
          loadCafetiereProfile();
        }, 0);
      } else {
        setProfile(null);
        setCurrentHotelSession(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCafetiereProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('cafetiere_profiles')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (!profileData) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const mappedProfile: CafetiereProfile = {
        id: profileData.id,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        is_active: profileData.is_active,
        total_hotels_worked: profileData.total_hotels_worked,
      };

      setProfile(mappedProfile);

      const { data: approvedHotels } = await supabase
        .rpc('get_approved_hotels_for_cafetiere' as any, {
          p_cafetiere_profile_id: mappedProfile.id,
        });

      const hotelsArray = (approvedHotels as Array<{ hotel_id: string; hotel_name: string; hotel_code: string }> | null) || [];

      if (hotelsArray.length > 0) {
        const storedHotelId = storageService.getHotelId?.() || localStorage.getItem('lastSelectedHotelId');
        const selected = hotelsArray.find(h => h.hotel_id === storedHotelId) || hotelsArray[0];

        setCurrentHotelSession({
          id: selected.hotel_id,
          hotel_id: selected.hotel_id,
          hotel_name: selected.hotel_name,
          is_active: true,
          access_code: selected.hotel_code || '',
        });

        storageService.saveHotel({
          id: selected.hotel_id,
          name: selected.hotel_name || '',
          code: selected.hotel_code || '',
        });
      } else {
        setCurrentHotelSession(null);
      }
    } catch (error) {
      console.error('Error loading cafetiere profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    try {
      const validation = await validateEmailForUserType(email, 'cafetiere');
      if (!validation.isValid) {
        return { error: new Error(validation.error || 'Email déjà utilisé pour un autre rôle') };
      }

      const redirectUrl = `${APP_ORIGIN}/cafetiere/login`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { name, phone, role: 'cafetiere' },
        },
      });

      if (authError) throw authError;

      if (authData.user?.identities && authData.user.identities.length === 0) {
        return { error: new Error('Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.') };
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
      const { data: hotel, error: hotelError } = await supabase
        .rpc('search_hotel_by_code', { p_code: hotelCode })
        .maybeSingle();

      if (hotelError) {
        throw new Error("Erreur lors de la recherche de l'établissement");
      }

      if (!hotel) {
        throw new Error('Code établissement introuvable. Vérifiez le code auprès de votre responsable.');
      }

      const { data: existingRequest } = await supabase
        .from('cafetiere_access_requests')
        .select('id, status')
        .eq('cafetiere_profile_id', profile.id)
        .eq('hotel_id', hotel.id)
        .maybeSingle();

      if (existingRequest?.status === 'pending') {
        throw new Error("Une demande d'accès est déjà en attente pour cet établissement");
      }
      if (existingRequest?.status === 'approved') {
        throw new Error('Vous êtes déjà approuvé pour cet établissement');
      }

      const { error: requestError } = await supabase
        .from('cafetiere_access_requests')
        .insert({
          cafetiere_profile_id: profile.id,
          hotel_id: hotel.id,
          hotel_code: hotelCode.toUpperCase(),
          status: 'pending',
        });

      if (requestError) throw requestError;

      toast({
        title: 'Demande envoyée ✅',
        description: "Votre demande d'accès a été envoyée à l'établissement",
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error requesting access:', error);
      return { success: false, error };
    }
  };

  const updateProfile = async (updates: Partial<CafetiereProfile>) => {
    if (!user || !profile) {
      return { error: 'Not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('cafetiere_profiles')
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
    requestHotelAccess,
    updateProfile,
  };

  return (
    <CafetiereAuthContext.Provider value={value}>
      {children}
    </CafetiereAuthContext.Provider>
  );
};
