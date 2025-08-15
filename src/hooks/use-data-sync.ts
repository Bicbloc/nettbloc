import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useConnectionStatus } from './use-connection-status';
import { useOfflineStorage } from './use-offline-storage';
import { toast } from './use-toast';

interface SyncOptions {
  immediate?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

export function useDataSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncQueue, setSyncQueue] = useState<Array<{ id: string; operation: string; data: any }>>([]);
  const { isConnected } = useConnectionStatus();
  const { storeOffline, markAsSynced, hasPendingActions } = useOfflineStorage();
  const syncingRef = useRef(false);

  // Add to sync queue
  const queueSync = useCallback((operation: string, data: any, options: SyncOptions = {}) => {
    const syncItem = {
      id: crypto.randomUUID(),
      operation,
      data,
    };

    setSyncQueue(prev => [...prev, syncItem]);

    if (!isConnected) {
      storeOffline(syncItem.id, syncItem);
      toast({
        title: "Données sauvegardées",
        description: "Les modifications seront synchronisées quand la connexion sera rétablie",
      });
    } else if (options.immediate !== false) {
      processQueue();
    }

    return syncItem.id;
  }, [isConnected, storeOffline]);

  // Process sync queue
  const processQueue = useCallback(async () => {
    if (syncingRef.current || !isConnected || syncQueue.length === 0) {
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const results = await Promise.allSettled(
        syncQueue.map(async (item) => {
          try {
            // Process different types of operations
            switch (item.operation) {
              case 'room_update':
                await supabase
                  .from('room_status_updates')
                  .insert(item.data);
                break;
              case 'notification_create':
                await supabase
                  .from('notifications')
                  .insert(item.data);
                break;
              case 'housekeeper_create':
                await supabase
                  .from('housekeepers')
                  .insert(item.data);
                break;
              default:
                console.warn('Unknown sync operation:', item.operation);
            }
            
            markAsSynced(item.id);
            return { success: true, id: item.id };
          } catch (error) {
            console.error(`Sync failed for ${item.id}:`, error);
            return { success: false, id: item.id, error };
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      if (successful.length > 0) {
        setSyncQueue(prev => prev.filter(item => 
          !successful.some(s => s.status === 'fulfilled' && s.value.id === item.id)
        ));
        setLastSyncTime(Date.now());
      }

      if (failed.length > 0) {
        console.warn(`${failed.length} sync operations failed`);
        toast({
          variant: "destructive",
          title: "Synchronisation partielle",
          description: `${failed.length} opération(s) n'ont pas pu être synchronisées`,
        });
      } else if (successful.length > 0) {
        toast({
          title: "Synchronisation réussie",
          description: `${successful.length} opération(s) synchronisée(s)`,
        });
      }
    } catch (error) {
      console.error('Sync queue processing failed:', error);
      toast({
        variant: "destructive",
        title: "Erreur de synchronisation",
        description: "Impossible de synchroniser les données",
      });
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [isConnected, syncQueue, markAsSynced]);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isConnected && (syncQueue.length > 0 || hasPendingActions)) {
      const timeout = setTimeout(processQueue, 1000); // Small delay to ensure stability
      return () => clearTimeout(timeout);
    }
  }, [isConnected, syncQueue.length, hasPendingActions, processQueue]);

  // Manual sync trigger
  const forcSync = useCallback(async () => {
    if (isConnected) {
      await processQueue();
    } else {
      toast({
        variant: "destructive",
        title: "Pas de connexion",
        description: "Impossible de synchroniser sans connexion internet",
      });
    }
  }, [isConnected, processQueue]);

  return {
    isSyncing,
    lastSyncTime,
    queueSync,
    forcSync,
    pendingCount: syncQueue.length,
    canSync: isConnected && !isSyncing,
  };
}