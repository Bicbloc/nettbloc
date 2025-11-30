import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { HotelStorageService } from '@/services/hotelStorageService';

interface HotelData {
  id: string;
  name: string;
  hotel_code: string;
  access_code?: string;
  user_id?: string;
  email?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

interface HotelWithCodes extends HotelData {
  housekeeper_access_codes: {
    access_code: string;
    is_active: boolean;
  }[];
}

export const useAutoSetup = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const hasAttemptedSetup = useRef(false);
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  // Helper functions
  const createOrUpdateProfile = async (user: any) => {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        company_name: user.user_metadata?.company_name || null
      })
      .select()
      .single();
    
    if (error) console.error('Profile upsert error:', error);
    return data;
  };

  const findUserHotel = async (user: any): Promise<HotelData | null> => {
    const { data } = await supabase
      .from('hotels')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    return data;
  };

  const createHotel = async (user: any): Promise<HotelData | null> => {
    const hotelName = user.user_metadata?.company_name || `Établissement de ${user.email}`;
    const hotelCode = `HTL${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

    const { data, error } = await supabase
      .from('hotels')
      .insert({
        name: hotelName,
        email: user.email,
        user_id: user.id,
        hotel_code: hotelCode
      })
      .select()
      .single();

    if (error) {
      console.error('Hotel creation error:', error);
      return null;
    }

    return data;
  };

  const getActiveAccessCode = async (hotelId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('housekeeper_access_codes')
      .select('access_code')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    return data?.access_code || null;
  };

  const setupHotel = useCallback(async () => {
    if (!user || loading) return;
    
    hasAttemptedSetup.current = true;
    console.log('🏨 Starting optimized hotel setup for user:', user.id);
    setLoading(true);
    
    try {
      // PHASE 1: Vérification RAPIDE du cache localStorage
      const cachedHotel = HotelStorageService.get();
      if (cachedHotel && cachedHotel.id && cachedHotel.id.length > 30) {
        console.log('⚡ CACHE HIT - Hôtel chargé depuis localStorage:', cachedHotel.id);
        setHotel({
          id: cachedHotel.id,
          name: cachedHotel.name,
          hotel_code: cachedHotel.code
        });
        setIsSetupComplete(true);
        setLoading(false);
        
        // Charger le code d'accès en arrière-plan
        getActiveAccessCode(cachedHotel.id).then(code => {
          if (code) setAccessCode(code);
        });
        
        return; // Démarrage INSTANTANÉ!
      }

      console.log('📡 Cache miss - Chargement depuis base de données...');

      // PHASE 2: Requête UNIQUE avec lien direct profiles.current_hotel_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id, 
          email, 
          company_name, 
          current_hotel_id,
          hotels!profiles_current_hotel_id_fkey(
            id, 
            name, 
            hotel_code,
            email
          )
        `)
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile query error:', profileError);
        // Fallback: créer le profil
        await createOrUpdateProfile(user);
      }

      let hotelResult: HotelData | null = null;

      // Si l'hôtel est lié au profil, l'utiliser directement
      if (profileData?.hotels) {
        hotelResult = profileData.hotels as unknown as HotelData;
        console.log('✅ Hôtel chargé via lien direct profiles.current_hotel_id');
      } else {
        // Fallback: chercher par user_id ou email
        console.log('🔍 Recherche hôtel par user_id/email...');
        hotelResult = await findUserHotel(user);
        
        if (!hotelResult) {
          console.log('🆕 Création nouvel hôtel...');
          hotelResult = await createHotel(user);
        }

        // Mettre à jour le lien direct dans profiles
        if (hotelResult) {
          await supabase
            .from('profiles')
            .update({ current_hotel_id: hotelResult.id })
            .eq('id', user.id);
          console.log('✅ Lien profiles.current_hotel_id mis à jour');
        }
      }

      if (!hotelResult) {
        console.error('❌ Impossible de trouver ou créer l\'hôtel');
        setLoading(false);
        return;
      }

      console.log('✅ Configuration hôtel terminée:', {
        id: hotelResult.id,
        name: hotelResult.name,
        code: hotelResult.hotel_code
      });

      // Sauvegarder dans le cache pour prochain chargement
      setHotel(hotelResult);
      HotelStorageService.save({
        id: hotelResult.id,
        name: hotelResult.name,
        code: hotelResult.hotel_code || ''
      });

      // Charger le code d'accès
      const activeCode = await getActiveAccessCode(hotelResult.id);
      if (activeCode) {
        setAccessCode(activeCode);
        console.log('✅ Code d\'accès actif trouvé');
      }

      setIsSetupComplete(true);
    } catch (error) {
      console.error('❌ Erreur setupHotel:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('🔄 useAutoSetup effect déclenché', {
      authLoading,
      isAuthenticated,
      userId: user?.id,
      lastUserId,
      hasAttempted: hasAttemptedSetup.current
    });

    // Attendre que l'auth soit complètement initialisée
    if (authLoading) {
      return;
    }

    // Si pas connecté, réinitialiser l'état local
    if (!user?.id || !isAuthenticated) {
      setHotel(null);
      setAccessCode(null);
      setIsSetupComplete(false);
      setLoading(false);
      hasAttemptedSetup.current = false;
      setLastUserId(null);
      return;
    }

    // Nouvel utilisateur connecté -> on réinitialise le flag de setup
    if (lastUserId !== user.id) {
      console.log('👤 Nouvel utilisateur détecté, réinitialisation du setup');
      hasAttemptedSetup.current = false;
      setLastUserId(user.id);
    }

    if (!hasAttemptedSetup.current) {
      setupHotel();
    }
  }, [authLoading, isAuthenticated, user?.id, lastUserId, setupHotel]);

  const generateNewAccessCode = async () => {
    if (!hotel) return;

    try {
      const { data: codeData, error } = await supabase
        .rpc('generate_housekeeper_access_code', {
          p_hotel_id: hotel.id,
          p_housekeeper_id: null
        });

      if (error) throw error;

      setAccessCode(codeData);
      toast({
        title: "Nouveau code généré",
        description: `Code d'accès: ${codeData}`
      });

      return codeData;
    } catch (error) {
      console.error('Erreur génération nouveau code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer un nouveau code d'accès."
      });
    }
  };

  return {
    hotel,
    accessCode,
    isSetupComplete,
    loading,
    generateNewAccessCode
  };
};