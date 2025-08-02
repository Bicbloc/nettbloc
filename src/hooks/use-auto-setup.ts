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
      if (!isAuthenticated || !user?.id || isSetupComplete) {
        setLoading(false);
        return;
      }

      console.log('🏨 Auto-setup: Démarrage pour user:', user.email);
      
      try {
        console.log('🔍 Recherche hôtel existant...');
        // 1. Vérifier si l'utilisateur a déjà un hôtel
        const { data: existingHotel, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (hotelError) {
          console.error('❌ Erreur recherche hôtel:', hotelError);
          throw hotelError;
        }

        let hotelData = existingHotel;

        // 2. Si pas d'hôtel, créer un nouveau
        if (!existingHotel) {
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
          console.log('✅ Hôtel existant trouvé:', existingHotel);
        }

        if (hotelData) {
          setHotel(hotelData);
          console.log('🔍 Vérification codes d\'accès...');

          // 3. Vérifier les codes d'accès existants
          const { data: existingCodes, error: codeError } = await supabase
            .from('housekeeper_access_codes')
            .select('access_code')
            .eq('hotel_id', hotelData.id)
            .eq('is_active', true)
            .limit(1);

          if (codeError) {
            console.error('❌ Erreur vérification codes:', codeError);
          }

          if (existingCodes && existingCodes.length > 0) {
            console.log('✅ Code existant trouvé:', existingCodes[0].access_code);
            setAccessCode(existingCodes[0].access_code);
          } else {
            console.log('🔑 Génération nouveau code...');
            // Au lieu d'utiliser la fonction RPC, créons le code directement
            const hotelCode = hotelData.hotel_code || 'HTL';
            const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const newAccessCode = `${hotelCode}-${randomSuffix}`;

            const { data: insertedCode, error: insertError } = await supabase
              .from('housekeeper_access_codes')
              .insert({
                hotel_id: hotelData.id,
                access_code: newAccessCode,
                created_by: user.id
              })
              .select('access_code')
              .single();

            if (insertError) {
              console.error('❌ Erreur insertion code:', insertError);
            } else {
              console.log('✅ Code généré:', insertedCode.access_code);
              setAccessCode(insertedCode.access_code);
            }
          }

          setIsSetupComplete(true);
          console.log('✅ Configuration terminée');
          
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
        console.log('🏁 Auto-setup terminé');
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