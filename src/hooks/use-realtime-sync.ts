import { useEffect, useRef, useMemo } from 'react';
import { realtimeManager } from '@/services/RealtimeManager';

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
}: RealtimeSyncOptions) => {
  // Utiliser une ref pour toujours avoir la dernière version du callback
  const onUpdateRef = useRef(onUpdate);
  
  // CORRECTION: Mémoriser le tableau tables pour éviter les re-souscriptions infinies
  const stableTables = useMemo(() => tables, [tables.join(',')]);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const effectiveHotelId = hotelId || localStorage.getItem('selectedHotelId') || localStorage.getItem('currentHotelId');
    
    if (!effectiveHotelId || effectiveHotelId.length < 10) {
      console.log('⚠️ useRealtimeSync: hotelId invalide, pas de connexion');
      return;
    }

    console.log('🔗 useRealtimeSync: Connexion à l\'hôtel', effectiveHotelId.slice(0, 8) + '...');
    realtimeManager.connect(effectiveHotelId);

    // Utiliser la ref dans le callback pour toujours avoir la version à jour
    const subscriptionIds = stableTables.map(table => 
      realtimeManager.subscribe(table, (tableName, payload) => {
        onUpdateRef.current?.(tableName, payload);
      })
    );

    return () => {
      subscriptionIds.forEach(id => realtimeManager.unsubscribe(id));
    };
  }, [hotelId, stableTables]);

  const status = realtimeManager.getStatus();

  return {
    connectionStatus: status.isConnected ? 'SUBSCRIBED' : 'CLOSED',
    forceReconnect: () => realtimeManager.forceReconnect(),
    isConnected: status.isConnected,
    reconnectAttempts: status.reconnectAttempts
  };
};
