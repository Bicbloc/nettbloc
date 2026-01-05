import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth, AUTH_EVENTS } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { HotelSessionService } from '@/services/hotelSessionService';

interface HotelData {
  id: string;
  name: string;
  hotel_code: string;
}

interface HotelContextType {
  hotelId: string | null;
  hotelName: string | null;
  hotelCode: string | null;
  isHotelReady: boolean;
  isLoading: boolean;
  refreshHotel: () => Promise<void>;
  clearHotel: () => void;
}

const HotelContext = createContext<HotelContextType | undefined>(undefined);

export const useHotel = () => {
  const context = useContext(HotelContext);
  if (!context) {
    throw new Error('useHotel must be used within a HotelProvider');
  }
  return context;
};

interface HotelProviderProps {
  children: ReactNode;
}

export const HotelProvider: React.FC<HotelProviderProps> = ({ children }) => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // Charger l'hôtel depuis la base de données
  const loadHotel = useCallback(async () => {
    if (!user?.id) {
      console.log('🏨 HotelContext: Pas d\'utilisateur, skip load');
      return;
    }

    setIsLoading(true);
    console.log('🏨 HotelContext: Chargement hôtel pour user:', user.id.slice(0, 8) + '...');

    try {
      // Phase 1: Vérifier le cache localStorage
      const cachedHotel = storageService.getHotel();
      if (cachedHotel?.id && cachedHotel.id.length > 30) {
        // Vérifier que l'hôtel appartient à l'utilisateur
        const { data: hotelExists } = await supabase
          .from('hotels')
          .select('id, name, hotel_code')
          .eq('id', cachedHotel.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (hotelExists) {
          console.log('✅ HotelContext: Cache validé');
          const hotelData = {
            id: hotelExists.id,
            name: hotelExists.name,
            hotel_code: hotelExists.hotel_code
          };
          setHotel(hotelData);
          setIsLoading(false);
          setHasAttemptedLoad(true);
          return;
        }
        
        // Cache invalide - nettoyer
        console.log('⚠️ HotelContext: Cache invalide, nettoyage');
        storageService.clearHotel();
      }

      // Phase 2: Requête base de données
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          id, 
          current_hotel_id,
          hotels!profiles_current_hotel_id_fkey(
            id, 
            name, 
            hotel_code
          )
        `)
        .eq('id', user.id)
        .single();

      let hotelResult: HotelData | null = null;

      if (profileData?.hotels) {
        hotelResult = profileData.hotels as unknown as HotelData;
        console.log('✅ HotelContext: Hôtel chargé via profil');
      } else {
        // Fallback: chercher par user_id
        const { data: foundHotel } = await supabase
          .from('hotels')
          .select('id, name, hotel_code')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (foundHotel) {
          hotelResult = foundHotel;
          console.log('✅ HotelContext: Hôtel trouvé par user_id');

          // Mettre à jour le lien dans profiles
          await supabase
            .from('profiles')
            .update({ current_hotel_id: foundHotel.id })
            .eq('id', user.id);
        } else {
          // Créer un nouvel hôtel
          const hotelName = user.user_metadata?.company_name || `Établissement de ${user.email}`;
          const hotelCode = `HTL${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

          const { data: newHotel } = await supabase
            .from('hotels')
            .insert({
              name: hotelName,
              email: user.email,
              user_id: user.id,
              hotel_code: hotelCode
            })
            .select('id, name, hotel_code')
            .single();

          if (newHotel) {
            hotelResult = newHotel;
            console.log('✅ HotelContext: Nouvel hôtel créé');

            // Créer le profil si nécessaire et lier l'hôtel
            await supabase
              .from('profiles')
              .upsert({
                id: user.id,
                email: user.email,
                current_hotel_id: newHotel.id,
                company_name: user.user_metadata?.company_name || null
              });
          }
        }
      }

      if (hotelResult) {
        setHotel(hotelResult);
        storageService.saveHotel({
          id: hotelResult.id,
          name: hotelResult.name,
          code: hotelResult.hotel_code
        });

        // Créer/restaurer la session hôtel
        await HotelSessionService.createSession(hotelResult.id);
        console.log('✅ HotelContext: Hôtel prêt:', hotelResult.id.slice(0, 8) + '...');
      }
    } catch (error) {
      console.error('❌ HotelContext: Erreur chargement hôtel:', error);
    } finally {
      setIsLoading(false);
      setHasAttemptedLoad(true);
    }
  }, [user?.id, user?.email, user?.user_metadata?.company_name]);

  // Effacer l'hôtel (déconnexion)
  const clearHotel = useCallback(() => {
    console.log('🏨 HotelContext: Nettoyage hôtel');
    setHotel(null);
    setHasAttemptedLoad(false);
    storageService.clearHotel();
  }, []);

  // Rafraîchir l'hôtel
  const refreshHotel = useCallback(async () => {
    setHasAttemptedLoad(false);
    await loadHotel();
  }, [loadHotel]);

  // Réagir aux changements d'authentification
  useEffect(() => {
    // Attendre que l'auth soit initialisée
    if (authLoading) {
      return;
    }

    // Si pas authentifié, nettoyer
    if (!isAuthenticated || !user?.id) {
      if (hotel) {
        clearHotel();
      }
      setHasAttemptedLoad(true);
      return;
    }

    // Charger l'hôtel si pas encore fait
    if (!hasAttemptedLoad) {
      loadHotel();
    }
  }, [authLoading, isAuthenticated, user?.id, hasAttemptedLoad, loadHotel, clearHotel, hotel]);

  // Écouter l'événement SIGNED_OUT pour nettoyer
  useEffect(() => {
    const handleSignOut = () => {
      console.log('🏨 HotelContext: SIGNED_OUT reçu, nettoyage');
      clearHotel();
    };

    window.addEventListener(AUTH_EVENTS.SIGNED_OUT, handleSignOut);
    return () => window.removeEventListener(AUTH_EVENTS.SIGNED_OUT, handleSignOut);
  }, [clearHotel]);

  // isHotelReady = on a terminé le chargement ET on a un hôtel (ou pas authentifié)
  const isHotelReady = hasAttemptedLoad && !isLoading;

  const value: HotelContextType = {
    hotelId: hotel?.id || null,
    hotelName: hotel?.name || null,
    hotelCode: hotel?.hotel_code || null,
    isHotelReady,
    isLoading,
    refreshHotel,
    clearHotel
  };

  return (
    <HotelContext.Provider value={value}>
      {children}
    </HotelContext.Provider>
  );
};
