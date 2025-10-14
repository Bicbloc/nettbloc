import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';

interface RealtimeSyncOptions {
  hotelId?: string;
  tables: string[];
  onUpdate?: (table: string, payload: any) => void;
  reconnectInterval?: number;
}

export const useRealtimeSync = ({
  hotelId,
  tables,
  onUpdate,
  reconnectInterval = 5000
}: RealtimeSyncOptions) => {
  const [connectionStatus, setConnectionStatus] = useState<string>('CLOSED');
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  // Obtenir l'ID de l'hôtel depuis le contexte ou localStorage
  const getEffectiveHotelId = useCallback((): string | null => {
    if (hotelId) return hotelId;
    
    const storageKeys = ['selectedHotelId', 'currentHotelId', 'hotel_id'];
    for (const key of storageKeys) {
      const stored = localStorage.getItem(key);
      if (stored && stored.length > 0) {
        return stored;
      }
    }
    return null;
  }, [hotelId]);

  // Fonction de nettoyage
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (channelRef.current) {
      console.log('🧹 Nettoyage souscription temps réel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Fonction de reconnexion intelligente avec backoff exponentiel
  const attemptReconnection = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('❌ Trop de tentatives de reconnexion, abandon');
      toast({
        variant: "destructive",
        title: "Connexion temps réel instable",
        description: "Les données seront synchronisées au prochain rafraîchissement."
      });
      return;
    }

    reconnectAttempts.current++;
    // Backoff exponentiel: 1s, 2s, 4s, 8s, 16s...
    const delay = Math.min(Math.pow(2, reconnectAttempts.current - 1) * 1000, 30000);
    
    console.log(`🔄 Tentative de reconnexion ${reconnectAttempts.current}/${maxReconnectAttempts} dans ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setupRealtimeConnection();
    }, delay);
  }, []);

  // Configuration de la connexion temps réel
  const setupRealtimeConnection = useCallback(() => {
    const effectiveHotelId = getEffectiveHotelId();
    
    if (!effectiveHotelId) {
      console.log('⚠️ Pas de connexion temps réel: hotelId manquant');
      setConnectionStatus('CLOSED');
      return;
    }

    // Nettoyer la connexion existante
    cleanup();
    
    console.log('🔗 Configuration connexion temps réel pour:', effectiveHotelId.slice(0, 8) + '...');
    setConnectionStatus('CONNECTING');

    const channelName = `realtime_sync_${effectiveHotelId}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Configurer les listeners pour chaque table
    tables.forEach(table => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: table === 'notifications' || table === 'room_status_updates' || table === 'assignments' 
            ? `hotel_id=eq.${effectiveHotelId}` 
            : undefined
        },
        (payload) => {
          console.log(`📡 Changement temps réel [${table}]:`, payload.eventType);
          onUpdate?.(table, payload);
        }
      );
    });

    // Gérer les changements de statut
    channel.subscribe((status) => {
      console.log('📡 Statut connexion temps réel:', status);
      setConnectionStatus(status);
      
      switch (status) {
        case 'SUBSCRIBED':
          console.log('✅ Connexion temps réel établie');
          reconnectAttempts.current = 0;
          break;
          
        case 'CLOSED':
          console.log('⚠️ Connexion fermée');
          // Ne reconnecter que si on a une raison (pas une fermeture volontaire)
          if (reconnectAttempts.current < maxReconnectAttempts) {
            attemptReconnection();
          }
          break;
          
        case 'CHANNEL_ERROR':
          console.log('❌ Erreur de canal');
          // Attendre un peu avant de reconnecter en cas d'erreur
          setTimeout(() => {
            if (reconnectAttempts.current < maxReconnectAttempts) {
              attemptReconnection();
            }
          }, 2000);
          break;
          
        case 'TIMED_OUT':
          console.log('⏱️ Timeout de connexion');
          attemptReconnection();
          break;
          
        default:
          break;
      }
    });

    channelRef.current = channel;
  }, [getEffectiveHotelId, tables, onUpdate, cleanup, attemptReconnection]);

  // Fonction pour forcer la reconnexion
  const forceReconnect = useCallback(() => {
    console.log('🔄 Reconnexion forcée demandée');
    reconnectAttempts.current = 0;
    setupRealtimeConnection();
  }, [setupRealtimeConnection]);

  // Effet principal
  useEffect(() => {
    setupRealtimeConnection();
    
    return cleanup;
  }, [setupRealtimeConnection, cleanup]);

  // Nettoyer à la destruction du composant
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connectionStatus,
    forceReconnect,
    isConnected: connectionStatus === 'SUBSCRIBED',
    reconnectAttempts: reconnectAttempts.current
  };
};