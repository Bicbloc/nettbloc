import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  hotel_id: string;
  title: string;
  description: string;
  type: 'room-status' | 'remark' | 'assignment' | 'cleaning-start' | 'cleaning-end';
  housekeeper_name?: string;
  room_number?: string;
  is_read: boolean;
  user_type: 'admin' | 'housekeeper';
  created_at: string;
}

export const useNotifications = (hotelId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  console.log('🔔 useNotifications - hotelId:', hotelId);

  // Valider UUID
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  // Charger les notifications
  const loadNotifications = useCallback(async () => {
    if (!hotelId || !isValidUUID(hotelId)) {
      console.log('🔔 Pas de hotel ID valide pour charger les notifications');
      return;
    }

    try {
      console.log('🔔 Chargement des notifications pour hotel:', hotelId);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Erreur chargement notifications:', error);
        return;
      }

      console.log('✅ Notifications chargées:', data?.length || 0);
      const mappedNotifications = (data || []).map(item => ({
        ...item,
        housekeeper_name: item.housekeeper_name,
        room_number: item.room_number,
      })) as Notification[];

      setNotifications(mappedNotifications);
      setHasUnread(mappedNotifications.some(n => !n.is_read));
    } catch (error) {
      console.error('❌ Erreur lors du chargement des notifications:', error);
    }
  }, [hotelId]);

  // Écouter les nouvelles notifications en temps réel
  useEffect(() => {
    if (!hotelId || !isValidUUID(hotelId)) {
      return;
    }

    console.log('🔔 Configuration realtime pour hotel:', hotelId);
    loadNotifications();

    const channel = supabase
      .channel(`notifications-${hotelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `hotel_id=eq.${hotelId}`
        },
        (payload) => {
          console.log('🔔 Nouvelle notification reçue:', payload.new);
          
          const newNotification = {
            ...payload.new,
            housekeeper_name: payload.new.housekeeper_name,
            room_number: payload.new.room_number,
          } as Notification;

          setNotifications(prev => [newNotification, ...prev].slice(0, 50));
          setHasUnread(true);

          // Toast notification
          toast({
            title: newNotification.title,
            description: newNotification.description,
            className: "animate-fade-in",
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔔 Nettoyage channel realtime');
      supabase.removeChannel(channel);
    };
  }, [hotelId, loadNotifications]);

  // Créer une notification
  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'hotel_id'>) => {
    if (!hotelId || !isValidUUID(hotelId)) {
      console.warn('❌ Hotel ID invalide pour créer notification:', hotelId);
      return null;
    }

    try {
      console.log('🔔 Création notification:', notification);
      
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          hotel_id: hotelId,
          title: notification.title,
          description: notification.description,
          type: notification.type,
          housekeeper_name: notification.housekeeper_name,
          room_number: notification.room_number,
          user_type: notification.user_type,
          is_read: false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur création notification:', error);
        return null;
      }

      console.log('✅ Notification créée:', data);
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la création de la notification:', error);
      return null;
    }
  }, [hotelId]);

  // Marquer comme lu
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );

      setHasUnread(prev => {
        const updated = notifications.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
        return updated.some(n => !n.is_read);
      });
    } catch (error) {
      console.error('Erreur marquage lecture:', error);
    }
  }, [notifications]);

  // Marquer toutes comme lues
  const markAllAsRead = useCallback(async () => {
    if (!hotelId) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('hotel_id', hotelId)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setHasUnread(false);
    } catch (error) {
      console.error('Erreur marquage toutes lues:', error);
    }
  }, [hotelId]);

  // Effacer toutes
  const clearNotifications = useCallback(async () => {
    if (!hotelId) return;

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('hotel_id', hotelId);

      setNotifications([]);
      setHasUnread(false);
    } catch (error) {
      console.error('Erreur suppression notifications:', error);
    }
  }, [hotelId]);

  return {
    notifications,
    hasUnread,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    loadNotifications,
  };
};