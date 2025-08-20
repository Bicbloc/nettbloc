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
        // Phase 1: Vérification de cohérence des données
        console.log('🔍 Vérification cohérence profil + hôtel...');
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('❌ Erreur recherche profil:', profileError);
          throw profileError;
        }

        // Si le profil n'existe pas, le créer automatiquement avec les métadonnées utilisateur
        let profileData = profile;
        if (!profile) {
          console.log('📝 Création automatique du profil utilisateur...');
          
          // Récupérer les métadonnées de l'utilisateur Supabase
          const companyFromMetadata = user.user_metadata?.company_name;
          
          const { data: newProfile, error: createProfileError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              company_name: companyFromMetadata || null
            })
            .select()
            .single();

          if (createProfileError) {
            console.error('❌ Erreur création profil:', createProfileError);
            toast({
              variant: "destructive",
              title: "Erreur de configuration",
              description: "Impossible de créer votre profil. Veuillez réessayer."
            });
            setLoading(false);
            return;
          }
          profileData = newProfile;
          console.log('✅ Profil créé automatiquement:', profileData);
        }

        console.log('✅ Profil utilisateur disponible:', profileData);

        // Phase 2: Rechercher l'hôtel existant
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

        // Phase 3: Si hôtel trouvé, chercher les codes d'accès actifs
        if (existingHotel) {
          console.log('✅ Hôtel existant trouvé:', existingHotel);
          
          // Vérifier que le nom de l'hôtel correspond au company_name du profil
          if (existingHotel.name !== profileData.company_name && profileData.company_name) {
            console.log('🔄 Mise à jour nom hôtel pour correspondre au profil...');
            const { data: updatedHotel, error: updateError } = await supabase
              .from('hotels')
              .update({ name: profileData.company_name })
              .eq('id', existingHotel.id)
              .select()
              .single();

            if (!updateError && updatedHotel) {
              hotelData = updatedHotel;
              console.log('✅ Nom hôtel mis à jour:', profileData.company_name);
            }
          }
          
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

        // Phase 4: Si pas d'hôtel du tout, en créer un automatiquement
        if (!hotelData) {
          console.log('📝 Création automatique nouvel hôtel...');
          const hotelName = profileData.company_name || `Établissement de ${user.email}`;

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
          console.log('✅ Hôtel créé automatiquement:', hotelData);
        }

        // Phase 5: Finaliser le setup avec les données trouvées/créées
        if (hotelData) {
          // Mise à jour immédiate des états
          setHotel(hotelData);
          setAccessCode(activeCode);
          setIsSetupComplete(true);
          setLoading(false); // Arrêter le loading immédiatement
          
          // Sauvegarde localStorage pour les autres composants
          localStorage.setItem('selectedHotelId', hotelData.id);
          localStorage.setItem('selectedHotelCode', hotelData.hotel_code || '');
          localStorage.setItem('selectedHotelName', hotelData.name);
          
          console.log('✅ Setup terminé avec succès:', {
            hotelId: hotelData.id,
            hotelCode: hotelData.hotel_code,
            hotelName: hotelData.name,
            hasAccessCode: !!activeCode,
            profileCompanyName: profileData.company_name
          });

          // Ne pas afficher de toast si l'hôtel existait déjà (évite le spam)
          if (!existingHotel) {
            toast({
              title: "✅ Établissement configuré",
              description: `${profileData.company_name || hotelData.name} prêt à l'emploi !`
            });
          }
        }

      } catch (error) {
        console.error('❌ Erreur auto-setup:', error);
        hasAttemptedSetup.current = false; // Permettre un retry
        toast({
          variant: "destructive",
          title: "Erreur configuration",
          description: "Erreur lors de la configuration de l'hôtel. Veuillez réessayer ou contacter le support."
        });
      } finally {
        setLoading(false);
        console.log('🏁 Auto-setup terminé');
      }
    };

    // Timeout optimisé pour éviter les déconnexions
    const setupTimeout = setTimeout(() => {
      if (loading && hasAttemptedSetup.current) {
        console.warn('⚠️ Timeout setup, forçage completion...');
        setLoading(false);
        setIsSetupComplete(true);
      }
    }, 5000); // Augmenté à 5s pour éviter les timeouts prématurés

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