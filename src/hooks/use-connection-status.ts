import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';
import { realtimeManager } from '@/services/RealtimeManager';

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastSuccessfulPing, setLastSuccessfulPing] = useState<Date | null>(null);
  const reconnectCooldownRef = useRef(0);

  const requestReconnect = useCallback(() => {
    const now = Date.now();
    if (now - reconnectCooldownRef.current < 5000) return;
    reconnectCooldownRef.current = now;
    try { realtimeManager.forceReconnect(); } catch {}
  }, []);

  // Test Supabase connection via ping edge function (bypasse RLS)
  const pingSupabase = useCallback(async () => {
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('ping');

      if (error || !data?.ok) {
        setConsecutiveFailures(prev => prev + 1);
        // Reconnexion silencieuse, on ne marque PAS déconnecté tant que le navigateur est online.
          requestReconnect();
        if (!navigator.onLine) {
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
      requestReconnect();
      if (!navigator.onLine) {
        setIsSupabaseConnected(false);
      }
      return false;
    }
  }, []);

  // Écouter les changements de statut du RealtimeManager
  useEffect(() => {
    const unsubscribe = realtimeManager.onConnectionStatusChange((status) => {
      if (status === 'SUBSCRIBED') {
        setIsSupabaseConnected(true);
        setConsecutiveFailures(0);
        setLastSuccessfulPing(new Date());
      }
      // On ignore OFFLINE / FAILED tant que navigator.onLine — RealtimeManager se reconnecte seul.
    });

    return () => { unsubscribe(); };
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConsecutiveFailures(0);
      setIsSupabaseConnected(true);
      requestReconnect();
      setTimeout(() => pingSupabase(), 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      // Aucun toast pour éviter les faux positifs (sleep mobile, switch wifi…)
    };

    // Reconnexion automatique au retour de focus / visibilité
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        requestReconnect();
        pingSupabase();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [pingSupabase, requestReconnect]);

  // Ping périodique espacé (60s) — uniquement si nécessaire
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isOnline) return;

      const shouldPing = consecutiveFailures > 0 ||
        !lastSuccessfulPing ||
        (Date.now() - lastSuccessfulPing.getTime() > 120000);

      if (shouldPing) {
        await pingSupabase();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isOnline, consecutiveFailures, lastSuccessfulPing, pingSupabase]);

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
