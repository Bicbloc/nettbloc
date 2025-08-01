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
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const setupUserHotel = async () => {
      if (!isAuthenticated || !user) {
        if (isMounted) setLoading(false);
        return;
      }

      try {

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

        // 2. Si pas d'hôtel, créer un nouveau systématiquement avec le company_name du profil
        if (!existingHotel) {
          console.log('🏨 Auto-setup: Création d\'un nouvel hôtel...');
          
          // Récupérer le profil utilisateur pour le company_name actuel
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', user.id)
            .single();

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
          
          console.log('🏨 Auto-setup: Nouvel hôtel créé:', hotelData);
        } else {
          // 2bis. Mettre à jour le nom de l'hôtel existant avec le company_name actuel
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', user.id)
            .single();

          const updatedHotelName = profile?.company_name || existingHotel.name;
          
          if (updatedHotelName !== existingHotel.name) {
            const { data: updatedHotel, error: updateError } = await supabase
              .from('hotels')
              .update({ name: updatedHotelName })
              .eq('id', existingHotel.id)
              .select()
              .single();

            if (!updateError && updatedHotel) {
              hotelData = updatedHotel;
              console.log('🏨 Auto-setup: Nom d\'hôtel mis à jour:', updatedHotelName);
            }
          }
        }

        if (hotelData && isMounted) {
          setHotel(hotelData);

          // 3. Générer un code d'accès si il n'en existe pas déjà un
          if (!accessCode && hotelData.id) {
            const { data: codeData, error: codeError } = await supabase
              .rpc('generate_hotel_access_code', {
                hotel_uuid: hotelData.id
              });

            if (codeError) {
              console.error('Erreur génération code:', codeError);
            } else if (isMounted && codeData) {
              setAccessCode(codeData);
              
              toast({
                title: "Configuration automatique",
                description: `Votre hôtel "${hotelData.name}" est prêt ! Code d'accès généré.`
              });
            }
          } else if (isMounted) {
            // Si on a déjà un code d'accès, marquer comme configuré
            toast({
              title: "Configuration complète",
              description: `Votre hôtel "${hotelData.name}" est déjà configuré.`
            });
          }

          if (isMounted) {
            setIsSetupComplete(true);
          }
        }

      } catch (error) {
        console.error('Erreur auto-setup:', error);
        if (isMounted) {
          toast({
            variant: "destructive",
            title: "Erreur configuration",
            description: "Impossible de configurer automatiquement votre hôtel."
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Set timeout to prevent hanging
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
      }
    }, 10000);

    setupUserHotel();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, user?.id]); // Only depend on user.id to prevent loops

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