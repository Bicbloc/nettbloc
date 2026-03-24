import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';
import { realtimeManager } from '@/services/RealtimeManager';

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastSuccessfulPing, setLastSuccessfulPing] = useState<Date | null>(null);

  // Test Supabase connection via ping edge function (bypasse RLS)
  const pingSupabase = useCallback(async () => {
    try {
      const start = Date.now();
      
      // Utiliser l'edge function ping qui bypasse RLS
      const { data, error } = await supabase.functions.invoke('ping');
      
      if (error || !data?.ok) {
        setConsecutiveFailures(prev => prev + 1);
        // Attendre 2 échecs consécutifs avant de marquer déconnecté
        if (consecutiveFailures >= 1) {
          setIsSupabaseConnected(false);
        }
        return false;
      }
      
      const pingTime = data.latency || (Date.now() - start);
      setLastPingTime(pingTime);
      setIsSupabaseConnected(true);
      setConsecutiveFailures(0);
      setLastSuccessfulPing(new Date());
      return true;
    } catch (error) {
      setConsecutiveFailures(prev => prev + 1);
      if (consecutiveFailures >= 1) {
        setIsSupabaseConnected(false);
      }
      return false;
    }
  }, [consecutiveFailures]);

  // Écouter les changements de statut du RealtimeManager
  useEffect(() => {
    const unsubscribe = realtimeManager.onConnectionStatusChange((status) => {
      if (status === 'SUBSCRIBED') {
        setIsSupabaseConnected(true);
        setConsecutiveFailures(0);
        setLastSuccessfulPing(new Date());
      } else if (status === 'OFFLINE' || status === 'FAILED') {
        setIsSupabaseConnected(false);
      }
    });
    
    return () => { unsubscribe(); };
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConsecutiveFailures(0);
      toast({
        title: "Connexion rétablie",
        description: "Vous êtes de nouveau en ligne",
      });
      // Ping immédiat après retour en ligne
      setTimeout(() => pingSupabase(), 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      // Toast uniquement si vraiment offline après délai
      setTimeout(() => {
        if (!navigator.onLine) {
          toast({
            variant: "destructive",
            title: "Pas de connexion",
            description: "Vérifiez votre connexion internet",
          });
        }
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pingSupabase]);

  // Ping périodique - seulement si échecs récents ou pas de ping depuis 2min
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isOnline) return;
      
      const shouldPing = consecutiveFailures > 0 || 
        !lastSuccessfulPing || 
        (Date.now() - lastSuccessfulPing.getTime() > 120000);
      
      if (shouldPing) {
        const wasConnected = isSupabaseConnected;
        const isConnected = await pingSupabase();
        
        if (!wasConnected && isConnected && consecutiveFailures >= 2) {
          toast({
            title: "Connexion rétablie",
            description: "Synchronisation en cours...",
          });
        }
      }
    }, 45000); // 45 secondes

    return () => clearInterval(interval);
  }, [isOnline, isSupabaseConnected, consecutiveFailures, lastSuccessfulPing, pingSupabase]);

  // Initial ping (delayed to let edge function deploy)
  useEffect(() => {
    const timer = setTimeout(() => pingSupabase(), 2000);
    return () => clearTimeout(timer);
  }, []);

  return {
    isOnline,
    isSupabaseConnected,
    isConnected: isOnline && isSupabaseConnected,
    lastPingTime,
    lastSuccessfulPing,
    consecutiveFailures,
    pingSupabase,
  };
}
