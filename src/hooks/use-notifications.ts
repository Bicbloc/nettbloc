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

  // Valider l'ID d'hôtel (UUID standard uniquement)
  const isValidHotelId = useCallback((id: string) => {
    if (!id || typeof id !== 'string') return false;
    
    // Accepter uniquement les UUIDs v4 valides
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }, []);

  // Debug de l'hotel ID
  useEffect(() => {
    console.log('🏨 useNotifications - Hotel ID reçu:', {
      hotelId,
      isValid: hotelId ? isValidHotelId(hotelId) : false,
      type: typeof hotelId
    });
  }, [hotelId, isValidHotelId]);

  // Charger les notifications
  const loadNotifications = useCallback(async () => {
    if (!hotelId || !isValidHotelId(hotelId)) {
      console.warn('❌ Hotel ID invalide pour notifications:', hotelId);
      setNotifications([]);
      setHasUnread(false);
      return;
    }

    try {
      console.log('🔄 Chargement notifications pour hotel:', hotelId);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Erreur SQL notifications:', error);
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
      console.error('❌ Exception notifications:', error);
    }
  }, [hotelId, isValidHotelId]);

  // Setup realtime avec gestion d'erreur
  useEffect(() => {
    if (!hotelId || !isValidHotelId(hotelId)) {
      return;
    }

    console.log('🔌 Setup realtime pour hotel:', hotelId);
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
          console.log('📨 Nouvelle notification temps réel:', payload.new);
          
          const newNotification = {
            ...payload.new,
            housekeeper_name: payload.new.housekeeper_name,
            room_number: payload.new.room_number,
          } as Notification;

          setNotifications(prev => [newNotification, ...prev].slice(0, 50));
          setHasUnread(true);

          // Toast avec animation
          toast({
            title: newNotification.title,
            description: newNotification.description,
            className: "animate-fade-in border-primary/20",
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Statut channel realtime:', status);
      });

    return () => {
      console.log('🔌 Cleanup realtime channel');
      supabase.removeChannel(channel);
    };
  }, [hotelId, isValidHotelId, loadNotifications]);

  // Créer notification avec validation stricte
  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'hotel_id'>) => {
    if (!hotelId || !isValidHotelId(hotelId)) {
      console.error('❌ Impossible de créer notification - Hotel ID invalide:', hotelId);
      toast({
        variant: "destructive",
        title: "Erreur notification",
        description: "ID hôtel invalide"
      });
      return null;
    }

    try {
      console.log('📝 Création notification:', {
        hotel_id: hotelId,
        ...notification
      });
      
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
        console.error('❌ Erreur SQL création notification:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de créer la notification"
        });
        return null;
      }

      console.log('✅ Notification créée avec succès:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Exception création notification:', error);
      return null;
    }
  }, [hotelId, isValidHotelId]);

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
    if (!hotelId || !isValidHotelId(hotelId)) return;

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
  }, [hotelId, isValidHotelId]);

  // Effacer toutes
  const clearNotifications = useCallback(async () => {
    if (!hotelId || !isValidHotelId(hotelId)) return;

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('hotel_id', hotelId);

      setNotifications([]);
      setHasUnread(false);
      
      toast({
        title: "Notifications effacées",
        description: "Toutes les notifications ont été supprimées"
      });
    } catch (error) {
      console.error('Erreur suppression notifications:', error);
    }
  }, [hotelId, isValidHotelId]);

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