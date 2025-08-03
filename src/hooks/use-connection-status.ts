import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);

  // Test Supabase connection
  const pingSupabase = useCallback(async () => {
    try {
      const start = Date.now();
      await supabase.from('profiles').select('id').limit(1);
      const pingTime = Date.now() - start;
      setLastPingTime(pingTime);
      setIsSupabaseConnected(true);
      return true;
    } catch (error) {
      console.error('Supabase ping failed:', error);
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

  // Periodic Supabase health check
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isOnline) {
        const wasConnected = isSupabaseConnected;
        const isConnected = await pingSupabase();
        
        if (!wasConnected && isConnected) {
          toast({
            title: "Base de données reconnectée",
            description: "La connexion à la base de données est rétablie",
          });
        } else if (wasConnected && !isConnected) {
          toast({
            variant: "destructive",
            title: "Problème de base de données",
            description: "Connexion à la base de données interrompue",
          });
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isOnline, isSupabaseConnected, pingSupabase]);

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