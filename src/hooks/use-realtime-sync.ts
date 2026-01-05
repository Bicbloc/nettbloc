import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { realtimeManager } from '@/services/RealtimeManager';

interface RealtimeSyncOptions {
  hotelId?: string;
  tables: string[];
  onUpdate?: (table: string, payload: any) => void;
}

export const useRealtimeSync = ({
  hotelId,
  tables,
  onUpdate,
}: RealtimeSyncOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  // Ref pour toujours avoir la dernière version du callback
  const onUpdateRef = useRef(onUpdate);
  
  // Mémoriser le tableau tables pour éviter les re-souscriptions infinies
  const stableTables = useMemo(() => tables, [JSON.stringify(tables)]);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Écouter les changements de statut
  useEffect(() => {
    const unsubscribe = realtimeManager.onConnectionStatusChange((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setLastSyncTime(new Date());
        setReconnectAttempts(0);
      } else if (status === 'OFFLINE' || status === 'CLOSED' || status === 'FAILED') {
        setIsConnected(false);
      } else if (status === 'RECONNECTING') {
        setReconnectAttempts(prev => prev + 1);
      }
    });
    
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    // Utiliser hotelId passé en props (fourni par HotelContext via le composant parent)
    const effectiveHotelId = hotelId;
    
    if (!effectiveHotelId || effectiveHotelId.length < 10) {
      console.log('⚠️ useRealtimeSync: hotelId invalide ou manquant');
      return;
    }

    console.log('🔗 useRealtimeSync: Connexion à', effectiveHotelId.slice(0, 8) + '...');
    realtimeManager.connect(effectiveHotelId);

    const subscriptionIds = stableTables.map(table => 
      realtimeManager.subscribe(table, (tableName, payload) => {
        setLastSyncTime(new Date());
        onUpdateRef.current?.(tableName, payload);
      })
    );

    return () => {
      subscriptionIds.forEach(id => realtimeManager.unsubscribe(id));
    };
  }, [hotelId, stableTables]);

  const forceReconnect = useCallback(() => {
    realtimeManager.forceReconnect();
  }, []);

  const status = realtimeManager.getStatus();

  return {
    connectionStatus: status.isConnected ? 'SUBSCRIBED' : 'CLOSED',
    forceReconnect,
    isConnected: status.isConnected,
    reconnectAttempts: status.reconnectAttempts,
    lastSyncTime,
    consecutiveFailures: status.consecutiveFailures
  };
};
