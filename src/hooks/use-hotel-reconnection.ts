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

  // Auto-reconnexion optimisée
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;
    let lastReconnectAttempt = 0;

    const attemptReconnect = () => {
      const now = Date.now();
      if (now - lastReconnectAttempt < 30000) { // 30 secondes minimum entre tentatives
        console.log('🚫 Reconnexion ignorée (< 30s depuis dernière tentative)');
        return;
      }
      
      // Vérifier si on a vraiment besoin de reconnecter
      const hotelId = localStorage.getItem('selectedHotelId');
      const lastValidSetup = localStorage.getItem('lastValidHotelSetup');
      
      if (!hotelId && !lastValidSetup) {
        console.log('🔄 Aucun hôtel actif détecté, tentative reconnexion...');
        lastReconnectAttempt = now;
        if (isMounted) forceReconnect();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hotel-data-reset') {
        console.log('🔄 Reset détecté, attente avant reconnexion...');
        setTimeout(attemptReconnect, 5000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(attemptReconnect, 3000);
      }
    };

    // Tentative initiale moins agressive
    reconnectTimeout = setTimeout(attemptReconnect, 10000);

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('hotel-reconnected', () => setHasReconnected(true));

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, user?.id, forceReconnect]);

  return {
    isReconnecting,
    hasReconnected,
    forceReconnect
  };
};