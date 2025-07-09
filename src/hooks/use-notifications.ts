import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  hotel_id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'room-status' | 'remark' | 'assignment' | 'cleaning-start' | 'cleaning-end';
  housekeeperName?: string;
  roomNumber?: string;
  is_read: boolean;
  user_type: 'admin' | 'housekeeper';
}

export const useNotifications = (hotelId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  // Charger les notifications depuis Supabase
  const loadNotifications = useCallback(async () => {
    if (!hotelId) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erreur lors du chargement des notifications:', error);
        return;
      }

      const mappedNotifications: Notification[] = data.map(item => ({
        id: item.id,
        hotel_id: item.hotel_id,
        title: item.title,
        description: item.description,
        timestamp: new Date(item.created_at),
        type: item.type as Notification['type'],
        housekeeperName: item.housekeeper_name || undefined,
        roomNumber: item.room_number || undefined,
        is_read: item.is_read,
        user_type: item.user_type as 'admin' | 'housekeeper'
      }));

      setNotifications(mappedNotifications);
      setHasUnread(mappedNotifications.some(n => !n.is_read));
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    }
  }, [hotelId]);

  // Écouter les notifications en temps réel
  useEffect(() => {
    if (!hotelId) return;

    // Charger les notifications initiales
    loadNotifications();

    // Configurer l'écoute temps réel
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `hotel_id=eq.${hotelId}`
        },
        (payload) => {
          const newNotification: Notification = {
            id: payload.new.id,
            hotel_id: payload.new.hotel_id,
            title: payload.new.title,
            description: payload.new.description,
            timestamp: new Date(payload.new.created_at),
            type: payload.new.type,
            housekeeperName: payload.new.housekeeper_name || undefined,
            roomNumber: payload.new.room_number || undefined,
            is_read: payload.new.is_read,
            user_type: payload.new.user_type
          };

          console.log('🔔 Nouvelle notification reçue:', newNotification);

          setNotifications(prev => [newNotification, ...prev].slice(0, 50));
          setHasUnread(true);

          // Jouer un son de notification
          playNotificationSound(newNotification.type);

          // Afficher la notification toast
          toast({
            title: newNotification.title,
            description: newNotification.description,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotelId, loadNotifications]);

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'timestamp' | 'is_read' | 'hotel_id'>) => {
    if (!hotelId) {
      console.warn('hotelId manquant pour créer une notification');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          hotel_id: hotelId,
          title: notification.title,
          description: notification.description,
          type: notification.type,
          housekeeper_name: notification.housekeeperName,
          room_number: notification.roomNumber,
          user_type: notification.user_type,
          is_read: false
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création de la notification:', error);
        return null;
      }

      console.log('✅ Notification créée:', data);
      return data;
    } catch (error) {
      console.error('Erreur lors de la création de la notification:', error);
      return null;
    }
  }, [hotelId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );

      // Vérifier s'il reste des notifications non lues
      setHasUnread(prev => {
        const updated = notifications.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
        return updated.some(n => !n.is_read);
      });
    } catch (error) {
      console.error('Erreur lors du marquage de la notification comme lue:', error);
    }
  }, [notifications]);

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
      console.error('Erreur lors du marquage de toutes les notifications comme lues:', error);
    }
  }, [hotelId]);

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
      console.error('Erreur lors de la suppression des notifications:', error);
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

// Fonction pour jouer des sons de notification différents selon le type
const playNotificationSound = (type: Notification['type']) => {
  // Créer un contexte audio pour les sons
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Fréquences différentes selon le type de notification
  const frequencies = {
    'room-status': [800, 600],
    'remark': [600, 800, 600],
    'assignment': [400, 600, 800],
    'cleaning-start': [500, 700],
    'cleaning-end': [700, 500, 700]
  };

  const freq = frequencies[type] || [600];
  
  freq.forEach((frequency, index) => {
    setTimeout(() => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }, index * 150);
  });
};