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
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const setupUserHotel = async () => {
      if (!isAuthenticated || !user?.id) {
        if (isMounted) setLoading(false);
        return;
      }

      if (isSetupComplete) {
        if (isMounted) setLoading(false);
        return;
      }

      console.log('🏨 Auto-setup: Démarrage pour user:', user.email);
      setHasInitialized(true);

      try {
        // 1. Vérifier si l'utilisateur a déjà un hôtel
        const { data: existingHotel, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (hotelError) {
          throw hotelError;
        }

        let hotelData = existingHotel;

        // 2. Si pas d'hôtel, créer un nouveau
        if (!existingHotel) {
          console.log('🏨 Auto-setup: Création d\'un nouvel hôtel...');
          
          // Récupérer le profil utilisateur pour le company_name actuel
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
          
          console.log('🏨 Auto-setup: Nouvel hôtel créé:', hotelData);
        } else {
          console.log('🏨 Auto-setup: Hôtel existant trouvé:', existingHotel);
          
          // 2bis. Mettre à jour le nom de l'hôtel existant avec le company_name actuel
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', user.id)
            .maybeSingle();

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

          // 3. Vérifier s'il y a déjà un code d'accès actif
          const { data: existingCodes, error: codeCheckError } = await supabase
            .from('housekeeper_access_codes')
            .select('access_code')
            .eq('hotel_id', hotelData.id)
            .eq('is_active', true)
            .limit(1);

          if (codeCheckError) {
            console.error('Erreur vérification codes:', codeCheckError);
          }

          if (existingCodes && existingCodes.length > 0) {
            // Il y a déjà un code d'accès actif
            const existingCode = existingCodes[0].access_code;
            setAccessCode(existingCode);
            console.log('🔑 Auto-setup: Code existant trouvé:', existingCode);
            
            toast({
              title: "Hôtel configuré",
              description: `Votre hôtel "${hotelData.name}" est prêt !`
            });
          } else {
            // Générer un nouveau code d'accès
            console.log('🔑 Auto-setup: Génération d\'un nouveau code d\'accès...');
            
            try {
              const { data: codeData, error: codeError } = await supabase
                .rpc('generate_housekeeper_access_code', {
                  p_hotel_id: hotelData.id,
                  p_housekeeper_id: null
                });

              if (codeError) {
                console.error('Erreur génération code:', codeError);
                // Ne pas faire échouer tout le processus pour un code
                toast({
                  title: "Hôtel configuré",
                  description: `Votre hôtel "${hotelData.name}" est prêt ! Vous pourrez générer des codes d'accès manuellement.`
                });
              } else if (isMounted && codeData) {
                setAccessCode(codeData);
                console.log('🔑 Auto-setup: Code généré avec succès:', codeData);
                
                toast({
                  title: "Configuration automatique",
                  description: `Votre hôtel "${hotelData.name}" est prêt ! Code d'accès: ${codeData}`
                });
              }
            } catch (codeGenError) {
              console.error('Erreur génération code:', codeGenError);
              // Continuer sans code d'accès
              toast({
                title: "Hôtel configuré",
                description: `Votre hôtel "${hotelData.name}" est prêt ! Vous pourrez générer des codes d'accès manuellement.`
              });
            }
          }

          if (isMounted) {
            setIsSetupComplete(true);
            console.log('✅ Auto-setup: Configuration terminée avec succès');
          }
        }

      } catch (error) {
        console.error('❌ Erreur auto-setup:', error);
        if (isMounted) {
          setHasInitialized(false); // Permettre un retry
          toast({
            variant: "destructive",
            title: "Erreur configuration",
            description: "Impossible de configurer automatiquement votre hôtel. Tentative automatique dans 5 secondes..."
          });
          
          // Retry après 5 secondes
          setTimeout(() => {
            if (isMounted) {
              setHasInitialized(false);
              setupUserHotel();
            }
          }, 5000);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Set timeout to prevent hanging
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.log('⏰ Auto-setup: Timeout atteint');
        setLoading(false);
        // Ne pas réinitialiser hasInitialized si on a déjà trouvé un hôtel
        if (!hotel) {
          setHasInitialized(false);
        }
      }
    }, 15000);

    setupUserHotel();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, user?.id]); // Supprimer hasInitialized des dépendances

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