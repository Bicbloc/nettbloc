import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LocalStorageManager } from '@/utils/localStorageManager';

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

  // Force un reset complet et redémarrage
  const forceCompleteReset = () => {
    console.log('🔄 Force reset complet demandé...');
    
    // Reset des états
    setHotel(null);
    setAccessCode(null);
    setIsSetupComplete(false);
    setLoading(true);
    hasAttemptedSetup.current = false;
    
    // Reset localStorage
    LocalStorageManager.resetHotelData();
    
    // Dispatch event pour forcer les autres composants à se réinitialiser
    window.dispatchEvent(new Event('hotel-reset-complete'));
    
    console.log('✅ Reset complet terminé');
  };

  useEffect(() => {
    const setupHotel = async () => {
      // Phase 0: Nettoyage localStorage au démarrage
      const { cleaned } = LocalStorageManager.cleanCorruptedValues();
      if (cleaned.length > 0) {
        console.log('🧹 Valeurs localStorage corrompues nettoyées:', cleaned);
        // Si localStorage était corrompu, on force un redémarrage propre
        hasAttemptedSetup.current = false;
      }

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

      // Éviter les exécutions multiples avec log détaillé
      if (hasAttemptedSetup.current) {
        console.log('🚫 Setup déjà en cours, ignore...', {
          hasAttemptedSetup: hasAttemptedSetup.current,
          isSetupComplete,
          loading,
          userId: user.id,
          userEmail: user.email
        });
        return;
      }

      console.log('🏨 Auto-setup: Démarrage pour user:', user.email, {
        userId: user.id,
        isAuthenticated,
        hasAttemptedSetup: hasAttemptedSetup.current,
        isSetupComplete,
        loading
      });
      hasAttemptedSetup.current = true;
      
      try {
        // Phase 1: Vérification de cohérence des données
        console.log('🔍 Phase 1: Vérification cohérence profil + hôtel...');
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        console.log('📊 Résultat requête profil:', { profile, profileError });

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

        // Phase 2: Recherche hôtel optimisée avec priorisation intelligente
        console.log('🔍 Phase 2: Recherche hôtel avec priorisation...', { 
          user_id: user.id, 
          email: user.email, 
          company: profileData.company_name 
        });

        // D'abord chercher par user_id (priorité absolue)
        console.log('🔍 Recherche par user_id:', user.id);
        let { data: hotelResults, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        console.log('📊 Résultat recherche par user_id:', { hotelResults, hotelError });

        // Si pas trouvé par user_id, chercher par email avec possibilité de récupération
        if ((!hotelResults || hotelResults.length === 0) && user.email) {
          console.log('🔍 Recherche par email en fallback...', user.email);
          const { data: emailResults, error: emailError } = await supabase
            .from('hotels')
            .select('*')
            .eq('email', user.email)
            .order('created_at', { ascending: false })
            .limit(1);
          
          console.log('📊 Résultat recherche par email:', { emailResults, emailError });
          
          if (!emailError && emailResults && emailResults.length > 0) {
            hotelResults = emailResults;
            console.log('✅ Hôtel trouvé par email, sera récupéré');
          }
        }

        if (hotelError) {
          console.error('❌ Erreur recherche hôtel:', hotelError);
          throw hotelError;
        }

        let existingHotel = hotelResults && hotelResults.length > 0 ? hotelResults[0] : null;

        // Si trouvé mais pas avec le bon user_id, le récupérer et le synchroniser
        if (existingHotel && existingHotel.user_id !== user.id) {
          console.log('🔄 Récupération hôtel orphelin, synchronisation user_id...');
          const { data: updatedHotel, error: updateError } = await supabase
            .from('hotels')
            .update({ 
              user_id: user.id,
              email: user.email,
              name: profileData.company_name || existingHotel.name
            })
            .eq('id', existingHotel.id)
            .select()
            .single();
          
          if (updateError) {
            console.error('❌ Erreur synchronisation hôtel:', updateError);
            // Continuer avec l'hôtel existant même si la sync échoue
          } else if (updatedHotel) {
            existingHotel = updatedHotel;
            console.log('✅ Hôtel récupéré et synchronisé avec user_id');
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
          
          // Sauvegarde localStorage sécurisée
          const saveSuccess = LocalStorageManager.saveHotelData({
            id: hotelData.id,
            code: hotelData.hotel_code,
            name: hotelData.name
          });
          
          if (!saveSuccess) {
            console.error('❌ Échec sauvegarde localStorage');
            throw new Error('Impossible de sauvegarder les données hôtel');
          }
          
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
        
        // Reset pour permettre un retry uniquement en cas d'erreur réseau/temporaire
        const isNetworkError = error?.message?.includes('fetch') || 
                              error?.message?.includes('network') ||
                              error?.code === 'PGRST301';
        
        if (isNetworkError) {
          hasAttemptedSetup.current = false; // Permettre retry pour erreurs réseau
          console.log('🔄 Erreur réseau détectée, retry autorisé');
          
          toast({
            variant: "destructive",
            title: "Problème de connexion",
            description: "Erreur réseau détectée. Retry automatique...",
            duration: 2000
          });
          
          // Auto-retry immédiat pour erreurs réseau
          setTimeout(() => {
            if (!isSetupComplete && isAuthenticated && user?.id && !hasAttemptedSetup.current) {
              console.log('🔄 Auto-retry réseau...');
              setupHotel();
            }
          }, 1000);
        } else {
          // Pour autres erreurs, afficher message mais ne pas retry automatiquement
          toast({
            variant: "destructive",
            title: "Erreur de configuration",
            description: "Impossible de charger les données de votre établissement. Utilisez le bouton de rechargement.",
            duration: 5000
          });
          console.log('❌ Erreur non-réseau, pas de retry automatique');
        }
      } finally {
        // Ne pas forcer setLoading(false) ici si on va retry
        const shouldRetry = !isSetupComplete && isAuthenticated && user?.id && !hasAttemptedSetup.current;
        if (!shouldRetry) {
          setLoading(false);
        }
        console.log('🏁 Auto-setup terminé');
      }
    };

    // Timeout de sécurité pour éviter un loading infini mais plus généreux
    const setupTimeout = setTimeout(() => {
      if (loading && hasAttemptedSetup.current) {
        console.warn('⚠️ Timeout setup après 8s, arrêt forcé...');
        hasAttemptedSetup.current = false; // Reset pour permettre retry manuel
        setLoading(false);
        setIsSetupComplete(false);
        
        toast({
          variant: "destructive",
          title: "Timeout de connexion",
          description: "Le chargement prend trop de temps. Utilisez le bouton de rechargement.",
          duration: 5000
        });
        console.error('❌ Setup échoué après timeout - retry manuel disponible');
      }
    }, 8000); // Timeout plus généreux

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
    generateNewAccessCode,
    forceCompleteReset
  };
};