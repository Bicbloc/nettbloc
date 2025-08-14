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
      // Éviter les exécutions multiples mais permettre retry si échec
      if (hasAttemptedSetup.current && isSetupComplete) {
        console.log('🚫 Setup déjà réussi, ignore...');
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

        // Si le profil n'existe pas, le créer automatiquement
        let profileData = profile;
        if (!profile) {
          console.log('📝 Création automatique du profil utilisateur...');
          const { data: newProfile, error: createProfileError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              company_name: null
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

        // Phase 2: Recherche hôtel optimisée avec requête unique multi-critères
        console.log('🔍 Recherche hôtel multi-critères...', { 
          user_id: user.id, 
          email: user.email, 
          company: profileData.company_name 
        });

        // Requête optimisée combinant tous les critères
        const searchConditions = [`user_id.eq.${user.id}`];
        if (user.email) {
          searchConditions.push(`email.eq.${user.email}`);
        }
        if (profileData.company_name) {
          searchConditions.push(`name.eq.${profileData.company_name}`);
        }

        const { data: hotelResults, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .or(searchConditions.join(','))
          .limit(1);

        if (hotelError) {
          console.error('❌ Erreur recherche hôtel:', hotelError);
          throw hotelError;
        }

        let existingHotel = hotelResults && hotelResults.length > 0 ? hotelResults[0] : null;

        // Si trouvé mais pas avec le bon user_id, le mettre à jour
        if (existingHotel && existingHotel.user_id !== user.id) {
          console.log('✅ Hôtel trouvé, synchronisation user_id...');
          const { data: updatedHotel } = await supabase
            .from('hotels')
            .update({ 
              user_id: user.id,
              email: user.email 
            })
            .eq('id', existingHotel.id)
            .select()
            .single();
          
          if (updatedHotel) {
            existingHotel = updatedHotel;
            console.log('✅ Hotel synchronisé avec user_id');
          }
        }


        let hotelData: HotelData | null = existingHotel;
        let activeCode: string | null = null;

        // Phase 3: Si hôtel trouvé, optimiser la récupération des données
        if (existingHotel) {
          console.log('✅ Hôtel existant trouvé:', existingHotel);
          hotelData = existingHotel;
          
          // Synchroniser le nom si nécessaire et récupérer les codes en parallèle
          const promises = [];
          
          // Mise à jour nom si nécessaire
          if (existingHotel.name !== profileData.company_name && profileData.company_name) {
            console.log('🔄 Mise à jour nom hôtel...');
            promises.push(
              supabase
                .from('hotels')
                .update({ name: profileData.company_name })
                .eq('id', existingHotel.id)
                .select()
                .single()
                .then(({ data }) => {
                  if (data) {
                    hotelData = data;
                    console.log('✅ Nom hôtel mis à jour');
                  }
                })
            );
          }
          
          // Récupération codes d'accès
          promises.push(
            supabase
              .from('housekeeper_access_codes')
              .select('access_code')
              .eq('hotel_id', existingHotel.id)
              .eq('is_active', true)
              .limit(1)
              .then(({ data }) => {
                if (data && data.length > 0) {
                  activeCode = data[0].access_code;
                  console.log('✅ Code actif trouvé:', activeCode);
                }
              })
          );
          
          // Exécuter en parallèle pour optimiser les performances
          await Promise.allSettled(promises);
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
          
          // Sauvegarde localStorage pour les autres composants avec force refresh
          localStorage.setItem('selectedHotelId', hotelData.id);
          localStorage.setItem('selectedHotelCode', hotelData.hotel_code || '');
          localStorage.setItem('selectedHotelName', hotelData.name);
          localStorage.setItem('autoSetupComplete', 'true');
          localStorage.setItem('lastHotelCheck', Date.now().toString());
          
          // Force la reconnexion automatique
          window.dispatchEvent(new Event('hotel-reconnected'));
          
          console.log('✅ Setup terminé avec succès:', {
            hotelId: hotelData.id,
            hotelCode: hotelData.hotel_code,
            hotelName: hotelData.name,
            hasAccessCode: !!activeCode,
            profileCompanyName: profileData.company_name
          });

          // Toast discret uniquement pour les nouveaux hôtels
          if (!existingHotel) {
            toast({
              title: "✅ Établissement configuré",
              description: `${profileData.company_name || hotelData.name} prêt !`,
              duration: 2000
            });
          } else {
            // Log silencieux pour hôtel existant
            console.log('✅ Reconnexion silencieuse réussie:', hotelData.name);
          }
        }

      } catch (error) {
        console.error('❌ Erreur auto-setup:', error);
        hasAttemptedSetup.current = false; // Permettre un retry
        
        // Uniquement pour les erreurs critiques, proposer un retry manuel
        toast({
          variant: "destructive",
          title: "Problème de connexion",
          description: "Impossible de charger les données. Un retry automatique va être effectué.",
          duration: 3000
        });
        
        // Auto-retry après 2 secondes en cas d'erreur
        setTimeout(() => {
          if (!isSetupComplete && isAuthenticated && user?.id) {
            console.log('🔄 Auto-retry après erreur...');
            setupHotel();
          }
        }, 2000);
      } finally {
        setLoading(false);
        console.log('🏁 Auto-setup terminé');
      }
    };

    // Timeout plus raisonnable pour permettre aux requêtes de se terminer
    const setupTimeout = setTimeout(() => {
      if (loading && hasAttemptedSetup.current) {
        console.warn('⚠️ Timeout setup après 3s, retry avec fallback...');
        // Au lieu de forcer le completion, on relance un setup simple
        hasAttemptedSetup.current = false;
        setupHotel().catch(() => {
          // En cas d'échec final, on marque comme complété avec un message d'erreur
          setLoading(false);
          setIsSetupComplete(true);
          console.error('❌ Setup échoué définitivement');
        });
      }
    }, 3000); // Augmenté à 3000ms pour laisser le temps aux requêtes

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