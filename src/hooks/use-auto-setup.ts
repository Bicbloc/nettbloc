import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HotelData {
  id: string;
  name: string;
  hotel_code: string;
  access_code?: string;
}

export const useAutoSetup = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const setupHotel = async () => {
      if (!isAuthenticated || !user?.id || isSetupComplete) return;

      console.log('🏨 Auto-setup: Démarrage pour user:', user.email);
      
      try {
        // 1. Vérifier si l'utilisateur a déjà un hôtel
        const { data: existingHotel } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        let hotelData = existingHotel;

        // 2. Si pas d'hôtel, créer un nouveau
        if (!existingHotel) {
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

          if (createError) throw createError;
          hotelData = newHotel;
        }

        if (hotelData) {
          setHotel(hotelData);

          // 3. Vérifier les codes d'accès existants
          const { data: existingCodes } = await supabase
            .from('housekeeper_access_codes')
            .select('access_code')
            .eq('hotel_id', hotelData.id)
            .eq('is_active', true)
            .limit(1);

          if (existingCodes && existingCodes.length > 0) {
            setAccessCode(existingCodes[0].access_code);
          } else {
            // Générer un nouveau code
            const { data: codeData } = await supabase
              .rpc('generate_housekeeper_access_code', {
                p_hotel_id: hotelData.id,
                p_housekeeper_id: null
              });

            if (codeData) {
              setAccessCode(codeData);
            }
          }

          setIsSetupComplete(true);
          toast({
            title: "Configuration terminée",
            description: `Votre hôtel "${hotelData.name}" est prêt !`
          });
        }

      } catch (error) {
        console.error('❌ Erreur auto-setup:', error);
        toast({
          variant: "destructive",
          title: "Erreur configuration",
          description: "Erreur lors de la configuration de l'hôtel."
        });
      } finally {
        setLoading(false);
      }
    };

    setupHotel();
  }, [isAuthenticated, user?.id, isSetupComplete]);

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