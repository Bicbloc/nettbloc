import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HotelReconnectionResult {
  isReconnecting: boolean;
  hasReconnected: boolean;
  forceReconnect: () => void;
}

export const useHotelReconnection = (): HotelReconnectionResult => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hasReconnected, setHasReconnected] = useState(false);

  const forceReconnect = async () => {
    if (!isAuthenticated || !user?.id) {
      console.log('🚫 Non authentifié, impossible de se reconnecter');
      return;
    }

    setIsReconnecting(true);
    console.log('🔄 Force reconnexion pour:', user.email);

    try {
      // Recherche multi-critères de l'hôtel
      const { data: hotels, error } = await supabase
        .from('hotels')
        .select('*')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .limit(1);

      if (error) {
        console.error('❌ Erreur recherche hôtel:', error);
        throw error;
      }

      if (hotels && hotels.length > 0) {
        const hotel = hotels[0];
        console.log('✅ Hôtel reconnecté:', hotel);

        // Mise à jour localStorage immédiate
        localStorage.setItem('selectedHotelId', hotel.id);
        localStorage.setItem('selectedHotelCode', hotel.hotel_code || '');
        localStorage.setItem('selectedHotelName', hotel.name);
        localStorage.setItem('lastReconnection', Date.now().toString());

        // Événement de reconnexion
        window.dispatchEvent(new CustomEvent('hotel-reconnected', { detail: hotel }));
        
        setHasReconnected(true);
        toast({
          title: "✅ Reconnexion réussie",
          description: `Connecté à ${hotel.name}`
        });
      } else {
        console.warn('⚠️ Aucun hôtel trouvé pour la reconnexion');
        toast({
          variant: "destructive",
          title: "Aucun établissement trouvé",
          description: "Veuillez configurer votre établissement"
        });
      }
    } catch (error) {
      console.error('❌ Erreur force reconnexion:', error);
      toast({
        variant: "destructive",
        title: "Erreur de reconnexion",
        description: "Impossible de se reconnecter automatiquement"
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  // Auto-reconnexion périodique
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hotel-reconnection-needed') {
        console.log('🔄 Reconnexion demandée via storage');
        forceReconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastReconnection = localStorage.getItem('lastReconnection');
        const now = Date.now();
        
    // Reconnexion si pas de reconnexion récente (< 30 min) ET pas de hotel en cours
        const currentHotelId = localStorage.getItem('selectedHotelId');
        if ((!lastReconnection || (now - parseInt(lastReconnection)) > 1800000) && !currentHotelId) {
          console.log('🔄 Auto-reconnexion par visibilité (pas d\'hôtel actif)');
          forceReconnect();
        }
      }
    };

    // Écouter les événements
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('hotel-reconnected', () => setHasReconnected(true));

    // Reconnexion initiale après authentification
    const initialReconnectTimeout = setTimeout(() => {
      if (!hasReconnected) {
        console.log('🔄 Reconnexion initiale différée');
        forceReconnect();
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(initialReconnectTimeout);
    };
  }, [isAuthenticated, user?.id, hasReconnected]);

  return {
    isReconnecting,
    hasReconnected,
    forceReconnect
  };
};