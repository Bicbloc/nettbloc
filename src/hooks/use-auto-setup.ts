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
  const [hasConfigurationIssues, setHasConfigurationIssues] = useState(false);
  const hasAttemptedSetup = useRef<number>(0);
  const lastSuccessfulSetup = useRef<string | null>(null);

  // Force un reset complet et redémarrage
  const forceCompleteReset = () => {
    console.log('🔄 Force reset complet demandé...');
    
    // Reset des états
    setHotel(null);
    setAccessCode(null);
    setIsSetupComplete(false);
    setLoading(true);
    setHasConfigurationIssues(false);
    hasAttemptedSetup.current = 0;
    lastSuccessfulSetup.current = null;
    
    // Reset localStorage
    LocalStorageManager.resetHotelData();
    
    // Cleanup retry counters
    localStorage.removeItem('setup_retry_count');
    
    // Dispatch event pour forcer les autres composants à se réinitialiser
    window.dispatchEvent(new Event('hotel-reset-complete'));
    
    console.log('✅ Reset complet terminé');
  };

  useEffect(() => {
    const setupHotel = async () => {
      // Vérifier si setup déjà réussi pour cet utilisateur
      if (lastSuccessfulSetup.current === user?.id && isSetupComplete && hotel) {
        console.log('✅ Setup déjà validé pour cet utilisateur, aucune action requise');
        setLoading(false);
        setHasConfigurationIssues(false);
        return;
      }

      // Phase 0: Vérification intelligente localStorage
      const diagnostic = LocalStorageManager.getDiagnosticReport();
      const { cleaned } = LocalStorageManager.cleanCorruptedValues();
      
      if (cleaned.length > 0) {
        console.log('🧹 Valeurs localStorage corrompues nettoyées:', cleaned);
        hasAttemptedSetup.current = 0;
      }

      // Éviter les exécutions multiples
      if (hasAttemptedSetup.current && Date.now() - hasAttemptedSetup.current < 5000) {
        console.log('🚫 Setup récent déjà tenté, ignore pour éviter spam');
        return;
      }

      if (!isAuthenticated || !user?.id) {
        console.log('🚫 Non authentifié, reset état');
        setLoading(false);
        setIsSetupComplete(false);
        setHasConfigurationIssues(false);
        hasAttemptedSetup.current = 0;
        lastSuccessfulSetup.current = null;
        return;
      }

      console.log('🏨 Auto-setup: Démarrage pour user:', user.email, {
        userId: user.id,
        isAuthenticated,
        hasAttemptedSetup: hasAttemptedSetup.current,
        isSetupComplete,
        loading
      });
      hasAttemptedSetup.current = Date.now();
      
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

        // Phase 5: Finaliser le setup avec validation rigoureuse
        if (hotelData) {
          // Vérification finale de cohérence
          const isValidSetup = hotelData.id && hotelData.name && hotelData.user_id === user.id;
          
          if (!isValidSetup) {
            console.error('❌ Données hôtel incohérentes:', hotelData);
            throw new Error('Configuration hôtel invalide');
          }

          // Mise à jour atomique des états
          setHotel(hotelData);
          setAccessCode(activeCode);
          setIsSetupComplete(true);
          setHasConfigurationIssues(false);
          setLoading(false);
          
          // Marquer le succès pour cet utilisateur
          lastSuccessfulSetup.current = user.id;
          
          // Sauvegarde localStorage avec validation
          const saveSuccess = LocalStorageManager.saveHotelData({
            id: hotelData.id,
            code: hotelData.hotel_code,
            name: hotelData.name
          });
          
          if (!saveSuccess) {
            console.warn('⚠️ Échec sauvegarde localStorage, continue quand même');
          }
          
          console.log('✅ Setup terminé avec succès:', {
            hotelId: hotelData.id,
            hotelCode: hotelData.hotel_code,
            hotelName: hotelData.name,
            hasAccessCode: !!activeCode,
            userId: user.id,
            configurationIssues: false
          });

          // Toast uniquement pour nouveaux hôtels ou après problème résolu
          if (!existingHotel || hasConfigurationIssues) {
            toast({
              title: "✅ Configuration réussie",
              description: `${hotelData.name} est prêt !`,
              duration: 2000
            });
          }
        }

      } catch (error) {
        console.error('❌ Erreur auto-setup:', error);
        
        // Diagnostic de l'erreur plus précis
        const isNetworkError = error?.message?.includes('fetch') || 
                              error?.message?.includes('network') ||
                              error?.code === 'PGRST301' ||
                              error?.name === 'NetworkError';
        
        const isAuthError = error?.message?.includes('JWT') || 
                          error?.message?.includes('auth') ||
                          error?.code === 'PGRST302';
        
        if (isNetworkError) {
          console.log('🔄 Erreur réseau, retry autorisé');
          setHasConfigurationIssues(false);
          hasAttemptedSetup.current = 0;
          
          // Retry silencieux sans toast si moins de 3 tentatives
          const retryCount = Number(localStorage.getItem('setup_retry_count') || '0');
          if (retryCount < 3) {
            localStorage.setItem('setup_retry_count', String(retryCount + 1));
            setTimeout(() => setupHotel(), 2000);
            return;
          }
          
          toast({
            variant: "destructive",
            title: "Problème de connexion",
            description: "Vérifiez votre connexion internet.",
            duration: 3000
          });
        } else if (isAuthError) {
          console.log('🔐 Erreur authentification, reset complet');
          setHasConfigurationIssues(true);
          lastSuccessfulSetup.current = null;
        } else {
          // Erreur de données ou configuration
          console.log('⚠️ Erreur configuration détectée');
          setHasConfigurationIssues(true);
          
          // Toast discret, pas d'alarme excessive
          toast({
            title: "Configuration requise",
            description: "Votre compte nécessite une mise à jour.",
            duration: 3000
          });
        }
        
        // Reset pour cleanup
        localStorage.removeItem('setup_retry_count');
      } finally {
        // Cleanup et finalisation état
        if (isAuthenticated && user?.id) {
          hasAttemptedSetup.current = Date.now();
        }
        
        setLoading(false);
        console.log('🏁 Auto-setup terminé');
      }
    };

    // Timeout de sécurité intelligent
    const setupTimeout = setTimeout(() => {
      if (loading && isAuthenticated && user?.id) {
        console.warn('⚠️ Timeout setup après 10s');
        setLoading(false);
        setHasConfigurationIssues(true);
        hasAttemptedSetup.current = 0; // Reset pour permettre retry
        
        toast({
          title: "Chargement lent",
          description: "La configuration prend plus de temps que prévu.",
          duration: 3000
        });
      }
    }, 10000);

    // Lancer le setup intelligemment
    if (isAuthenticated && user?.id) {
      const lastAttempt = hasAttemptedSetup.current;
      const shouldAttempt = !lastAttempt || (Date.now() - lastAttempt > 10000);
      
      if (shouldAttempt) {
        setupHotel();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
      setIsSetupComplete(false);
      setHasConfigurationIssues(false);
      hasAttemptedSetup.current = 0;
      lastSuccessfulSetup.current = null;
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
    hasConfigurationIssues,
    generateNewAccessCode,
    forceCompleteReset
  };
};