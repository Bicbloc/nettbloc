import { useEffect, useCallback } from 'react';
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
  // Utiliser le RealtimeManager centralisé

  useEffect(() => {
    const effectiveHotelId = hotelId || localStorage.getItem('selectedHotelId') || localStorage.getItem('currentHotelId');
    
    if (!effectiveHotelId || effectiveHotelId.length < 10) {
      console.log('⚠️ useRealtimeSync: hotelId invalide, pas de connexion');
      return;
    }

    // Connexion centralisée
    realtimeManager.connect(effectiveHotelId);

    // S'abonner aux tables demandées
    const subscriptionIds = tables.map(table => 
      realtimeManager.subscribe(table, (tableName, payload) => {
        onUpdate?.(tableName, payload);
      })
    );

    return () => {
      subscriptionIds.forEach(id => realtimeManager.unsubscribe(id));
    };
  }, [hotelId, tables, onUpdate]);

  const status = realtimeManager.getStatus();

  return {
    connectionStatus: status.isConnected ? 'SUBSCRIBED' : 'CLOSED',
    forceReconnect: () => realtimeManager.forceReconnect(),
    isConnected: status.isConnected,
    reconnectAttempts: status.reconnectAttempts
  };
};