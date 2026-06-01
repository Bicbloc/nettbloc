import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { toast } from './use-toast';
import { realtimeManager } from '@/services/RealtimeManager';
import { nativeNotificationService } from '@/services/nativeNotificationService';

export interface Notification {
  id: string;
  hotel_id: string;
  title: string;
  description: string;
  type: string; // Changé pour accepter tout type de string
  housekeeper_name?: string;
  room_number?: string;
  is_read: boolean;
  user_type: string; // Changé pour accepter tout type de string
  created_at: string;
  user_id?: string;
}

// Cache pour améliorer les performances
const notificationCache = new Map<string, { data: Notification[], timestamp: number }>();
const CACHE_DURATION = 5000; // 5 secondes pour une réactivité maximale

export const useNotifications = (hotelId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Validation UUID plus flexible
  const isValidHotelId = useCallback((id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    
    // UUID v4 standard
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    // UUID générique
    const uuidGenericRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Format custom hotel-xxx
    const customHotelRegex = /^hotel-[a-zA-Z0-9]+$/;
    
    return uuidV4Regex.test(id) || uuidGenericRegex.test(id) || customHotelRegex.test(id);
  }, []);

  // Récupération directe via props (HotelContext passe hotelId)
  const getEffectiveHotelId = useCallback((): string | null => {
    if (hotelId && isValidHotelId(hotelId)) {
      return hotelId;
    }

    // Fallback via storageService
    const stored = storageService.getHotelId();
    if (stored && isValidHotelId(stored)) {
      return stored;
    }

    return null;
  }, [hotelId, isValidHotelId]);

  const loadNotifications = useCallback(async () => {
    const effectiveHotelId = getEffectiveHotelId();
    
    if (!effectiveHotelId) {
      setNotifications([]);
      setHasUnread(false);
      return;
    }

    // Vérifier le cache
    const cached = notificationCache.get(effectiveHotelId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setNotifications(cached.data);
      setHasUnread(cached.data.some(n => !n.is_read));
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('hotel_id', effectiveHotelId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Erreur lors du chargement des notifications:', error);
        throw error;
      }

      const notifs = data || [];
      
      // Mettre à jour le cache
      notificationCache.set(effectiveHotelId, {
        data: notifs,
        timestamp: Date.now()
      });

      setNotifications(notifs);
      setHasUnread(notifs.some(n => !n.is_read));
    } catch (error) {
      console.error('💥 Erreur critique dans loadNotifications:', error);
      setNotifications([]);
      setHasUnread(false);
    } finally {
      setLoading(false);
    }
  }, [getEffectiveHotelId]);

  // Souscription temps réel via RealtimeManager centralisé avec retry + polling fallback
  useEffect(() => {
    const effectiveHotelId = getEffectiveHotelId();
    if (!effectiveHotelId) return;

    let subscriptionId: string | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let retryTimeout: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let realtimeConnected = false;

    const setupRealtime = async () => {
      try {
        // Toujours s'abonner au manager: les callbacks sont enregistrés indépendamment
        // de l'état du canal et seront déclenchés dès que la connexion est établie
        // (y compris après l'authentification via l'événement SIGNED_IN).
        if (!subscriptionId) {
          subscriptionId = realtimeManager.subscribe('notifications', (table, payload) => {
            realtimeConnected = true;

            // Invalider le cache
            notificationCache.delete(effectiveHotelId);
            loadNotifications();

            // Notification pour les nouvelles entrées
            if (payload.eventType === 'INSERT' && payload.new) {
              const newNotif = payload.new as Notification;

              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('staff-notification', {
                    detail: { title: newNotif.title, description: newNotif.description }
                  })
                );
              }

              nativeNotificationService.sendNotification({
                title: newNotif.title,
                body: newNotif.description,
              });
            }
          });
        }

        // Connexion au manager centralisé (réessaie tout seul en interne)
        const ok = await realtimeManager.connect(effectiveHotelId);

        // Polling de secours léger tant que le realtime n'a pas confirmé une connexion.
        // Il s'arrête automatiquement dès qu'un événement realtime arrive (realtimeConnected = true).
        startPolling();

        if (ok) {
          retryCount = 0;
          return;
        }
      } catch (error) {
        console.error('❌ Failed to setup realtime:', error);
        realtimeConnected = false;

        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryTimeout = setTimeout(setupRealtime, delay);
        } else {
          // Fallback sur polling après tous les retries
          startPolling();
        }
      }
    };

    const startPolling = () => {
      if (pollingInterval) return;
      
      pollingInterval = setInterval(() => {
        if (!realtimeConnected) {
          notificationCache.delete(effectiveHotelId);
          loadNotifications();
        }
      }, 10000); // Toutes les 10 secondes
    };

    // Chargement initial
    loadNotifications();
    
    // Setup realtime
    setupRealtime();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (pollingInterval) clearInterval(pollingInterval);
      if (subscriptionId) realtimeManager.unsubscribe(subscriptionId);
    };
  }, [getEffectiveHotelId, loadNotifications]);

  const addNotification = useCallback(async (
    notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'hotel_id'>
  ): Promise<Notification | null> => {
    const effectiveHotelId = getEffectiveHotelId();
    
    if (!effectiveHotelId) {
      console.error('❌ Impossible d\'ajouter une notification: hotelId manquant');
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'ajouter la notification: hôtel non configuré"
      });
      return null;
    }

    try {
      
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          hotel_id: effectiveHotelId,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      
      // Invalider le cache
      notificationCache.delete(effectiveHotelId);
      
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout de la notification:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'ajouter la notification"
      });
      return null;
    }
  }, [getEffectiveHotelId]);

  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Invalider le cache
      const effectiveHotelId = getEffectiveHotelId();
      if (effectiveHotelId) {
        notificationCache.delete(effectiveHotelId);
      }

      // Mise à jour locale optimiste
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      
    } catch (error) {
      console.error('❌ Erreur lors du marquage comme lu:', error);
    }
  }, [getEffectiveHotelId]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    const effectiveHotelId = getEffectiveHotelId();
    
    if (!effectiveHotelId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('hotel_id', effectiveHotelId)
        .eq('is_read', false);

      if (error) throw error;

      // Invalider le cache
      notificationCache.delete(effectiveHotelId);

      // Mise à jour locale optimiste
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setHasUnread(false);
      
    } catch (error) {
      console.error('❌ Erreur lors du marquage global comme lu:', error);
    }
  }, [getEffectiveHotelId]);

  const clearNotifications = useCallback(async (): Promise<void> => {
    const effectiveHotelId = getEffectiveHotelId();
    
    if (!effectiveHotelId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('hotel_id', effectiveHotelId);

      if (error) throw error;

      // Invalider le cache
      notificationCache.delete(effectiveHotelId);

      setNotifications([]);
      setHasUnread(false);
      
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
    }
  }, [getEffectiveHotelId]);

  return {
    notifications,
    loading,
    hasUnread,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refreshNotifications: loadNotifications
  };
};