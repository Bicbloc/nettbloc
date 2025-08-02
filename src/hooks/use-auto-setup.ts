import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasAttemptedSetup = useRef(false);

  useEffect(() => {
    const setupHotel = async () => {
      // Éviter les exécutions multiples
      if (hasAttemptedSetup.current) {
        console.log('🚫 Setup déjà tenté, ignore...');
        return;
      }

      if (!isAuthenticated || !user?.id) {
        console.log('🚫 Non authentifié, arrêt du setup');
        setLoading(false);
        setIsSetupComplete(false);
        hasAttemptedSetup.current = false;
        return;
      }

      console.log('🏨 Auto-setup: Démarrage pour user:', user.email);
      hasAttemptedSetup.current = true;
      
      try {
        console.log('🔍 Recherche combinée hôtel + codes d\'accès...');
        
        // 1. Rechercher l'hôtel existant
        const { data: existingHotel, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (hotelError) {
          console.error('❌ Erreur recherche hôtel:', hotelError);
          throw hotelError;
        }

        let hotelData: HotelData | null = existingHotel;
        let activeCode: string | null = null;

        // 2. Si hôtel trouvé, chercher les codes d'accès actifs
        if (existingHotel) {
          console.log('✅ Hôtel existant trouvé:', existingHotel);
          
          const { data: accessCodes } = await supabase
            .from('housekeeper_access_codes')
            .select('access_code')
            .eq('hotel_id', existingHotel.id)
            .eq('is_active', true)
            .limit(1);

          if (accessCodes && accessCodes.length > 0) {
            activeCode = accessCodes[0].access_code;
            console.log('✅ Code actif trouvé:', activeCode);
          }
        }

        // Si pas d'hôtel du tout, en créer un
        if (!hotelData) {
          console.log('📝 Création nouvel hôtel...');
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', user.id)
            .maybeSingle();

          const hotelName = profile?.company_name || `Établissement de ${user.email}`;

          const { data: newHotel, error: createError } = await supabase
            .from('hotels')
            .insert({
              name: hotelName,
              email: user.email,
              user_id: user.id
            })
            .select()
            .single();

          if (createError) {
            console.error('❌ Erreur création hôtel:', createError);
            throw createError;
          }
          hotelData = newHotel;
          console.log('✅ Hôtel créé:', hotelData);
        } else {
          console.log('✅ Hôtel existant trouvé:', hotelData);
        }

        // Finaliser le setup avec les données trouvées/créées
        if (hotelData) {
          // Mise à jour immédiate des états
          setHotel(hotelData);
          setAccessCode(activeCode);
          setIsSetupComplete(true);
          
          // Sauvegarde localStorage pour les autres composants
          localStorage.setItem('selectedHotelId', hotelData.id);
          localStorage.setItem('selectedHotelCode', hotelData.hotel_code || '');
          localStorage.setItem('selectedHotelName', hotelData.name);
          
          console.log('✅ Setup terminé avec succès:', {
            hotelId: hotelData.id,
            hotelCode: hotelData.hotel_code,
            hotelName: hotelData.name,
            hasAccessCode: !!activeCode
          });
        }

      } catch (error) {
        console.error('❌ Erreur auto-setup:', error);
        hasAttemptedSetup.current = false; // Permettre un retry
        toast({
          variant: "destructive",
          title: "Erreur configuration",
          description: "Erreur lors de la configuration de l'hôtel."
        });
      } finally {
        setLoading(false);
        console.log('🏁 Auto-setup terminé');
      }
    };

    // Timeout de sécurité pour éviter les blocages
    const setupTimeout = setTimeout(() => {
      if (loading && hasAttemptedSetup.current) {
        console.warn('⚠️ Timeout setup, forçage completion...');
        setLoading(false);
        setIsSetupComplete(true);
      }
    }, 10000); // 10 secondes max

    // Lancer le setup si nécessaire
    if (isAuthenticated && user?.id && !hasAttemptedSetup.current) {
      setupHotel();
    } else if (!isAuthenticated || !user?.id) {
      setLoading(false);
      setIsSetupComplete(false);
      hasAttemptedSetup.current = false;
    }

    return () => clearTimeout(setupTimeout);
  }, [isAuthenticated, user?.id]);

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