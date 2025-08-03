import { useState, useEffect, useCallback } from 'react';
import { useConnectionStatus } from './use-connection-status';

interface StorageItem {
  key: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

export function useOfflineStorage() {
  const [pendingActions, setPendingActions] = useState<StorageItem[]>([]);
  const { isConnected } = useConnectionStatus();

  // Load pending actions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pendingActions');
      if (stored) {
        setPendingActions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading pending actions:', error);
    }
  }, []);

  // Save pending actions to localStorage
  const savePendingActions = useCallback((actions: StorageItem[]) => {
    try {
      localStorage.setItem('pendingActions', JSON.stringify(actions));
      setPendingActions(actions);
    } catch (error) {
      console.error('Error saving pending actions:', error);
    }
  }, []);

  // Store data offline
  const storeOffline = useCallback((key: string, data: any) => {
    const item: StorageItem = {
      key,
      data,
      timestamp: Date.now(),
      synced: false,
    };

    setPendingActions(prev => {
      const filtered = prev.filter(p => p.key !== key);
      const updated = [...filtered, item];
      savePendingActions(updated);
      return updated;
    });
  }, [savePendingActions]);

  // Mark as synced
  const markAsSynced = useCallback((key: string) => {
    setPendingActions(prev => {
      const updated = prev.map(item => 
        item.key === key ? { ...item, synced: true } : item
      );
      savePendingActions(updated);
      return updated;
    });
  }, [savePendingActions]);

  // Get stored data
  const getStoredData = useCallback((key: string) => {
    const item = pendingActions.find(p => p.key === key);
    return item?.data || null;
  }, [pendingActions]);

  // Clear synced items older than 24h
  const cleanupSynced = useCallback(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    setPendingActions(prev => {
      const updated = prev.filter(item => 
        !item.synced || item.timestamp > oneDayAgo
      );
      savePendingActions(updated);
      return updated;
    });
  }, [savePendingActions]);

  // Auto cleanup when online
  useEffect(() => {
    if (isConnected) {
      cleanupSynced();
    }
  }, [isConnected, cleanupSynced]);

  return {
    pendingActions: pendingActions.filter(p => !p.synced),
    storeOffline,
    markAsSynced,
    getStoredData,
    cleanupSynced,
    hasPendingActions: pendingActions.some(p => !p.synced),
  };
}