import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Test Supabase connection avec gestion intelligente des erreurs
  const pingSupabase = useCallback(async () => {
    try {
      const start = Date.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      
      if (error) {
        setConsecutiveFailures(prev => prev + 1);
        setIsSupabaseConnected(false);
        return false;
      }
      
      const pingTime = Date.now() - start;
      setLastPingTime(pingTime);
      setIsSupabaseConnected(true);
      setConsecutiveFailures(0);
      return true;
    } catch (error) {
      setConsecutiveFailures(prev => prev + 1);
      setIsSupabaseConnected(false);
      return false;
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connexion rétablie",
        description: "Vous êtes de nouveau en ligne",
      });
      pingSupabase();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        variant: "destructive",
        title: "Connexion perdue",
        description: "Vérifiez votre connexion internet",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pingSupabase]);

  // Periodic Supabase health check - uniquement si nécessaire
  useEffect(() => {
    const interval = setInterval(async () => {
      // Ne ping que si on a eu des échecs récents ou si offline
      if (isOnline && (consecutiveFailures > 0 || !isSupabaseConnected)) {
        const wasConnected = isSupabaseConnected;
        const isConnected = await pingSupabase();
        
        if (!wasConnected && isConnected) {
          toast({
            title: "Connexion rétablie",
            description: "Synchronisation automatique en cours...",
          });
        }
      }
    }, 60000); // Check toutes les 60 secondes au lieu de 30

    return () => clearInterval(interval);
  }, [isOnline, isSupabaseConnected, consecutiveFailures, pingSupabase]);

  // Initial ping
  useEffect(() => {
    pingSupabase();
  }, [pingSupabase]);

  return {
    isOnline,
    isSupabaseConnected,
    isConnected: isOnline && isSupabaseConnected,
    lastPingTime,
    pingSupabase,
  };
}