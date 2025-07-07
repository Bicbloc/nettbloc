import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'room-status' | 'remark' | 'assignment';
  housekeeperName?: string;
  roomNumber?: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Garder seulement les 50 dernières

    // Afficher la notification toast
    toast({
      title: newNotification.title,
      description: newNotification.description,
    });

    return newNotification;
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    addNotification,
    clearNotifications,
    removeNotification,
  };
};