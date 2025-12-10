import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';
import { realtimeManager } from '@/services/RealtimeManager';

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

  // Récupération via source unique (HotelStorageService)
  const getEffectiveHotelId = useCallback((): string | null => {
    if (hotelId && isValidHotelId(hotelId)) {
      return hotelId;
    }

    // Fallback vers HotelStorageService (source unique de vérité)
    const stored = localStorage.getItem('selectedHotelId');
    if (stored && isValidHotelId(stored)) {
      console.log('✅ HotelId trouvé via selectedHotelId:', stored.slice(0, 8) + '...');
      return stored;
    }

    console.log('❌ Aucun hotelId valide trouvé');
    return null;

    console.log('❌ Aucun hotelId valide trouvé');
    return null;
  }, [hotelId, isValidHotelId]);

  const loadNotifications = useCallback(async () => {
    const effectiveHotelId = getEffectiveHotelId();
    
    if (!effectiveHotelId) {
      console.log('⚠️ Aucun hotelId valide disponible');
      setNotifications([]);
      setHasUnread(false);
      return;
    }

    // Vérifier le cache
    const cached = notificationCache.get(effectiveHotelId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📦 Utilisation du cache pour les notifications');
      setNotifications(cached.data);
      setHasUnread(cached.data.some(n => !n.is_read));
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Chargement des notifications pour l\'hôtel:', effectiveHotelId.slice(0, 8) + '...');
      
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

      console.log(`✅ ${data?.length || 0} notifications chargées`);
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
      toast({
        variant: "destructive",
        title: "Erreur de chargement",
        description: "Impossible de charger les notifications"
      });
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
        // Connexion au manager centralisé
        await realtimeManager.connect(effectiveHotelId);

        // S'abonner aux changements
        subscriptionId = realtimeManager.subscribe('notifications', (table, payload) => {
          console.log('📨 Nouvelle notification:', payload.eventType);
          realtimeConnected = true;
          
          // Invalider le cache
          notificationCache.delete(effectiveHotelId);
          loadNotifications();

          // Toast uniquement pour les nouvelles notifications
          if (payload.eventType === 'INSERT' && payload.new) {
            const newNotif = payload.new as Notification;
            toast({
              title: newNotif.title,
              description: newNotif.description,
            });
          }
        });

        retryCount = 0; // Reset retry count on success
        console.log('✅ Realtime notifications connected');
      } catch (error) {
        console.error('❌ Failed to setup realtime:', error);
        realtimeConnected = false;
        
        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          console.log(`🔄 Retrying realtime connection in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
          retryTimeout = setTimeout(setupRealtime, delay);
        } else {
          // Fallback sur polling après tous les retries
          console.log('⚠️ Realtime failed, using polling fallback');
          startPolling();
        }
      }
    };

    const startPolling = () => {
      if (pollingInterval) return;
      
      console.log('🔄 Démarrage du polling fallback (toutes les 10s)');
      pollingInterval = setInterval(() => {
        if (!realtimeConnected) {
          console.log('📡 Polling notifications...');
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
      console.log('➕ Ajout d\'une nouvelle notification...');
      
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

      console.log('✅ Notification ajoutée avec succès');
      
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
      
      console.log('✅ Notification marquée comme lue');
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
      
      console.log('✅ Toutes les notifications marquées comme lues');
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
      
      console.log('✅ Toutes les notifications supprimées');
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