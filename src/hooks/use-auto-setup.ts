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

  useEffect(() => {
    const setupUserHotel = async () => {
      if (!isAuthenticated || !user) {
        setLoading(false);
        return;
      }

      try {
        console.log('🏨 Auto-setup: Démarrage pour user:', user.email);

        // 1. Vérifier si l'utilisateur a déjà un hôtel
        const { data: existingHotel, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (hotelError && hotelError.code !== 'PGRST116') {
          throw hotelError;
        }

        let hotelData = existingHotel;

        // 2. Si pas d'hôtel, le créer automatiquement
        if (!existingHotel) {
          console.log('🏨 Auto-setup: Création de l\'hôtel...');
          
          // Récupérer le profil utilisateur pour le company_name
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', user.id)
            .single();

          const hotelName = profile?.company_name || `Hôtel de ${user.email}`;

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
          
          console.log('🏨 Auto-setup: Hôtel créé:', hotelData);
        }

        if (hotelData) {
          setHotel(hotelData);

          // 3. Générer un code d'accès si il n'existe pas
          if (!accessCode) {
            console.log('🔑 Auto-setup: Génération du code d\'accès...');
            
            const { data: codeData, error: codeError } = await supabase
              .rpc('generate_hotel_access_code', {
                hotel_uuid: hotelData.id
              });

            if (codeError) {
              console.error('Erreur génération code:', codeError);
            } else {
              setAccessCode(codeData);
              console.log('🔑 Auto-setup: Code généré:', codeData);
              
              toast({
                title: "Configuration automatique",
                description: `Votre hôtel "${hotelData.name}" est prêt ! Code d'accès généré.`
              });
            }
          }

          setIsSetupComplete(true);
        }

      } catch (error) {
        console.error('Erreur auto-setup:', error);
        toast({
          variant: "destructive",
          title: "Erreur configuration",
          description: "Impossible de configurer automatiquement votre hôtel."
        });
      } finally {
        setLoading(false);
      }
    };

    setupUserHotel();
  }, [isAuthenticated, user]);

  const generateNewAccessCode = async () => {
    if (!hotel) return;

    try {
      const { data: codeData, error } = await supabase
        .rpc('generate_hotel_access_code', {
          hotel_uuid: hotel.id
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